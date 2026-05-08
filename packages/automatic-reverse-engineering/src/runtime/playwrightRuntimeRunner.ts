import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { DocsIndexEntry } from "../collectors/static/docsIndex.js";
import { FixtureManifest, fixtureStringAtPath } from "../fixtures/manifest.js";
import { StaticCandidateOptions } from "../processors/staticCandidates.js";
import { sanitizeHar } from "../processors/harSanitizer.js";
import { FeatureScenario } from "../scenarios/feature.js";
import { RouteCatalogEntry, StaticSnapshot } from "../types.js";
import { ensureDir, readJsonFile, writeJsonFile } from "../util/fs.js";
import {
    PlaywrightBrowserContextLike,
    PlaywrightCapturedFeatureRunResult,
    PlaywrightPageLike,
    PlaywrightVideoLike,
    runPlaywrightCapturedFeature,
} from "./playwrightFeatureRunner.js";
import { runtimeArtifactStatusForError, writeRuntimeFailureArtifact, writeRuntimeRunArtifacts } from "./failureArtifact.js";

export interface PlaywrightRuntimeRunOptions {
    runId: string;
    outputDir: string;
    feature: FeatureScenario;
    storageStatePath: string;
    fixtures: FixtureManifest;
    routeCatalog?: RouteCatalogEntry[];
    baselineEventsPath?: string;
    channel?: "stable" | "ptb" | "canary";
    baseUrl?: string;
    headless?: boolean;
    timeoutMs?: number;
    failOnSecret?: boolean;
    enforceFixtureScope?: boolean;
    captureScreenshots?: boolean;
    captureTrace?: boolean;
    capturePlaywrightEvents?: boolean;
    saveVideo?: boolean;
    saveVideoOnFailure?: boolean;
    recordHar?: boolean;
    playwright?: PlaywrightModuleLike;
    staticSnapshot?: Pick<StaticSnapshot, "build">;
    staticCandidates?: StaticCandidateOptions;
    docsIndex?: DocsIndexEntry[];
}

export interface PlaywrightRuntimeRunResult extends PlaywrightCapturedFeatureRunResult {
    redactedHarPath?: string;
}

interface PlaywrightModuleLike {
    chromium: {
        launch(options: { headless: boolean }): Promise<PlaywrightBrowserLike>;
    };
}

interface PlaywrightBrowserLike {
    newContext(options: Record<string, unknown>): Promise<PlaywrightRuntimeBrowserContextLike>;
    close(): Promise<void>;
}

interface PlaywrightRuntimeBrowserContextLike extends PlaywrightBrowserContextLike {
    newPage(): Promise<PlaywrightRuntimePageLike>;
    close(): Promise<void>;
}

interface PlaywrightRuntimePageLike extends PlaywrightPageLike {
    goto(url: string, options?: Record<string, unknown>): Promise<unknown>;
    waitForLoadState?(state: string, options?: Record<string, unknown>): Promise<unknown>;
    locator?(selector: string): {
        first?(): {
            waitFor?(options?: Record<string, unknown>): Promise<unknown>;
        };
        waitFor?(options?: Record<string, unknown>): Promise<unknown>;
    };
}

export async function runPlaywrightRuntimeFeature(options: PlaywrightRuntimeRunOptions): Promise<PlaywrightRuntimeRunResult> {
    const featureDir = path.join(options.outputDir, "features", options.feature.id);
    await ensureDir(featureDir);
    const rawHarDir = options.recordHar ? await mkdtemp(path.join(tmpdir(), "spacebar-datamining-har-")) : undefined;
    const rawHarPath = rawHarDir ? path.join(rawHarDir, "network.raw.har") : path.join(featureDir, "network.raw.har");
    const redactedHarPath = path.join(featureDir, "network.redacted.har");
    const videoDir = path.join(featureDir, ".video");
    const playwright = options.playwright ?? (await importPlaywright());
    const browser = await playwright.chromium.launch({ headless: options.headless ?? true });
    let context: PlaywrightRuntimeBrowserContextLike | undefined;
    let harFinalized = false;
    let runError: unknown;
    let result: PlaywrightCapturedFeatureRunResult | undefined;
    let video: PlaywrightVideoLike | null | undefined;
    const recordVideo = Boolean(options.saveVideo || options.saveVideoOnFailure !== false);

    try {
        const contextOptions: Record<string, unknown> = {
            storageState: options.storageStatePath,
        };
        if (options.recordHar) {
            contextOptions.recordHar = {
                path: rawHarPath,
                content: "embed",
            };
        }
        if (recordVideo) {
            await ensureDir(videoDir);
            contextOptions.recordVideo = { dir: videoDir };
        }

        context = await browser.newContext(contextOptions);
        const page = await context.newPage();
        video = page.video?.();
        try {
            result = await runPlaywrightCapturedFeature({
                runId: options.runId,
                outputDir: options.outputDir,
                feature: options.feature,
                page,
                browserContext: context,
                fixtures: options.fixtures,
                routeCatalog: options.routeCatalog,
                baselineEventsPath: options.baselineEventsPath,
                failOnSecret: options.failOnSecret,
                enforceFixtureScope: options.enforceFixtureScope,
                captureScreenshots: options.captureScreenshots,
                captureTrace: options.captureTrace,
                capturePlaywrightEvents: options.capturePlaywrightEvents,
                saveVideo: false,
                saveVideoOnFailure: false,
                harPath: options.recordHar ? redactedHarPath : undefined,
                staticSnapshot: options.staticSnapshot,
                staticCandidates: options.staticCandidates,
                docsIndex: options.docsIndex,
                scenarioContext: {
                    gotoChannel: (name) => gotoFixtureChannel(page, options, name),
                    expectReady: () => expectDiscordReady(page, options.timeoutMs),
                },
            });
        } catch (error) {
            runError = error;
        }
    } finally {
        let cleanupError: unknown;
        if (context) {
            try {
                await context.close();
                context = undefined;
            } catch (error) {
                cleanupError ??= error;
            }
        }
        if (video && shouldSaveVideo(options, runError)) {
            try {
                await video.saveAs(path.join(featureDir, "video.webm"));
            } catch (error) {
                cleanupError ??= error;
            }
        }
        if (recordVideo) {
            try {
                await rm(videoDir, { recursive: true, force: true });
            } catch (error) {
                cleanupError ??= error;
            }
        }
        if (options.recordHar && !harFinalized) {
            harFinalized = true;
            try {
                await finalizeHar(rawHarPath, redactedHarPath, options.fixtures, rawHarDir);
            } catch (error) {
                cleanupError ??= error;
            }
        }
        try {
            await browser.close();
        } catch (error) {
            cleanupError ??= error;
        }
        runError ??= cleanupError;
    }

    if (runError) {
        const failurePath = path.join(featureDir, "failure.json");
        await writeRuntimeFailureArtifact(failurePath, {
            runId: options.runId,
            feature: options.feature,
            stage: "runtime",
            error: runError,
            fixtures: options.fixtures,
            artifacts: runtimeArtifactPaths({
                featureDir,
                result,
                recordHar: options.recordHar,
                videoPath: shouldSaveVideo(options, runError) ? path.join(featureDir, "video.webm") : undefined,
                failurePath,
            }),
        });
        await writeRuntimeRunArtifacts(path.join(featureDir, "run-artifacts.json"), {
            status: runtimeArtifactStatusForError(runError),
            ...runtimeArtifactPaths({
                featureDir,
                result,
                recordHar: options.recordHar,
                videoPath: shouldSaveVideo(options, runError) ? path.join(featureDir, "video.webm") : undefined,
                failurePath,
            }),
        });
        throw runError;
    }
    if (!result) {
        const error = new Error(`Feature ${options.feature.id} did not produce runtime artifacts`);
        const failurePath = path.join(featureDir, "failure.json");
        await writeRuntimeFailureArtifact(failurePath, {
            runId: options.runId,
            feature: options.feature,
            stage: "artifact",
            error,
            fixtures: options.fixtures,
            artifacts: runtimeArtifactPaths({ featureDir, result, recordHar: options.recordHar, failurePath }),
        });
        await writeRuntimeRunArtifacts(path.join(featureDir, "run-artifacts.json"), {
            status: "failed",
            ...runtimeArtifactPaths({ featureDir, result, recordHar: options.recordHar, failurePath }),
        });
        throw error;
    }

    return {
        ...result,
        redactedHarPath: options.recordHar ? redactedHarPath : undefined,
        harPath: options.recordHar ? redactedHarPath : result.harPath,
        videoPath: shouldSaveVideo(options, undefined) ? path.join(featureDir, "video.webm") : result.videoPath,
    };
}

function runtimeArtifactPaths(options: { featureDir: string; result?: PlaywrightCapturedFeatureRunResult; recordHar?: boolean; videoPath?: string; failurePath?: string }) {
    return {
        events_path: options.result?.eventsPath ?? path.join(options.featureDir, "events.ndjson"),
        playwright_events_path: options.result?.playwrightEventsPath ?? path.join(options.featureDir, "playwright-events.ndjson"),
        summary_path: options.result?.summaryPath,
        markdown_path: options.result?.markdownPath,
        trace_path: options.result?.tracePath ?? path.join(options.featureDir, "trace.zip"),
        screenshots_dir: options.result?.screenshotsDir ?? path.join(options.featureDir, "screenshots"),
        video_path: options.videoPath,
        redacted_har_path: options.recordHar ? path.join(options.featureDir, "network.redacted.har") : undefined,
        failure_path: options.failurePath,
    };
}

function shouldSaveVideo(options: PlaywrightRuntimeRunOptions, runError: unknown): boolean {
    return Boolean(options.saveVideo || (runError && options.saveVideoOnFailure !== false));
}

async function finalizeHar(rawHarPath: string, redactedHarPath: string, fixtures: FixtureManifest, cleanupDir?: string): Promise<void> {
    try {
        let rawHar: unknown;
        try {
            rawHar = await readJsonFile(rawHarPath);
        } catch (error) {
            const nodeError = error as NodeJS.ErrnoException;
            if (nodeError.code === "ENOENT") {
                return;
            }
            throw error;
        }
        await writeJsonFile(redactedHarPath, sanitizeHar(rawHar, { fixtures }));
    } finally {
        await rm(rawHarPath, { force: true });
        if (cleanupDir) {
            await rm(cleanupDir, { recursive: true, force: true });
        }
    }
}

async function importPlaywright(): Promise<PlaywrightModuleLike> {
    const specifier = "playwright";
    let module: unknown;
    try {
        module = await import(specifier);
    } catch (error) {
        const cause = error instanceof Error ? error.message : String(error);
        throw new Error(`run-playwright-feature requires the optional "playwright" package to be installed locally: ${cause}`);
    }

    if (!isRecord(module) || !isRecord(module.chromium) || typeof module.chromium.launch !== "function") {
        throw new Error('Optional "playwright" package did not expose chromium.launch');
    }

    return module as unknown as PlaywrightModuleLike;
}

async function gotoFixtureChannel(
    page: PlaywrightRuntimePageLike,
    options: Pick<PlaywrightRuntimeRunOptions, "fixtures" | "baseUrl" | "channel" | "timeoutMs">,
    name: string,
): Promise<void> {
    const channelId = fixtureStringAtPath(options.fixtures, `channels.${name}`);
    if (!channelId) {
        throw new Error(`Cannot navigate to fixture channel "${name}" because fixtures.channels.${name} is missing`);
    }

    const guildId = typeof options.fixtures.guild === "string" ? options.fixtures.guild : undefined;
    const baseUrl = options.baseUrl ?? baseUrlForChannel(options.channel ?? "canary");
    const channelPath = name === "dm" || !guildId ? `/channels/@me/${channelId}` : `/channels/${guildId}/${channelId}`;
    await page.goto(`${baseUrl}${channelPath}`, {
        waitUntil: "domcontentloaded",
        timeout: options.timeoutMs,
    });
}

async function expectDiscordReady(page: PlaywrightRuntimePageLike, timeoutMs = 30_000): Promise<void> {
    await page.waitForLoadState?.("domcontentloaded", { timeout: timeoutMs });
    const locator = page.locator?.('[role="textbox"], [data-list-id="guildsnav"], [aria-label*="Servers"]');
    const target = locator?.first?.() ?? locator;
    await target?.waitFor?.({
        state: "attached",
        timeout: timeoutMs,
    });
}

function baseUrlForChannel(channel: "stable" | "ptb" | "canary"): string {
    switch (channel) {
        case "stable":
            return "https://discord.com";
        case "ptb":
            return "https://ptb.discord.com";
        case "canary":
            return "https://canary.discord.com";
        default:
            return "https://canary.discord.com";
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
