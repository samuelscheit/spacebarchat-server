import { writeFile } from "node:fs/promises";
import path from "node:path";

import type { DocsIndexEntry } from "../collectors/static/docsIndex.js";
import { FixtureManifest } from "../fixtures/manifest.js";
import { StaticCandidateOptions } from "../processors/staticCandidates.js";
import { FeatureRunContext, FeatureScenario } from "../scenarios/feature.js";
import { RouteCatalogEntry, StaticSnapshot } from "../types.js";
import { ensureDir } from "../util/fs.js";
import { CdpSessionLike } from "./cdpNetworkRecorder.js";
import { CapturedFeatureRunResult, runCapturedFeature } from "./featureRunner.js";
import { createPlaywrightConvenienceRecorder, PlaywrightEventEmitterLike } from "./playwrightConvenienceRecorder.js";

export interface PlaywrightVideoLike {
    saveAs(path: string): Promise<void>;
}

export interface PlaywrightPageLike extends NonNullable<FeatureRunContext["page"]>, Partial<PlaywrightEventEmitterLike> {
    screenshot(options: { path: string; fullPage?: boolean }): Promise<unknown>;
    video?(): PlaywrightVideoLike | null;
}

export interface PlaywrightBrowserContextLike {
    newCDPSession(page: PlaywrightPageLike): Promise<CdpSessionLike>;
    tracing?: {
        start(options?: Record<string, unknown>): Promise<void>;
        stop(options: { path: string }): Promise<void>;
    };
}

export interface PlaywrightCapturedFeatureRunOptions {
    runId: string;
    outputDir: string;
    feature: FeatureScenario;
    page: PlaywrightPageLike;
    browserContext: PlaywrightBrowserContextLike;
    scenarioContext?: Partial<Omit<FeatureRunContext, "step" | "run_id" | "page">>;
    fixtures?: FixtureManifest;
    routeCatalog?: RouteCatalogEntry[];
    baselineEventsPath?: string;
    failOnSecret?: boolean;
    enforceFixtureScope?: boolean;
    captureScreenshots?: boolean;
    captureTrace?: boolean;
    capturePlaywrightEvents?: boolean;
    saveVideo?: boolean;
    saveVideoOnFailure?: boolean;
    harPath?: string;
    staticSnapshot?: Pick<StaticSnapshot, "build">;
    staticCandidates?: StaticCandidateOptions;
    docsIndex?: DocsIndexEntry[];
}

export interface PlaywrightCapturedFeatureRunResult extends CapturedFeatureRunResult {
    tracePath?: string;
    harPath?: string;
    videoPath?: string;
    screenshotsDir?: string;
    playwrightEventsPath?: string;
}

export async function runPlaywrightCapturedFeature(options: PlaywrightCapturedFeatureRunOptions): Promise<PlaywrightCapturedFeatureRunResult> {
    const featureDir = path.join(options.outputDir, "features", options.feature.id);
    await ensureDir(featureDir);
    const screenshotsDir = path.join(featureDir, "screenshots");
    const tracePath = path.join(featureDir, "trace.zip");
    const videoPath = path.join(featureDir, "video.webm");
    const playwrightEventsPath = path.join(featureDir, "playwright-events.ndjson");
    const captureTrace = options.captureTrace ?? false;
    const captureScreenshots = options.captureScreenshots ?? true;
    const capturePlaywrightEvents = (options.capturePlaywrightEvents ?? true) && typeof options.page.on === "function";
    const stepStack: string[] = [];

    if (captureScreenshots) {
        await ensureDir(screenshotsDir);
    }
    if (captureTrace) {
        await options.browserContext.tracing?.start({
            screenshots: true,
            snapshots: true,
            sources: true,
        });
    }

    const cdp = await options.browserContext.newCDPSession(options.page);
    const playwrightRecorder = capturePlaywrightEvents
        ? createPlaywrightConvenienceRecorder({
              runId: options.runId,
              featureId: options.feature.id,
              page: options.page as PlaywrightEventEmitterLike,
              outputPath: playwrightEventsPath,
              fixtures: options.fixtures,
              failOnSecret: options.failOnSecret,
              getCurrentStep: () => stepStack.at(-1),
          })
        : undefined;
    let screenshotIndex = 0;
    let failed = false;

    try {
        await playwrightRecorder?.start();
        const result = await runCapturedFeature({
            runId: options.runId,
            outputDir: options.outputDir,
            feature: options.feature,
            cdp,
            context: {
                ...options.scenarioContext,
                page: options.page,
            },
            fixtures: options.fixtures,
            routeCatalog: options.routeCatalog,
            baselineEventsPath: options.baselineEventsPath,
            failOnSecret: options.failOnSecret,
            enforceFixtureScope: options.enforceFixtureScope,
            staticSnapshot: options.staticSnapshot,
            staticCandidates: options.staticCandidates,
            docsIndex: options.docsIndex,
            async onStepStart(stepId) {
                stepStack.push(stepId);
                if (captureScreenshots) {
                    screenshotIndex += 1;
                    await options.page.screenshot({
                        path: path.join(screenshotsDir, screenshotName(screenshotIndex, stepId, "start")),
                        fullPage: true,
                    });
                }
            },
            async onStepEnd(stepId) {
                if (captureScreenshots) {
                    screenshotIndex += 1;
                    await options.page.screenshot({
                        path: path.join(screenshotsDir, screenshotName(screenshotIndex, stepId, "end")),
                        fullPage: true,
                    });
                }
                const stackIndex = stepStack.lastIndexOf(stepId);
                if (stackIndex >= 0) {
                    stepStack.splice(stackIndex, 1);
                }
            },
        });

        return {
            ...result,
            tracePath: captureTrace ? tracePath : undefined,
            harPath: options.harPath,
            videoPath: options.saveVideo ? videoPath : undefined,
            screenshotsDir: captureScreenshots ? screenshotsDir : undefined,
            playwrightEventsPath: capturePlaywrightEvents ? playwrightEventsPath : undefined,
        };
    } catch (error) {
        failed = true;
        throw error;
    } finally {
        await playwrightRecorder?.stop();
        if (captureTrace) {
            await options.browserContext.tracing?.stop({ path: tracePath });
        }
        if (options.saveVideo || (options.saveVideoOnFailure && failed)) {
            const video = options.page.video?.();
            if (video) {
                await video.saveAs(videoPath);
            } else {
                await writeFile(videoPath, "");
            }
        }
    }
}

function screenshotName(index: number, stepId: string, phase: "start" | "end"): string {
    const safeStepId = stepId.replace(/[^a-zA-Z0-9._-]/g, "_");
    return `${String(index).padStart(3, "0")}-${safeStepId}-${phase}.png`;
}
