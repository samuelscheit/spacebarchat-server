import path from "node:path";

import type { DocsIndexEntry } from "../collectors/static/docsIndex.js";
import { FixtureManifest, fixtureStringAtPath, validateDisposableFixtures } from "../fixtures/manifest.js";
import { correlateFeatureTraffic } from "../processors/correlate.js";
import { attachStaticCandidates, StaticCandidateOptions } from "../processors/staticCandidates.js";
import { writeFeatureReport } from "../reports/featureReport.js";
import { FeatureRunContext, FeatureScenario } from "../scenarios/feature.js";
import { CaptureEvent, FeatureSummary, RouteCatalogEntry, StaticSnapshot } from "../types.js";
import { ensureDir } from "../util/fs.js";
import { CdpNetworkRecorder, CdpSessionLike, RuntimeSafetyGateOptions } from "./cdpNetworkRecorder.js";
import { readNdjsonEvents } from "./eventsFile.js";
import { RuntimeExpectationTracker } from "./expectations.js";
import { writeRuntimeFailureArtifact } from "./failureArtifact.js";
import { NdjsonEventWriter } from "./ndjson.js";

export interface CapturedFeatureRunOptions {
    runId: string;
    outputDir: string;
    feature: FeatureScenario;
    cdp: CdpSessionLike;
    context?: Partial<Omit<FeatureRunContext, "step" | "run_id">>;
    fixtures?: FixtureManifest;
    routeCatalog?: RouteCatalogEntry[];
    baselineEventsPath?: string;
    failOnSecret?: boolean;
    enforceFixtureScope?: boolean;
    safetyGates?: RuntimeSafetyGateOptions;
    staticSnapshot?: Pick<StaticSnapshot, "build">;
    staticCandidates?: StaticCandidateOptions;
    docsIndex?: DocsIndexEntry[];
    onStepStart?: (stepId: string, title: string) => Promise<void> | void;
    onStepEnd?: (stepId: string, title: string) => Promise<void> | void;
}

export interface CapturedFeatureRunResult {
    eventsPath: string;
    summary: FeatureSummary;
    summaryPath: string;
    markdownPath: string;
}

export async function runCapturedFeature(options: CapturedFeatureRunOptions): Promise<CapturedFeatureRunResult> {
    assertDisposableFixtureSafety(options.feature, options.fixtures);
    const featureDir = path.join(options.outputDir, "features", options.feature.id);
    await ensureDir(featureDir);
    const eventsPath = path.join(featureDir, "events.ndjson");
    const expectations = new RuntimeExpectationTracker();
    const writer = await NdjsonEventWriter.open({
        filePath: eventsPath,
        fixtures: options.fixtures,
        failOnSecret: options.failOnSecret,
    });
    const recordedEvents: CaptureEvent[] = [];
    const stepStack: string[] = [];
    const activeStep = () => stepStack.at(-1);
    const recorder = new CdpNetworkRecorder({
        cdp: options.cdp,
        runId: options.runId,
        feature: options.feature,
        fixtures: options.fixtures,
        routeCatalog: options.routeCatalog,
        enforceFixtureScope: options.enforceFixtureScope,
        safetyGates: options.safetyGates,
        async onEvent(event) {
            recordedEvents.push(event);
            expectations.observe(event);
            await writer.write(event);
        },
    });

    let runError: unknown;
    try {
        await recorder.start();
        const context: FeatureRunContext = {
            ...options.context,
            run_id: options.runId,
            fixture(fixturePath) {
                const contextValue = options.context?.fixture?.(fixturePath);
                if (typeof contextValue === "string") {
                    return contextValue;
                }

                const value = fixtureStringAtPath(options.fixtures, fixturePath);
                if (!value) {
                    throw new Error(`Feature ${options.feature.id} requires fixture ${fixturePath}`);
                }
                return value;
            },
            async gotoChannel(name) {
                await recorder.action({
                    action: "goto-channel",
                    target: `fixture-channel:${name}`,
                });
                if (!options.context?.gotoChannel) {
                    throw new Error("Feature context did not provide gotoChannel");
                }
                await options.context.gotoChannel(name);
            },
            async expectReady() {
                await recorder.action({ action: "expect-ready" });
                if (!options.context?.expectReady) {
                    throw new Error("Feature context did not provide expectReady");
                }
                await options.context.expectReady();
            },
            async expectNetwork(expectation) {
                await recorder.action({
                    action: "expect-network",
                    target: `${expectation.method} ${expectation.route}`,
                });
                if (options.context?.expectNetwork) {
                    await options.context.expectNetwork(expectation);
                    return;
                }
                await expectations.waitForNetwork({ ...expectation, step_id: activeStep() });
            },
            async expectGateway(expectation) {
                await recorder.action({
                    action: "expect-gateway",
                    target: expectation.event ?? `opcode ${expectation.opcode ?? "unknown"}`,
                    detail: expectation.direction,
                });
                if (options.context?.expectGateway) {
                    await options.context.expectGateway(expectation);
                    return;
                }
                await expectations.waitForGateway({ ...expectation, step_id: activeStep() });
            },
            recordAction(action) {
                return recorder.action(action);
            },
            step(stepId, title, run) {
                return recorder.step(stepId, title, async () => {
                    stepStack.push(stepId);
                    try {
                        await options.onStepStart?.(stepId, title);
                        return await run();
                    } finally {
                        await options.onStepEnd?.(stepId, title);
                        stepStack.pop();
                    }
                });
            },
        };
        await options.feature.run(context);
    } catch (error) {
        runError = error;
    }

    let flushError: unknown;
    try {
        await recorder.flush();
    } catch (error) {
        flushError = error;
    }
    let closeError: unknown;
    try {
        await writer.close();
    } catch (error) {
        closeError = error;
    }
    const failureError = runError ?? flushError ?? closeError;
    if (failureError) {
        await writeRuntimeFailureArtifact(path.join(featureDir, "failure.json"), {
            runId: options.runId,
            feature: options.feature,
            stage: "runtime",
            error: failureError,
            fixtures: options.fixtures,
            artifacts: {
                events_path: eventsPath,
            },
        });
        throw failureError;
    }

    const baselineEvents = options.baselineEventsPath ? await readNdjsonEvents(options.baselineEventsPath) : undefined;
    let summary = correlateFeatureTraffic({
        feature: options.feature,
        events: recordedEvents,
        baselineEvents,
    });
    if (options.staticCandidates) {
        summary = await attachStaticCandidates(summary, options.staticCandidates);
    }
    const report = await writeFeatureReport(featureDir, {
        summary,
        staticSnapshot: options.staticSnapshot,
        fixtures: options.fixtures,
        docsIndex: options.docsIndex,
    });

    return {
        eventsPath,
        summary,
        ...report,
    };
}

function assertDisposableFixtureSafety(feature: FeatureScenario, fixtures: FixtureManifest | undefined): void {
    const requiredDisposableFixtures = feature.safety?.requiredDisposableFixtures ?? [];
    if (requiredDisposableFixtures.length === 0) {
        return;
    }

    if (!fixtures) {
        throw new Error(`Feature ${feature.id} requires disposable fixtures: ${requiredDisposableFixtures.join(", ")}`);
    }

    const validation = validateDisposableFixtures(fixtures, requiredDisposableFixtures);
    if (!validation.ok) {
        const violations = [
            ...validation.missing.map((fixture) => `missing_disposable_fixture:${fixture}`),
            ...validation.not_disposable.map((fixture) => `fixture_not_disposable:${fixture}`),
        ];
        throw new Error(`Feature ${feature.id} cannot run without disposable fixture targets: ${violations.join(", ")}`);
    }
}
