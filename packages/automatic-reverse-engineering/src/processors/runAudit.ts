import { access, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { getBuiltInScenario } from "../scenarios/registry.js";
import { CaptureEvent, FeatureDefinition, FeatureSummary } from "../types.js";
import { readJsonFile } from "../util/fs.js";
import { sha256 } from "../util/hash.js";
import { isRecord } from "../util/json.js";
import { scanForSecrets } from "./redact.js";
import { auditRedactionPaths, RedactionAuditResult } from "./redactionAudit.js";

export interface AuditRunOptions {
    runDir: string;
    requireStatic?: boolean;
    requireRuntime?: boolean;
    requiredFeatureIds?: string[];
    redactionAuditPath?: string;
    coverageDir?: string;
    reviewQueuePath?: string;
}

export interface RunAuditCheck {
    id: string;
    ok: boolean;
    path?: string;
    message?: string;
}

export interface StaticRunAudit {
    ok: boolean;
    assets_count: number;
    downloaded_assets_count: number;
    catalog_counts: Record<string, number>;
    checks: RunAuditCheck[];
}

export interface RuntimeFeatureAudit {
    feature_id: string;
    ok: boolean;
    event_counts: Record<string, number>;
    traffic_count: number;
    http_traffic_count: number;
    gateway_traffic_count: number;
    checks: RunAuditCheck[];
}

export interface RuntimeRunAudit {
    ok: boolean;
    feature_count: number;
    features: RuntimeFeatureAudit[];
    checks: RunAuditCheck[];
}

export interface RunAuditReport {
    ok: boolean;
    run_dir: string;
    checked_at: string;
    static: StaticRunAudit;
    runtime: RuntimeRunAudit;
    redaction: RedactionAuditResult;
    redaction_artifact: {
        ok: boolean;
        checks: RunAuditCheck[];
    };
    coverage?: {
        ok: boolean;
        checks: RunAuditCheck[];
    };
    review_queue?: {
        ok: boolean;
        checks: RunAuditCheck[];
    };
    violations: string[];
}

type ExpectedHttpTraffic = NonNullable<NonNullable<FeatureDefinition["expected"]>["http"]>[number];

const requiredStaticFiles = [
    "build.json",
    "login.html",
    "assets.json",
    "context.manifest.json",
    "routes.catalog.json",
    "routes.source.catalog.json",
    "gateway.catalog.json",
    "experiments.catalog.json",
    "docs.index.json",
    "routes.xhyrom.catalog.json",
    "experiments.xhyrom.catalog.json",
    "routes.userdoccers.catalog.json",
    "gateway.userdoccers.catalog.json",
] as const;

const requiredFeatureFiles = [
    "preflight.json",
    "events.ndjson",
    "playwright-events.ndjson",
    "summary.json",
    "report.md",
    "run-artifacts.json",
    "network.redacted.har",
    "trace.zip",
] as const;

export async function auditDataminingRun(options: AuditRunOptions): Promise<RunAuditReport> {
    const requireStatic = options.requireStatic ?? true;
    const requireRuntime = options.requireRuntime ?? true;
    const staticAudit = requireStatic ? await auditStaticRun(options.runDir) : emptyStaticAudit("static audit disabled");
    const runtimeAudit = requireRuntime ? await auditRuntimeRun(options.runDir, options.requiredFeatureIds) : emptyRuntimeAudit("runtime audit disabled");
    const redaction = await auditRedactionPaths(await existingRedactionPaths(deduplicateRedactionPaths([options.runDir, options.coverageDir, options.reviewQueuePath])));
    const redactionArtifact = await auditRedactionArtifact(options.redactionAuditPath ?? path.join(options.runDir, "redaction-audit.json"));
    const coverage = options.coverageDir ? await auditCoverageArtifacts(options.coverageDir) : undefined;
    const reviewQueue = options.reviewQueuePath ? await auditReviewQueueArtifact(options.reviewQueuePath) : undefined;
    const violations = [
        ...checksToViolations(staticAudit.checks, "static"),
        ...checksToViolations(runtimeAudit.checks, "runtime"),
        ...runtimeAudit.features.flatMap((feature) => checksToViolations(feature.checks, `runtime.${feature.feature_id}`)),
        ...checksToViolations(redactionArtifact.checks, "redaction_artifact"),
        ...(redaction.ok ? [] : redaction.violations.map((violation) => `redaction:${violation.file}`)),
        ...(coverage ? checksToViolations(coverage.checks, "coverage") : []),
        ...(reviewQueue ? checksToViolations(reviewQueue.checks, "review_queue") : []),
    ];

    return {
        ok: violations.length === 0,
        run_dir: options.runDir,
        checked_at: new Date().toISOString(),
        static: staticAudit,
        runtime: runtimeAudit,
        redaction,
        redaction_artifact: redactionArtifact,
        coverage,
        review_queue: reviewQueue,
        violations,
    };
}

async function auditStaticRun(runDir: string): Promise<StaticRunAudit> {
    const staticDir = path.join(runDir, "static");
    const checks: RunAuditCheck[] = [];
    for (const fileName of requiredStaticFiles) {
        checks.push(await fileExistsCheck(path.join(staticDir, fileName), `static.file.${fileName}`));
    }

    const assetsPath = path.join(staticDir, "assets.json");
    const assetsAudit = await readJsonArrayAudit(assetsPath, "static.assets.array", "assets.json must be a JSON array");
    checks.push(assetsAudit.check);
    const assets = assetsAudit.entries;
    const buildPath = path.join(staticDir, "build.json");
    const buildAudit = await readJsonValueAudit(buildPath, "static.build.parse", "build.json must parse as JSON");
    checks.push(buildAudit.check);
    const build = isRecord(buildAudit.value) ? buildAudit.value : undefined;
    const contextManifestPath = path.join(staticDir, "context.manifest.json");
    const contextManifestAudit = await readJsonValueAudit(contextManifestPath, "static.context.parse", "context.manifest.json must parse as JSON");
    checks.push(contextManifestAudit.check);
    const contextManifestValue = contextManifestAudit.value;
    const contextManifest = isRecord(contextManifestValue) ? contextManifestValue : undefined;
    const catalogCounts: Record<string, number> = {};

    if (assets) {
        checks.push({
            id: "static.assets.non_empty",
            ok: assets.length > 0,
            path: path.join(staticDir, "assets.json"),
            message: assets.length > 0 ? undefined : "assets.json has no entries",
        });
        const downloadedAssets = assets.filter(hasLocalPathAsset);
        checks.push({
            id: "static.assets.downloaded",
            ok: downloadedAssets.length > 0,
            path: path.join(staticDir, "assets.json"),
            message: downloadedAssets.length > 0 ? undefined : "assets.json has no downloaded asset local_path entries",
        });
        for (const asset of downloadedAssets) {
            const localPath = String(asset.local_path);
            checks.push(await fileExistsCheck(path.join(staticDir, localPath), `static.asset_file.${path.basename(localPath)}`));
            checks.push(...(await assetLocalIntegrityChecks(staticDir, asset)));
        }
    }

    if (build) {
        checks.push({
            id: "static.build.run_id",
            ok: typeof build.run_id === "string" && build.run_id.length > 0,
            path: path.join(staticDir, "build.json"),
            message: "build.json must include run_id",
        });
        checks.push({
            id: "static.build.identity",
            ok: Boolean(build.x_build_id ?? build.build_number ?? build.version_hash),
            path: path.join(staticDir, "build.json"),
            message: "build.json must include x_build_id, build_number, or version_hash",
        });
    }

    checks.push({
        id: "static.context.shape",
        ok: isRecord(contextManifestValue),
        path: contextManifestPath,
        message: "context.manifest.json must be a JSON object",
    });
    if (contextManifest) {
        checks.push({
            id: "static.context.files",
            ok: Array.isArray(contextManifest.files) && contextManifest.files.length > 0,
            path: contextManifestPath,
            message: "context.manifest.json must include copied catalog files",
        });
        checks.push(...(await staticContextManifestFileChecks(staticDir, contextManifest.files)));
        checks.push({
            id: "static.context.source_refs",
            ok: isRecord(contextManifest.source_refs) && Object.keys(contextManifest.source_refs).length > 0,
            path: contextManifestPath,
            message: "context.manifest.json must include source refs",
        });
    }

    for (const { fileName, count, parseCheck } of await readStaticCatalogCounts(staticDir)) {
        checks.push(parseCheck);
        catalogCounts[fileName] = count;
        checks.push({
            id: `static.catalog.${fileName}`,
            ok: count > 0 || fileName === "experiments.catalog.json",
            path: path.join(staticDir, fileName),
            message: count > 0 ? undefined : `${fileName} has no entries`,
        });
    }

    return {
        ok: checks.every((check) => check.ok),
        assets_count: assets?.length ?? 0,
        downloaded_assets_count: assets?.filter((asset) => isRecord(asset) && typeof asset.local_path === "string").length ?? 0,
        catalog_counts: catalogCounts,
        checks,
    };
}

async function auditRuntimeRun(runDir: string, requiredFeatureIds: string[] | undefined): Promise<RuntimeRunAudit> {
    const featuresDir = path.join(runDir, "features");
    const checks: RunAuditCheck[] = [];
    const featuresDirCheck = await directoryExistsCheck(featuresDir, "runtime.features_dir");
    checks.push(featuresDirCheck);
    if (!featuresDirCheck.ok) {
        return {
            ok: false,
            feature_count: 0,
            features: [],
            checks,
        };
    }

    const discoveredFeatureIds = await discoverFeatureIds(featuresDir);
    const featureIds = requiredFeatureIds && requiredFeatureIds.length > 0 ? Array.from(new Set(requiredFeatureIds)).sort() : discoveredFeatureIds;
    checks.push({
        id: "runtime.features.present",
        ok: featureIds.length > 0,
        path: featuresDir,
        message: "runtime audit requires at least one feature directory or required feature id",
    });
    for (const featureId of requiredFeatureIds ?? []) {
        checks.push({
            id: `runtime.feature.required.${featureId}`,
            ok: discoveredFeatureIds.includes(featureId),
            path: path.join(featuresDir, featureId),
            message: `required feature ${featureId} was not captured`,
        });
    }

    const expectedRunId = await readStaticRunId(runDir);
    const features = await Promise.all(featureIds.map((featureId) => auditRuntimeFeature(runDir, featureId, expectedRunId)));
    return {
        ok: checks.every((check) => check.ok) && features.every((feature) => feature.ok),
        feature_count: features.length,
        features,
        checks,
    };
}

async function auditRuntimeFeature(runDir: string, featureId: string, expectedRunId: string | undefined): Promise<RuntimeFeatureAudit> {
    const featureDir = path.join(runDir, "features", featureId);
    const checks: RunAuditCheck[] = [];
    for (const fileName of requiredFeatureFiles) {
        checks.push(await fileExistsCheck(path.join(featureDir, fileName), `runtime.feature.file.${fileName}`));
    }
    checks.push(await absentFileCheck(path.join(featureDir, "network.raw.har"), "runtime.feature.raw_har_absent"));
    checks.push(
        await absentFileCheck(
            path.join(featureDir, "network.har"),
            "runtime.feature.network_har_absent",
            "raw network.har must not remain in durable feature output; keep only network.redacted.har",
        ),
    );
    checks.push(...(await unexpectedHarFileChecks(featureDir)));
    checks.push(
        await absentFileCheck(
            path.join(featureDir, "failure.json"),
            "runtime.feature.failure_absent",
            "failure.json marks the feature as quarantined; complete audit requires a successful scenario",
        ),
    );
    checks.push(await directoryHasFilesCheck(path.join(featureDir, "screenshots"), "runtime.feature.screenshots"));
    checks.push(await zipSignatureCheck(path.join(featureDir, "trace.zip"), "runtime.feature.trace_zip"));

    const eventsAudit = await readNdjsonAudit(path.join(featureDir, "events.ndjson"), "runtime.feature.events.parse");
    const playwrightEventsAudit = await readNdjsonAudit(path.join(featureDir, "playwright-events.ndjson"), "runtime.feature.playwright_events.parse");
    checks.push(eventsAudit.check, playwrightEventsAudit.check);
    const events = eventsAudit.events;
    const playwrightEvents = playwrightEventsAudit.events;
    const mitmproxyEventsAudit = await readOptionalNdjsonAudit(path.join(featureDir, "mitmproxy.redacted.ndjson"), "runtime.feature.mitmproxy_events.parse");
    if (mitmproxyEventsAudit) {
        checks.push(mitmproxyEventsAudit.check);
    }
    const mitmproxyEvents = mitmproxyEventsAudit?.events;
    const summaryPath = path.join(featureDir, "summary.json");
    const summaryValueAudit = await readJsonValueAudit(summaryPath, "runtime.feature.summary.parse", "summary.json must parse as JSON");
    checks.push(summaryValueAudit.check);
    const summaryValue = summaryValueAudit.value;
    const summaryAudit = featureSummaryShapeAudit(summaryPath, featureId, summaryValue);
    checks.push(...summaryAudit.checks);
    const summary = summaryAudit.summary;
    const preflightPath = path.join(featureDir, "preflight.json");
    const preflightAudit = await readJsonValueAudit(preflightPath, "runtime.feature.preflight.parse", "preflight.json must parse as JSON");
    checks.push(preflightAudit.check);
    const preflight = preflightAudit.value;
    const failurePath = path.join(featureDir, "failure.json");
    const failureAudit = await readOptionalJsonValueAudit(failurePath, "runtime.feature.failure.parse", "failure.json must parse as JSON");
    if (failureAudit) {
        checks.push(failureAudit.check);
    }
    const failure = failureAudit?.value;
    const runArtifactsPath = path.join(featureDir, "run-artifacts.json");
    const runArtifactsAudit = await readJsonValueAudit(runArtifactsPath, "runtime.feature.run_artifacts.parse", "run-artifacts.json must parse as JSON");
    checks.push(runArtifactsAudit.check);
    const runArtifacts = runArtifactsAudit.value;
    const eventCounts = countEvents(events ?? []);
    const playwrightEventCounts = countEvents(playwrightEvents ?? []);
    const expected = expectedTrafficFor(featureId, summary);
    const expectedEventRunId = expectedRunId ?? summary?.run_id;
    const requiresHttpEvidence = !expected || (expected.http?.length ?? 0) > 0;
    const requiresGatewayEvidence = !expected || (expected.gateway?.length ?? 0) > 0;
    if (typeof runArtifacts !== "undefined") {
        checks.push({
            id: "runtime.feature.run_artifacts.status",
            ok: isRecord(runArtifacts) && runArtifacts.status === "passed",
            path: runArtifactsPath,
            message: "complete runtime audit requires run-artifacts.json status to be passed",
        });
        checks.push(...(await runtimeArtifactManifestChecks(featureDir, runArtifacts)));
    }
    if (typeof failure !== "undefined") {
        checks.push({
            id: "runtime.feature.failure.shape",
            ok: isRecord(failure),
            path: failurePath,
            message: "failure.json must be a redacted runtime failure object",
        });
    }
    if (isRecord(failure)) {
        checks.push({
            id: "runtime.feature.failure.quarantine",
            ok: failure.quarantine === true,
            path: failurePath,
            message: "failure.json must mark the feature as quarantined",
        });
        checks.push({
            id: "runtime.feature.failure.redacted",
            ok: failure.redacted === true && scanForSecrets(failure).ok,
            path: failurePath,
            message: "failure.json must be explicitly redacted and contain no secret-looking values",
        });
        checks.push(...(await runtimeArtifactPathChecks(failurePath, "runtime.feature.failure.artifacts", failure.artifacts)));
    }
    if (typeof preflight !== "undefined") {
        checks.push(...preflightReportChecks(preflightPath, featureId, preflight));
    }
    if (events) {
        checks.push(...eventStreamIdentityChecks(path.join(featureDir, "events.ndjson"), "runtime.feature.events", events, featureId, expectedEventRunId));
        checks.push({
            id: "runtime.feature.events.non_empty",
            ok: events.length > 0,
            path: path.join(featureDir, "events.ndjson"),
            message: "events.ndjson must include captured events",
        });
        checks.push({
            id: "runtime.feature.events.steps",
            ok: Boolean(eventCounts["step.start"] && eventCounts["step.end"] && eventCounts["step.start"] === eventCounts["step.end"]),
            path: path.join(featureDir, "events.ndjson"),
            message: "events.ndjson must include balanced step.start and step.end markers",
        });
        checks.push(...eventStepIntegrityChecks(path.join(featureDir, "events.ndjson"), events));
        checks.push(...eventLifecycleIntegrityChecks(path.join(featureDir, "events.ndjson"), "runtime.feature.events", events, primaryLifecycleKinds));
        checks.push({
            id: "runtime.feature.events.ui_action",
            ok: Boolean(eventCounts["ui.action"]),
            path: path.join(featureDir, "events.ndjson"),
            message: "events.ndjson must include redacted ui.action entries for step-by-step UI provenance",
        });
        checks.push({
            id: "runtime.feature.events.http",
            ok: !requiresHttpEvidence || hasEventPrefix(eventCounts, "http."),
            path: path.join(featureDir, "events.ndjson"),
            message: "events.ndjson must include CDP HTTP evidence when feature declares HTTP expectations",
        });
        checks.push({
            id: "runtime.feature.events.websocket",
            ok: !requiresGatewayEvidence || hasEventPrefix(eventCounts, "ws."),
            path: path.join(featureDir, "events.ndjson"),
            message: "events.ndjson must include CDP WebSocket evidence when feature declares Gateway expectations",
        });
        checks.push({
            id: "runtime.feature.events.no_abort",
            ok: !eventCounts["runtime.abort"],
            path: path.join(featureDir, "events.ndjson"),
            message: "runtime.abort means the capture must remain quarantined",
        });
        checks.push(...expectedCdpEvidenceChecks(featureDir, events, expected));
        checks.push(...(await screenshotArtifactChecks(path.join(featureDir, "screenshots"), events, eventCounts)));
    }

    if (playwrightEvents) {
        checks.push(
            ...eventStreamIdentityChecks(path.join(featureDir, "playwright-events.ndjson"), "runtime.feature.playwright_events", playwrightEvents, featureId, expectedEventRunId),
        );
        checks.push({
            id: "runtime.feature.playwright_events.non_empty",
            ok: (!requiresHttpEvidence && !requiresGatewayEvidence) || playwrightEvents.length > 0,
            path: path.join(featureDir, "playwright-events.ndjson"),
            message: "playwright-events.ndjson must include supporting capture events when feature declares traffic expectations",
        });
        checks.push({
            id: "runtime.feature.playwright_events.http",
            ok: !requiresHttpEvidence || Boolean(playwrightEventCounts["playwright.http.request"] && playwrightEventCounts["playwright.http.response"]),
            path: path.join(featureDir, "playwright-events.ndjson"),
            message: "playwright-events.ndjson must include request and response evidence when feature declares HTTP expectations",
        });
        checks.push({
            id: "runtime.feature.playwright_events.websocket",
            ok: !requiresGatewayEvidence || hasEventPrefix(playwrightEventCounts, "playwright.ws.frame."),
            path: path.join(featureDir, "playwright-events.ndjson"),
            message: "playwright-events.ndjson must include WebSocket frame evidence when feature declares Gateway expectations",
        });
        checks.push(
            ...eventLifecycleIntegrityChecks(path.join(featureDir, "playwright-events.ndjson"), "runtime.feature.playwright_events", playwrightEvents, playwrightLifecycleKinds),
        );
        checks.push(...expectedPlaywrightEvidenceChecks(featureDir, playwrightEvents, expected));
    }

    if (mitmproxyEvents) {
        const mitmproxyEventCounts = countEvents(mitmproxyEvents);
        checks.push(
            ...eventStreamIdentityChecks(path.join(featureDir, "mitmproxy.redacted.ndjson"), "runtime.feature.mitmproxy_events", mitmproxyEvents, featureId, expectedEventRunId),
        );
        checks.push({
            id: "runtime.feature.mitmproxy_events.non_empty",
            ok: mitmproxyEvents.length > 0,
            path: path.join(featureDir, "mitmproxy.redacted.ndjson"),
            message: "mitmproxy.redacted.ndjson must include redacted secondary validation events when present",
        });
        checks.push({
            id: "runtime.feature.mitmproxy_events.http",
            ok: !requiresHttpEvidence || Boolean(mitmproxyEventCounts["http.request"] && mitmproxyEventCounts["http.response"]),
            path: path.join(featureDir, "mitmproxy.redacted.ndjson"),
            message: "mitmproxy.redacted.ndjson must include request and response evidence when feature declares HTTP expectations",
        });
        checks.push({
            id: "runtime.feature.mitmproxy_events.websocket",
            ok: !requiresGatewayEvidence || hasEventPrefix(mitmproxyEventCounts, "ws.frame."),
            path: path.join(featureDir, "mitmproxy.redacted.ndjson"),
            message: "mitmproxy.redacted.ndjson must include WebSocket frame evidence when feature declares Gateway expectations",
        });
        checks.push(
            ...eventLifecycleIntegrityChecks(path.join(featureDir, "mitmproxy.redacted.ndjson"), "runtime.feature.mitmproxy_events", mitmproxyEvents, primaryLifecycleKinds),
        );
        checks.push(...expectedMitmproxyEvidenceChecks(featureDir, mitmproxyEvents, expected));
    }

    if (summary) {
        const httpTrafficCount = summary.traffic.filter((item) => item.type === "http").length;
        const gatewayTrafficCount = summary.traffic.filter((item) => item.type === "gateway").length;
        checks.push({
            id: "runtime.feature.summary.identity",
            ok: summary.feature_id === featureId && typeof summary.run_id === "string" && summary.run_id.length > 0 && (!expectedRunId || summary.run_id === expectedRunId),
            path: path.join(featureDir, "summary.json"),
            message: "summary.json feature_id/run_id does not match the audited feature/run",
        });
        checks.push({
            id: "runtime.feature.summary.traffic",
            ok: summary.traffic.length > 0,
            path: path.join(featureDir, "summary.json"),
            message: "summary.json must include correlated traffic",
        });
        checks.push({
            id: "runtime.feature.summary.steps",
            ok: Boolean(summary.steps?.length),
            path: path.join(featureDir, "summary.json"),
            message: "summary.json must preserve ordered feature step metadata",
        });
        checks.push({
            id: "runtime.feature.summary.actions",
            ok: summary.steps?.some((step) => (step.actions?.length ?? 0) > 0) ?? false,
            path: path.join(featureDir, "summary.json"),
            message: "summary.json must preserve redacted UI action labels under feature steps",
        });
        checks.push({
            id: "runtime.feature.summary.http",
            ok: !requiresHttpEvidence || httpTrafficCount > 0,
            path: path.join(featureDir, "summary.json"),
            message: "summary.json must include HTTP traffic when feature declares HTTP expectations",
        });
        checks.push({
            id: "runtime.feature.summary.gateway",
            ok: !requiresGatewayEvidence || gatewayTrafficCount > 0,
            path: path.join(featureDir, "summary.json"),
            message: "summary.json must include Gateway traffic when feature declares Gateway expectations",
        });
        if (events) {
            checks.push(...summaryEventConsistencyChecks(featureDir, summary, events));
        }
        checks.push(...expectedTrafficChecks(summary, expected));
        checks.push(...expectedTrafficMetadataChecks(featureDir, featureId, summary));
    }
    checks.push(...(await redactedHarArtifactChecks(path.join(featureDir, "network.redacted.har"), requiresHttpEvidence, expected)));
    const reportMarkdownAudit = await readTextFileAudit(path.join(featureDir, "report.md"), "runtime.feature.report.readable", "report.md must be a readable Markdown file");
    checks.push(reportMarkdownAudit.check);
    if (typeof reportMarkdownAudit.text === "string") {
        checks.push(...featureReportChecks(featureDir, featureId, reportMarkdownAudit.text, summary));
    }

    return {
        feature_id: featureId,
        ok: checks.every((check) => check.ok),
        event_counts: eventCounts,
        traffic_count: summary?.traffic.length ?? 0,
        http_traffic_count: summary?.traffic.filter((item) => item.type === "http").length ?? 0,
        gateway_traffic_count: summary?.traffic.filter((item) => item.type === "gateway").length ?? 0,
        checks,
    };
}

async function auditRedactionArtifact(redactionAuditPath: string): Promise<{ ok: boolean; checks: RunAuditCheck[] }> {
    const fileCheck = await fileExistsCheck(redactionAuditPath, "redaction.audit_file");
    const checks = [fileCheck];
    if (fileCheck.ok) {
        const audit = await readJsonValueAudit(redactionAuditPath, "redaction.audit_file.parse", "redaction-audit.json must parse as JSON");
        checks.push(audit.check);
        const existing = audit.value;
        checks.push({
            id: "redaction.audit_file.ok",
            ok: isRecord(existing) && existing.ok === true && Array.isArray(existing.violations) && existing.violations.length === 0,
            path: redactionAuditPath,
            message: "redaction-audit.json must be ok with no violations",
        });
    }
    return {
        ok: checks.every((check) => check.ok),
        checks,
    };
}

async function auditCoverageArtifacts(coverageDir: string): Promise<{ ok: boolean; checks: RunAuditCheck[] }> {
    const routesJsonPath = path.join(coverageDir, "routes.coverage.json");
    const gatewayJsonPath = path.join(coverageDir, "gateway.coverage.json");
    const routesMarkdownPath = path.join(coverageDir, "routes.coverage.md");
    const gatewayMarkdownPath = path.join(coverageDir, "gateway.coverage.md");
    const checks = [await fileExistsCheck(routesJsonPath, "coverage.routes_json"), await fileExistsCheck(gatewayJsonPath, "coverage.gateway_json")];
    const routeEntries = await readJsonArrayAudit(routesJsonPath, "coverage.routes_array", "routes.coverage.json must be a JSON array");
    const gatewayEntries = await readJsonArrayAudit(gatewayJsonPath, "coverage.gateway_array", "gateway.coverage.json must be a JSON array");
    const routesMarkdown = await readTextFileAudit(routesMarkdownPath, "coverage.routes_markdown", "routes.coverage.md must be a readable Markdown file");
    const gatewayMarkdown = await readTextFileAudit(gatewayMarkdownPath, "coverage.gateway_markdown", "gateway.coverage.md must be a readable Markdown file");
    checks.push(routeEntries.check, gatewayEntries.check, routesMarkdown.check, gatewayMarkdown.check);
    checks.push(...coverageRouteEntryChecks(routesJsonPath, routeEntries.entries));
    checks.push(...coverageGatewayEntryChecks(gatewayJsonPath, gatewayEntries.entries));
    checks.push(...coverageRouteMarkdownChecks(routesMarkdownPath, routesMarkdown.text, routeEntries.entries));
    checks.push(...coverageGatewayMarkdownChecks(gatewayMarkdownPath, gatewayMarkdown.text, gatewayEntries.entries));
    checks.push({
        id: "coverage.observed_entries",
        ok: (routeEntries.entries?.length ?? 0) + (gatewayEntries.entries?.length ?? 0) > 0,
        path: coverageDir,
        message: "coverage artifacts must include at least one observed route or Gateway entry",
    });
    return {
        ok: checks.every((check) => check.ok),
        checks,
    };
}

async function auditReviewQueueArtifact(reviewQueuePath: string): Promise<{ ok: boolean; checks: RunAuditCheck[] }> {
    const checks = [await fileExistsCheck(reviewQueuePath, "review_queue.file")];
    const entries = await readJsonArrayAudit(reviewQueuePath, "review_queue.array", "review queue must be a JSON array");
    checks.push(entries.check);
    checks.push(...reviewQueueEntryChecks(reviewQueuePath, entries.entries));
    return {
        ok: checks.every((check) => check.ok),
        checks,
    };
}

function coverageRouteEntryChecks(filePath: string, entries: unknown[] | undefined): RunAuditCheck[] {
    return (entries ?? []).map((entry, index) => ({
        id: `coverage.routes_entry.${index}`,
        ok: isCoverageRouteEntry(entry),
        path: filePath,
        message: `routes.coverage.json entry ${index} must include route, methods_observed, feature_ids, and observed_run_ids`,
    }));
}

function coverageGatewayEntryChecks(filePath: string, entries: unknown[] | undefined): RunAuditCheck[] {
    return (entries ?? []).map((entry, index) => ({
        id: `coverage.gateway_entry.${index}`,
        ok: isCoverageGatewayEntry(entry),
        path: filePath,
        message: `gateway.coverage.json entry ${index} must include event/opcode, directions, feature_ids, and observed_run_ids`,
    }));
}

function coverageRouteMarkdownChecks(filePath: string, markdown: string | undefined, entries: unknown[] | undefined): RunAuditCheck[] {
    if (typeof markdown !== "string" || !Array.isArray(entries)) {
        return [];
    }

    const headingOccurrences = new Map<string, number>();
    return entries.flatMap((entry, index) => {
        if (!isCoverageRouteEntry(entry)) {
            return [];
        }

        const heading = `## ${entry.route}`;
        const occurrence = headingOccurrences.get(heading) ?? 0;
        headingOccurrences.set(heading, occurrence + 1);
        const section = markdownSectionForHeading(markdown, heading, occurrence);
        const catalogValues = coverageRouteCatalogMarkdownValues(entry.catalog);
        const fieldChecks = [
            typeof section === "string",
            typeof section === "string" && markdownLineContainsAll(section, "- methods:", entry.methods_observed),
            typeof section === "string" && markdownLineContainsAll(section, "- features:", entry.feature_ids),
            typeof section === "string" && markdownLineContainsAll(section, "- runs:", coverageObservedRunLabels(entry)),
            typeof section === "string" && markdownLineContainsAll(section, "- builds:", coverageObservedBuildLabels(entry)),
            typeof section === "string" && markdownLineContainsAll(section, "- request shapes:", optionalStringArray(entry.payload_shape_hashes)),
            typeof section === "string" && markdownLineContainsAll(section, "- response shapes:", optionalStringArray(entry.response_shape_hashes)),
            !catalogValues || (typeof section === "string" && markdownLineContainsAll(section, "- catalog:", catalogValues)),
        ];
        return [
            {
                id: `coverage.routes_markdown.entry.${index}`,
                ok: fieldChecks.every(Boolean),
                path: filePath,
                message: `routes.coverage.md must render route coverage entry ${index} with route, methods, features, runs, shapes, and catalog context`,
            },
        ];
    });
}

function coverageGatewayMarkdownChecks(filePath: string, markdown: string | undefined, entries: unknown[] | undefined): RunAuditCheck[] {
    if (typeof markdown !== "string" || !Array.isArray(entries)) {
        return [];
    }

    const headingOccurrences = new Map<string, number>();
    return entries.flatMap((entry, index) => {
        if (!isCoverageGatewayEntry(entry)) {
            return [];
        }

        const label = typeof entry.event === "string" ? entry.event : `opcode ${entry.opcode ?? "unknown"}`;
        const heading = `## ${label}`;
        const occurrence = headingOccurrences.get(heading) ?? 0;
        headingOccurrences.set(heading, occurrence + 1);
        const section = markdownSectionForHeading(markdown, heading, occurrence);
        const catalogValues = coverageGatewayCatalogMarkdownValues(entry.catalog);
        const fieldChecks = [
            typeof section === "string",
            typeof section === "string" && markdownLineContainsAll(section, "- directions:", entry.directions),
            typeof section === "string" && markdownLineContainsAll(section, "- features:", entry.feature_ids),
            typeof section === "string" && markdownLineContainsAll(section, "- runs:", coverageObservedRunLabels(entry)),
            typeof section === "string" && markdownLineContainsAll(section, "- builds:", coverageObservedBuildLabels(entry)),
            typeof section === "string" && markdownLineContainsAll(section, "- payload shapes:", optionalStringArray(entry.payload_shape_hashes)),
            !catalogValues || (typeof section === "string" && markdownLineContainsAll(section, "- catalog:", catalogValues)),
        ];
        return [
            {
                id: `coverage.gateway_markdown.entry.${index}`,
                ok: fieldChecks.every(Boolean),
                path: filePath,
                message: `gateway.coverage.md must render Gateway coverage entry ${index} with event/opcode, directions, features, runs, shapes, and catalog context`,
            },
        ];
    });
}

function isCoverageRouteEntry(entry: unknown): entry is Record<string, unknown> & {
    route: string;
    methods_observed: string[];
    feature_ids: string[];
    observed_run_ids: string[];
} {
    return (
        isRecord(entry) &&
        typeof entry.route === "string" &&
        entry.route.length > 0 &&
        isStringArray(entry.methods_observed) &&
        entry.methods_observed.length > 0 &&
        isStringArray(entry.feature_ids) &&
        entry.feature_ids.length > 0 &&
        isStringArray(entry.observed_run_ids) &&
        entry.observed_run_ids.length > 0 &&
        coverageRunFieldsOk(entry) &&
        optionalStringArrayField(entry, "build_ids") &&
        coverageBuildFieldsOk(entry) &&
        optionalStringArrayField(entry, "payload_shape_hashes") &&
        optionalStringArrayField(entry, "response_shape_hashes") &&
        optionalRouteCoverageCatalog(entry.catalog)
    );
}

function isCoverageGatewayEntry(entry: unknown): entry is Record<string, unknown> & {
    event?: string;
    opcode?: number;
    directions: string[];
    feature_ids: string[];
    observed_run_ids: string[];
} {
    return (
        isRecord(entry) &&
        ((typeof entry.event === "string" && entry.event.length > 0) || typeof entry.opcode === "number") &&
        isStringArray(entry.directions) &&
        entry.directions.length > 0 &&
        isStringArray(entry.feature_ids) &&
        entry.feature_ids.length > 0 &&
        isStringArray(entry.observed_run_ids) &&
        entry.observed_run_ids.length > 0 &&
        coverageRunFieldsOk(entry) &&
        optionalStringArrayField(entry, "build_ids") &&
        coverageBuildFieldsOk(entry) &&
        optionalStringArrayField(entry, "payload_shape_hashes") &&
        optionalGatewayCoverageCatalog(entry.catalog)
    );
}

function markdownLineContainsAll(markdown: string, prefix: string, values: string[]): boolean {
    if (values.length === 0) {
        return true;
    }
    const line = markdown.split(/\r?\n/u).find((candidate) => candidate.trim().startsWith(prefix));
    return Boolean(line && values.every((value) => markdownLineContainsValue(line, value)));
}

function markdownLineContainsValue(line: string, value: string): boolean {
    const escaped = escapeRegExp(value);
    return new RegExp(`(^|[^A-Za-z0-9_./:{}@-])${escaped}([^A-Za-z0-9_./:{}@-]|$)`, "u").test(line);
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function markdownSectionForHeading(markdown: string, heading: string, occurrence = 0): string | undefined {
    const lines = markdown.split(/\r?\n/u);
    let seen = 0;
    const start = lines.findIndex((line) => {
        if (line.trim() !== heading) {
            return false;
        }
        if (seen === occurrence) {
            return true;
        }
        seen += 1;
        return false;
    });
    if (start < 0) {
        return undefined;
    }
    const nextHeading = lines.findIndex((line, index) => index > start && line.trim().startsWith("## "));
    const end = nextHeading < 0 ? lines.length : nextHeading;
    return lines.slice(start, end).join("\n");
}

function coverageObservedRunLabels(entry: Record<string, unknown> & { observed_run_ids: string[] }): string[] {
    const first = typeof entry.first_observed_run_id === "string" ? entry.first_observed_run_id : undefined;
    const last = typeof entry.last_observed_run_id === "string" ? entry.last_observed_run_id : undefined;
    return [first, last].filter(isNonEmptyString).length > 0 ? [...new Set([first, last].filter(isNonEmptyString))] : entry.observed_run_ids;
}

function coverageObservedBuildLabels(entry: Record<string, unknown>): string[] {
    const first = typeof entry.first_observed_build === "string" ? entry.first_observed_build : undefined;
    const last = typeof entry.last_observed_build === "string" ? entry.last_observed_build : undefined;
    return [first, last].filter(isNonEmptyString).length > 0 ? [...new Set([first, last].filter(isNonEmptyString))] : [];
}

function coverageRunFieldsOk(entry: Record<string, unknown>): boolean {
    const observedRunIds = optionalStringArray(entry.observed_run_ids);
    const first = typeof entry.first_observed_run_id === "string" ? entry.first_observed_run_id : undefined;
    const last = typeof entry.last_observed_run_id === "string" ? entry.last_observed_run_id : undefined;
    if (!first && !last) {
        return true;
    }
    return isNonEmptyString(first) && isNonEmptyString(last) && observedRunIds.includes(first) && observedRunIds.includes(last);
}

function coverageBuildFieldsOk(entry: Record<string, unknown>): boolean {
    const buildIds = optionalStringArray(entry.build_ids);
    if (buildIds.length === 0) {
        return true;
    }
    return (
        isNonEmptyString(entry.first_observed_build) &&
        isNonEmptyString(entry.last_observed_build) &&
        buildIds.includes(entry.first_observed_build) &&
        buildIds.includes(entry.last_observed_build)
    );
}

function optionalRouteCoverageCatalog(value: unknown): boolean {
    return typeof value === "undefined" || (isRecord(value) && isNonEmptyString(value.route_name) && isNonEmptyString(value.source));
}

function optionalGatewayCoverageCatalog(value: unknown): boolean {
    return typeof value === "undefined" || (isRecord(value) && isNonEmptyString(value.source) && (typeof value.name === "undefined" || isNonEmptyString(value.name)));
}

function coverageRouteCatalogMarkdownValues(value: unknown): string[] | undefined {
    if (!isRecord(value) || !isNonEmptyString(value.route_name) || !isNonEmptyString(value.source)) {
        return undefined;
    }
    return [value.route_name, value.source];
}

function coverageGatewayCatalogMarkdownValues(value: unknown): string[] | undefined {
    if (!isRecord(value) || !isNonEmptyString(value.source)) {
        return undefined;
    }
    return [isNonEmptyString(value.name) ? value.name : "unnamed", value.source];
}

function optionalStringArrayField(entry: Record<string, unknown>, field: string): boolean {
    return typeof entry[field] === "undefined" || isStringArray(entry[field]);
}

function optionalStringArray(value: unknown): string[] {
    return isStringArray(value) ? value : [];
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every(isNonEmptyString);
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.length > 0;
}

const reviewQueueReasons = new Set([
    "unknown_attribution",
    "new_route",
    "new_gateway_event",
    "changed_signature",
    "sensitive_route",
    "scenario_expectation_failed",
    "runtime_failure",
    "runtime_abort",
]);
const reviewQueueSeverities = new Set(["low", "medium", "high"]);

function reviewQueueEntryChecks(filePath: string, entries: unknown[] | undefined): RunAuditCheck[] {
    return (entries ?? []).map((entry, index) => ({
        id: `review_queue.entry.${index}`,
        ok:
            isRecord(entry) &&
            typeof entry.feature_id === "string" &&
            entry.feature_id.length > 0 &&
            typeof entry.reason === "string" &&
            reviewQueueReasons.has(entry.reason) &&
            typeof entry.severity === "string" &&
            reviewQueueSeverities.has(entry.severity) &&
            typeof entry.subject === "string" &&
            entry.subject.length > 0 &&
            (typeof entry.step_id === "undefined" || typeof entry.step_id === "string"),
        path: filePath,
        message: `review queue entry ${index} must include feature_id, known reason, severity, and subject`,
    }));
}

function featureReportChecks(featureDir: string, featureId: string, reportMarkdown: string, summary: FeatureSummary | undefined): RunAuditCheck[] {
    const reportPath = path.join(featureDir, "report.md");
    const checks: RunAuditCheck[] = [
        {
            id: "runtime.feature.report.identity",
            ok: hasMarkdownLineWithPrefix(reportMarkdown, "# Feature: ") && hasMarkdownLine(reportMarkdown, `Scenario: ${featureId}`),
            path: reportPath,
            message: "report.md must render feature identity and audited scenario id",
        },
        {
            id: "runtime.feature.report.run_id",
            ok: !summary || hasMarkdownLine(reportMarkdown, `Run: ${summary.run_id}`),
            path: reportPath,
            message: "report.md must render the summary run id",
        },
        {
            id: "runtime.feature.report.actions",
            ok: reportMarkdown.includes("Actions:"),
            path: reportPath,
            message: "report.md must render redacted step UI actions",
        },
    ];
    if (!summary) {
        return checks;
    }

    for (const step of summary.steps ?? []) {
        const stepSection = featureReportSectionForStep(reportMarkdown, step.step_id);
        checks.push({
            id: `runtime.feature.report.step.${checkIdForPath(step.step_id)}`,
            ok: typeof stepSection === "string",
            path: reportPath,
            message: `report.md must render summary step ${step.step_id}`,
        });
        for (const action of step.actions ?? []) {
            checks.push({
                id: `runtime.feature.report.action.${checkIdForPath(step.step_id)}.${action.action}`,
                ok: stepSection?.includes(`- ${action.action}`) ?? false,
                path: reportPath,
                message: `report.md must render action ${action.action} for step ${step.step_id}`,
            });
        }
    }

    for (const traffic of summary.traffic) {
        const trafficSection = traffic.step_id ? featureReportSectionForStep(reportMarkdown, traffic.step_id) : reportMarkdown;
        if (traffic.type === "http" && traffic.route) {
            checks.push({
                id: `runtime.feature.report.http.${checkIdForPath(traffic.route)}`,
                ok: trafficSection?.includes(traffic.route) ?? false,
                path: reportPath,
                message: `report.md must render HTTP traffic ${traffic.route}${traffic.step_id ? ` in step ${traffic.step_id}` : ""}`,
            });
        }
        if (traffic.type === "gateway") {
            const label = traffic.event ?? `opcode ${traffic.opcode ?? "unknown"}`;
            checks.push({
                id: `runtime.feature.report.gateway.${checkIdForPath(label)}`,
                ok: trafficSection?.includes(label) ?? false,
                path: reportPath,
                message: `report.md must render Gateway traffic ${label}${traffic.step_id ? ` in step ${traffic.step_id}` : ""}`,
            });
        }
    }

    return checks;
}

function hasMarkdownLine(markdown: string, line: string): boolean {
    return markdown.split(/\r?\n/u).some((candidate) => candidate.trim() === line);
}

function hasMarkdownLineWithPrefix(markdown: string, prefix: string): boolean {
    return markdown.split(/\r?\n/u).some((candidate) => candidate.trim().startsWith(prefix));
}

function featureReportSectionForStep(reportMarkdown: string, stepId: string): string | undefined {
    const headings = stepHeadingOffsets(reportMarkdown);
    const headingIndex = headings.findIndex((heading) => stepHeadingMatchesStepId(heading.line, stepId));
    if (headingIndex < 0) {
        return undefined;
    }

    const start = headings[headingIndex].start;
    const end = headings[headingIndex + 1]?.start ?? reportMarkdown.length;
    return reportMarkdown.slice(start, end);
}

function stepHeadingOffsets(markdown: string): Array<{ start: number; line: string }> {
    const headings: Array<{ start: number; line: string }> = [];
    const headingPattern = /(^|\n)(## Step: [^\r\n]*)/gu;
    for (const match of markdown.matchAll(headingPattern)) {
        headings.push({
            start: (match.index ?? 0) + (match[1] ? 1 : 0),
            line: match[2].trim(),
        });
    }
    return headings;
}

function stepHeadingMatchesStepId(headingLine: string, stepId: string): boolean {
    return headingLine === `## Step: ${stepId}` || headingLine.endsWith(` (${stepId})`);
}

async function unexpectedHarFileChecks(featureDir: string): Promise<RunAuditCheck[]> {
    const allowedHarFiles = new Set(["network.redacted.har", "network.raw.har", "network.har"]);
    const harFiles = await findHarFiles(featureDir);
    return harFiles.flatMap((filePath) => {
        const relativePath = path.relative(featureDir, filePath).split(path.sep).join(path.posix.sep);
        if (allowedHarFiles.has(relativePath)) {
            return [];
        }

        return [
            {
                id: `runtime.feature.unexpected_har.${checkIdForPath(relativePath)}`,
                ok: false,
                path: filePath,
                message: "unexpected HAR file must not remain in durable feature output; keep only network.redacted.har",
            },
        ];
    });
}

async function findHarFiles(directoryPath: string): Promise<string[]> {
    let entries;
    try {
        entries = await readdir(directoryPath, { withFileTypes: true });
    } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;
        if (nodeError.code === "ENOENT") {
            return [];
        }
        throw error;
    }

    const files: string[] = [];
    for (const entry of entries) {
        const entryPath = path.join(directoryPath, entry.name);
        if (entry.isDirectory()) {
            files.push(...(await findHarFiles(entryPath)));
        } else if (entry.isFile() && entry.name.endsWith(".har")) {
            files.push(entryPath);
        }
    }
    return files;
}

function checkIdForPath(filePath: string): string {
    return filePath.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "file";
}

async function zipSignatureCheck(filePath: string, id: string): Promise<RunAuditCheck> {
    try {
        const bytes = await readFile(filePath);
        const endOfCentralDirectory = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
        const ok = bytes.byteLength >= 22 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes.indexOf(endOfCentralDirectory) >= 0;
        return {
            id,
            ok,
            path: filePath,
            message: ok ? undefined : "trace.zip must be a parseable ZIP artifact with an end-of-central-directory record",
        };
    } catch (error) {
        return missingCheck(error, id, filePath, "missing required file");
    }
}

async function redactedHarArtifactChecks(filePath: string, requiresHttpEvidence: boolean, expectedTraffic: FeatureSummary["expected"]): Promise<RunAuditCheck[]> {
    try {
        const raw = await readFile(filePath, "utf8");
        const har = JSON.parse(raw) as unknown;
        const entries = isRecord(har) && isRecord(har.log) && Array.isArray(har.log.entries) ? har.log.entries : undefined;
        const checks: RunAuditCheck[] = [
            {
                id: "runtime.feature.har.shape",
                ok: Boolean(entries),
                path: filePath,
                message: "network.redacted.har must be valid HAR JSON with log.entries",
            },
        ];
        if (entries) {
            checks.push({
                id: "runtime.feature.har.entries",
                ok: !requiresHttpEvidence || entries.length > 0,
                path: filePath,
                message: "network.redacted.har must include entries when feature declares HTTP expectations",
            });
            checks.push({
                id: "runtime.feature.har.request_response",
                ok: !requiresHttpEvidence || entries.some((entry) => isRecord(entry) && isRecord(entry.request) && isRecord(entry.response)),
                path: filePath,
                message: "network.redacted.har must include request and response objects for HTTP evidence",
            });
            checks.push(...expectedHarEvidenceChecks(filePath, entries, expectedTraffic));
        }
        return checks;
    } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;
        return [
            {
                id: "runtime.feature.har.parse",
                ok: false,
                path: filePath,
                message: nodeError.code === "ENOENT" ? "missing required file" : `network.redacted.har must parse as JSON: ${nodeError.message}`,
            },
        ];
    }
}

async function screenshotArtifactChecks(directoryPath: string, events: CaptureEvent[], eventCounts: Record<string, number>): Promise<RunAuditCheck[]> {
    const expectedBoundaryScreenshots = (eventCounts["step.start"] ?? 0) + (eventCounts["step.end"] ?? 0);
    let entries;
    try {
        entries = await readdir(directoryPath, { withFileTypes: true });
    } catch (error) {
        return [missingCheck(error, "runtime.feature.screenshots.readable", directoryPath, "missing required directory")];
    }

    const pngFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".png")).map((entry) => path.join(directoryPath, entry.name));
    const pngNames = new Set(pngFiles.map((filePath) => path.basename(filePath)));
    const expectedBoundaryNames = expectedScreenshotBoundaryNames(events);
    const checks: RunAuditCheck[] = [
        {
            id: "runtime.feature.screenshots.png_count",
            ok: expectedBoundaryScreenshots === 0 || pngFiles.length >= expectedBoundaryScreenshots,
            path: directoryPath,
            message: `screenshots must include PNG step-boundary captures; expected at least ${expectedBoundaryScreenshots}`,
        },
        {
            id: "runtime.feature.screenshots.step_boundaries",
            ok: expectedBoundaryNames.every((fileName) => pngNames.has(fileName)),
            path: directoryPath,
            message: "screenshots must include deterministic start/end captures for every audited step marker",
        },
    ];
    for (const pngFile of pngFiles) {
        checks.push(await pngSignatureCheck(pngFile));
    }
    return checks;
}

function expectedScreenshotBoundaryNames(events: CaptureEvent[]): string[] {
    const fileNames: string[] = [];
    for (const event of events) {
        if (event.kind !== "step.start" && event.kind !== "step.end") {
            continue;
        }
        const phase = event.kind === "step.start" ? "start" : "end";
        fileNames.push(screenshotBoundaryName(fileNames.length + 1, event.step_id, phase));
    }
    return fileNames;
}

function screenshotBoundaryName(index: number, stepId: string, phase: "start" | "end"): string {
    const safeStepId = stepId.replace(/[^a-zA-Z0-9._-]/g, "_");
    return `${String(index).padStart(3, "0")}-${safeStepId}-${phase}.png`;
}

async function pngSignatureCheck(filePath: string): Promise<RunAuditCheck> {
    try {
        const bytes = await readFile(filePath);
        const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
        const ok = bytes.byteLength >= signature.length && signature.every((byte, index) => bytes[index] === byte);
        return {
            id: `runtime.feature.screenshot_png.${checkIdForPath(path.basename(filePath))}`,
            ok,
            path: filePath,
            message: ok ? undefined : "screenshot artifact must be a PNG file",
        };
    } catch (error) {
        return missingCheck(error, `runtime.feature.screenshot_png.${checkIdForPath(path.basename(filePath))}`, filePath, "missing required file");
    }
}

async function runtimeArtifactManifestChecks(featureDir: string, runArtifacts: unknown): Promise<RunAuditCheck[]> {
    const checks: RunAuditCheck[] = await runtimeArtifactPathChecks(
        path.join(featureDir, "run-artifacts.json"),
        "runtime.feature.run_artifacts",
        runArtifacts,
        new Set(["status"]),
    );
    if (!isRecord(runArtifacts)) {
        return checks;
    }
    if (runArtifacts.status !== "passed") {
        return checks;
    }

    const expectedPaths: Record<string, string> = {
        preflight_path: "preflight.json",
        events_path: "events.ndjson",
        playwright_events_path: "playwright-events.ndjson",
        summary_path: "summary.json",
        markdown_path: "report.md",
        trace_path: "trace.zip",
        screenshots_dir: "screenshots",
        redacted_har_path: "network.redacted.har",
    };
    for (const [key, expectedPath] of Object.entries(expectedPaths)) {
        checks.push({
            id: `runtime.feature.run_artifacts.${key}`,
            ok: runArtifacts[key] === expectedPath,
            path: path.join(featureDir, "run-artifacts.json"),
            message: `passed run-artifacts.json must reference feature-local ${expectedPath}`,
        });
    }
    checks.push({
        id: "runtime.feature.run_artifacts.no_failure_path",
        ok: typeof runArtifacts.failure_path === "undefined",
        path: path.join(featureDir, "run-artifacts.json"),
        message: "passed run-artifacts.json must not include failure_path",
    });
    return checks;
}

const runtimeArtifactPathKeys = [
    "preflight_path",
    "events_path",
    "playwright_events_path",
    "summary_path",
    "markdown_path",
    "trace_path",
    "screenshots_dir",
    "video_path",
    "redacted_har_path",
    "failure_path",
] as const;
const runtimeArtifactPathKeySet = new Set<string>(runtimeArtifactPathKeys);

async function runtimeArtifactPathChecks(filePath: string, idPrefix: string, value: unknown, allowedExtraKeys = new Set<string>()): Promise<RunAuditCheck[]> {
    const checks: RunAuditCheck[] = [];
    if (!isRecord(value)) {
        return [
            {
                id: `${idPrefix}.shape`,
                ok: false,
                path: filePath,
                message: "runtime artifact paths must be stored in an object",
            },
        ];
    }

    for (const key of Object.keys(value)) {
        if (runtimeArtifactPathKeySet.has(key) || allowedExtraKeys.has(key)) {
            continue;
        }
        checks.push({
            id: `${idPrefix}.${checkIdForPath(key)}.unknown_key`,
            ok: false,
            path: filePath,
            message: `${key} is not an allowed runtime artifact path key`,
        });
    }

    for (const key of runtimeArtifactPathKeys) {
        const artifactPath = value[key];
        if (typeof artifactPath === "undefined") {
            continue;
        }
        checks.push({
            id: `${idPrefix}.${key}.safe_path`,
            ok: typeof artifactPath === "string" && isSafeRuntimeArtifactRelativePath(artifactPath),
            path: filePath,
            message: `${key} must be a safe feature-local slash-relative path`,
        });
        if (typeof artifactPath === "string" && isSafeRuntimeArtifactRelativePath(artifactPath)) {
            checks.push(await runtimeArtifactPathTargetCheck(filePath, idPrefix, key, artifactPath));
        }
    }
    return checks;
}

async function runtimeArtifactPathTargetCheck(manifestPath: string, idPrefix: string, key: string, artifactPath: string): Promise<RunAuditCheck> {
    const targetPath = path.join(path.dirname(manifestPath), artifactPath);
    try {
        const artifactStat = await stat(targetPath);
        const ok = key === "screenshots_dir" ? artifactStat.isDirectory() : artifactStat.isFile();
        return {
            id: `${idPrefix}.${key}.exists`,
            ok,
            path: targetPath,
            message: `${key} must reference an existing feature-local ${key === "screenshots_dir" ? "directory" : "file"}`,
        };
    } catch (error) {
        return missingCheck(error, `${idPrefix}.${key}.exists`, targetPath, "missing referenced runtime artifact");
    }
}

function eventStreamIdentityChecks(filePath: string, idPrefix: string, events: CaptureEvent[], featureId: string, expectedRunId: string | undefined): RunAuditCheck[] {
    const featureIds = new Set(events.map((event) => event.feature_id));
    const runIds = new Set(events.map((event) => event.run_id));
    return [
        {
            id: `${idPrefix}.feature_id`,
            ok: featureIds.size === 1 && featureIds.has(featureId),
            path: filePath,
            message: "event stream feature_id values must match the audited feature",
        },
        {
            id: `${idPrefix}.run_id`,
            ok: expectedRunId ? runIds.size === 1 && runIds.has(expectedRunId) : runIds.size === 1,
            path: filePath,
            message: expectedRunId ? "event stream run_id values must match the audited run" : "event stream must use one consistent run_id",
        },
    ];
}

function eventStepIntegrityChecks(filePath: string, events: CaptureEvent[]): RunAuditCheck[] {
    const activeSteps: Array<{ stepId: string; startedAtMs: number }> = [];
    let stepPairsOk = true;
    let uiActionStepOk = true;
    let monotonicTimestampsOk = true;
    let stepWindowsOk = true;
    let previousTimestamp = Number.NEGATIVE_INFINITY;
    for (const event of events) {
        if (event.ts_monotonic_ms < previousTimestamp) {
            monotonicTimestampsOk = false;
        }
        previousTimestamp = event.ts_monotonic_ms;
        if (event.kind === "step.start") {
            activeSteps.push({ stepId: event.step_id, startedAtMs: event.ts_monotonic_ms });
            continue;
        }
        if (event.kind === "step.end") {
            const activeStep = activeSteps.at(-1);
            if (activeStep?.stepId === event.step_id) {
                activeSteps.pop();
                stepWindowsOk &&= event.ts_monotonic_ms >= activeStep.startedAtMs;
            } else {
                stepPairsOk = false;
            }
            continue;
        }
        if (event.kind === "ui.action") {
            uiActionStepOk &&= typeof event.step_id === "string" ? activeSteps.some((step) => step.stepId === event.step_id) : activeSteps.length === 1;
        }
    }

    return [
        {
            id: "runtime.feature.events.monotonic_timestamps",
            ok: monotonicTimestampsOk,
            path: filePath,
            message: "events.ndjson timestamps must be monotonically non-decreasing in capture order",
        },
        {
            id: "runtime.feature.events.step_pairs",
            ok: stepPairsOk,
            path: filePath,
            message: "every step.end marker must close an active matching step.start marker",
        },
        {
            id: "runtime.feature.events.step_windows",
            ok: stepWindowsOk,
            path: filePath,
            message: "every step.end marker must have a timestamp greater than or equal to its step.start marker",
        },
        {
            id: "runtime.feature.events.open_steps",
            ok: activeSteps.length === 0,
            path: filePath,
            message: "events.ndjson must not leave step.start markers open at the end of the stream",
        },
        {
            id: "runtime.feature.events.ui_action_step",
            ok: uiActionStepOk,
            path: filePath,
            message: "ui.action events must be attributable to an active step window",
        },
    ];
}

interface EventLifecycleKinds {
    httpRequest: string;
    httpResponse: string;
    httpFailure?: string;
    wsCreated: string;
    wsClosed?: string;
    wsError?: string;
    wsHandshakeRequest?: string;
    wsHandshakeResponse?: string;
    wsFrameSent: string;
    wsFrameReceived: string;
}

const primaryLifecycleKinds: EventLifecycleKinds = {
    httpRequest: "http.request",
    httpResponse: "http.response",
    httpFailure: "http.failure",
    wsCreated: "ws.created",
    wsClosed: "ws.closed",
    wsError: "ws.error",
    wsHandshakeRequest: "ws.handshake.request",
    wsHandshakeResponse: "ws.handshake.response",
    wsFrameSent: "ws.frame.sent",
    wsFrameReceived: "ws.frame.received",
};

const playwrightLifecycleKinds: EventLifecycleKinds = {
    httpRequest: "playwright.http.request",
    httpResponse: "playwright.http.response",
    wsCreated: "playwright.ws.created",
    wsClosed: "playwright.ws.closed",
    wsError: "playwright.ws.error",
    wsFrameSent: "playwright.ws.frame.sent",
    wsFrameReceived: "playwright.ws.frame.received",
};

function eventLifecycleIntegrityChecks(filePath: string, idPrefix: string, events: CaptureEvent[], kinds: EventLifecycleKinds): RunAuditCheck[] {
    const seenRequestIds = new Set<string>();
    const seenWebSockets = new Set<string>();
    const closedWebSockets = new Set<string>();
    let httpLifecycleOk = true;
    let websocketLifecycleOk = true;

    for (const event of events) {
        if (event.kind === kinds.httpRequest) {
            const requestId = httpCorrelationId(event);
            if (requestId) {
                seenRequestIds.add(requestId);
            }
            continue;
        }
        if (event.kind === kinds.httpResponse) {
            httpLifecycleOk &&= httpEventHasPriorRequest(event, seenRequestIds);
            continue;
        }
        if (kinds.httpFailure && event.kind === kinds.httpFailure) {
            httpLifecycleOk &&= httpEventHasPriorRequest(event, seenRequestIds);
            continue;
        }
        if (event.kind === kinds.wsCreated) {
            const websocketId = captureStringField(event, "websocket_id");
            websocketLifecycleOk &&= typeof websocketId === "string" && (!seenWebSockets.has(websocketId) || closedWebSockets.has(websocketId));
            if (websocketId) {
                seenWebSockets.add(websocketId);
                closedWebSockets.delete(websocketId);
            }
            continue;
        }
        if (event.kind === kinds.wsClosed || event.kind === kinds.wsError) {
            const websocketId = captureStringField(event, "websocket_id");
            websocketLifecycleOk &&= typeof websocketId === "string" && seenWebSockets.has(websocketId);
            if (websocketId) {
                closedWebSockets.add(websocketId);
            }
            continue;
        }
        if (event.kind === kinds.wsHandshakeRequest || event.kind === kinds.wsHandshakeResponse || event.kind === kinds.wsFrameSent || event.kind === kinds.wsFrameReceived) {
            const websocketId = captureStringField(event, "websocket_id");
            websocketLifecycleOk &&= typeof websocketId === "string" && seenWebSockets.has(websocketId) && !closedWebSockets.has(websocketId);
        }
    }

    return [
        {
            id: `${idPrefix}.http_lifecycle`,
            ok: httpLifecycleOk,
            path: filePath,
            message: "HTTP response and failure events must correspond to a prior request event in the same stream",
        },
        {
            id: `${idPrefix}.websocket_lifecycle`,
            ok: websocketLifecycleOk,
            path: filePath,
            message: "WebSocket handshake/frame/close/error events must correspond to a prior open websocket in the same stream",
        },
    ];
}

function httpEventHasPriorRequest(event: CaptureEvent, seenRequestIds: Set<string>): boolean {
    const requestId = httpCorrelationId(event);
    return Boolean(requestId && seenRequestIds.has(requestId));
}

function captureStringField(event: CaptureEvent, field: string): string | undefined {
    const value = (event as unknown as Record<string, unknown>)[field];
    return typeof value === "string" && value.length > 0 ? value : undefined;
}

function httpCorrelationId(event: CaptureEvent): string | undefined {
    return captureStringField(event, "cdp_request_id") ?? captureStringField(event, "playwright_request_id");
}

function isSafeRuntimeArtifactRelativePath(filePath: string): boolean {
    if (!filePath || filePath.includes("\0") || filePath.includes("\\")) {
        return false;
    }
    if (path.posix.isAbsolute(filePath) || path.win32.isAbsolute(filePath) || /^[A-Za-z]:/u.test(filePath)) {
        return false;
    }
    const normalized = path.posix.normalize(filePath);
    return normalized === filePath && normalized !== "." && normalized !== ".." && !normalized.startsWith("../");
}

function expectedCdpEvidenceChecks(featureDir: string, events: CaptureEvent[], expectedTraffic: FeatureSummary["expected"]): RunAuditCheck[] {
    if (!expectedTraffic) {
        return [];
    }

    const checks: RunAuditCheck[] = [];
    for (const expected of expectedTraffic.http ?? []) {
        checks.push({
            id: `runtime.feature.events.expected_http.${expected.method}.${expected.route}`,
            ok: hasExpectedHttpPair(events, expected, {
                requestKind: "http.request",
                responseKind: "http.response",
                stepMatcher: stepMatches,
            }),
            path: path.join(featureDir, "events.ndjson"),
            message: `events.ndjson must include matching CDP request and response for ${expected.method} ${expected.route}`,
        });
    }
    for (const expected of expectedTraffic.gateway ?? []) {
        checks.push({
            id: `runtime.feature.events.expected_gateway.${expected.direction ?? "any"}.${expected.event ?? expected.opcode ?? "any"}`,
            ok: events.some(
                (event) =>
                    (event.kind === "ws.frame.sent" || event.kind === "ws.frame.received") &&
                    (!expected.direction || event.direction === expected.direction) &&
                    (!expected.event || event.gateway_event === expected.event) &&
                    (typeof expected.opcode === "undefined" || event.opcode === expected.opcode) &&
                    stepMatches(event.step_id, expected.step_id),
            ),
            path: path.join(featureDir, "events.ndjson"),
            message: `events.ndjson must include matching CDP Gateway evidence for ${expected.event ?? expected.opcode ?? "unknown"}`,
        });
    }
    return checks;
}

function expectedPlaywrightEvidenceChecks(featureDir: string, events: CaptureEvent[], expectedTraffic: FeatureSummary["expected"]): RunAuditCheck[] {
    if (!expectedTraffic) {
        return [];
    }

    const checks: RunAuditCheck[] = [];
    for (const expected of expectedTraffic.http ?? []) {
        checks.push({
            id: `runtime.feature.playwright_events.expected_http.${expected.method}.${expected.route}`,
            ok: hasExpectedHttpPair(events, expected, {
                requestKind: "playwright.http.request",
                responseKind: "playwright.http.response",
                stepMatcher: stepMatches,
            }),
            path: path.join(featureDir, "playwright-events.ndjson"),
            message: `playwright-events.ndjson must include matching request and response for ${expected.method} ${expected.route}`,
        });
    }
    for (const expected of expectedTraffic.gateway ?? []) {
        checks.push({
            id: `runtime.feature.playwright_events.expected_gateway.${expected.direction ?? "any"}.${expected.event ?? expected.opcode ?? "any"}`,
            ok: events.some(
                (event) =>
                    (event.kind === "playwright.ws.frame.sent" || event.kind === "playwright.ws.frame.received") &&
                    (!expected.direction || event.direction === expected.direction) &&
                    (!expected.event || event.gateway_event === expected.event) &&
                    (typeof expected.opcode === "undefined" || event.opcode === expected.opcode) &&
                    stepMatches(event.step_id, expected.step_id),
            ),
            path: path.join(featureDir, "playwright-events.ndjson"),
            message: `playwright-events.ndjson must include matching Gateway evidence for ${expected.event ?? expected.opcode ?? "unknown"}`,
        });
    }
    return checks;
}

function expectedMitmproxyEvidenceChecks(featureDir: string, events: CaptureEvent[], expectedTraffic: FeatureSummary["expected"]): RunAuditCheck[] {
    if (!expectedTraffic) {
        return [];
    }

    const eventPath = path.join(featureDir, "mitmproxy.redacted.ndjson");
    const checks: RunAuditCheck[] = [];
    for (const expected of expectedTraffic.http ?? []) {
        checks.push({
            id: `runtime.feature.mitmproxy_events.expected_http.${expected.method}.${expected.route}`,
            ok: hasExpectedHttpPair(events, expected, {
                requestKind: "http.request",
                responseKind: "http.response",
                stepMatcher: secondaryStepMatches,
            }),
            path: eventPath,
            message: `mitmproxy.redacted.ndjson must include matching request and response for ${expected.method} ${expected.route}`,
        });
    }
    for (const expected of expectedTraffic.gateway ?? []) {
        checks.push({
            id: `runtime.feature.mitmproxy_events.expected_gateway.${expected.direction ?? "any"}.${expected.event ?? expected.opcode ?? "any"}`,
            ok: events.some(
                (event) =>
                    (event.kind === "ws.frame.sent" || event.kind === "ws.frame.received") &&
                    (!expected.direction || event.direction === expected.direction) &&
                    (!expected.event || event.gateway_event === expected.event) &&
                    (typeof expected.opcode === "undefined" || event.opcode === expected.opcode) &&
                    secondaryStepMatches(event.step_id, expected.step_id),
            ),
            path: eventPath,
            message: `mitmproxy.redacted.ndjson must include matching Gateway evidence for ${expected.event ?? expected.opcode ?? "unknown"}`,
        });
    }
    return checks;
}

function hasExpectedHttpPair(
    events: CaptureEvent[],
    expected: ExpectedHttpTraffic,
    options: {
        requestKind: string;
        responseKind: string;
        stepMatcher: (actual: string | undefined, expected: string | undefined) => boolean;
    },
): boolean {
    const requests = events.filter(
        (event) =>
            event.kind === options.requestKind &&
            captureStringField(event, "method") === expected.method &&
            captureStringField(event, "normalized_route") === expected.route &&
            options.stepMatcher(captureStringField(event, "step_id"), expected.step_id),
    );
    return events.some(
        (response) =>
            response.kind === options.responseKind &&
            captureStringField(response, "method") === expected.method &&
            captureStringField(response, "normalized_route") === expected.route &&
            captureNumberField(response, "status") > 0 &&
            options.stepMatcher(captureStringField(response, "step_id"), expected.step_id) &&
            requests.some((request) => httpEventsBelongTogether(request, response)),
    );
}

function httpEventsBelongTogether(request: CaptureEvent, response: CaptureEvent): boolean {
    const requestId = httpCorrelationId(request);
    const responseId = httpCorrelationId(response);
    return (
        Boolean(requestId && responseId && requestId === responseId) &&
        request.ts_monotonic_ms <= response.ts_monotonic_ms &&
        captureStringField(request, "method") === captureStringField(response, "method") &&
        captureStringField(request, "normalized_route") === captureStringField(response, "normalized_route")
    );
}

function captureNumberField(event: CaptureEvent, field: string): number {
    const value = (event as unknown as Record<string, unknown>)[field];
    return typeof value === "number" && Number.isFinite(value) ? value : Number.NaN;
}

function expectedHarEvidenceChecks(filePath: string, entries: unknown[], expectedTraffic: FeatureSummary["expected"]): RunAuditCheck[] {
    return (expectedTraffic?.http ?? []).map((expected) => ({
        id: `runtime.feature.har.expected_http.${expected.method}.${expected.route}`,
        ok: entries.some((entry) => harEntryMatchesExpectedHttp(entry, expected)),
        path: filePath,
        message: `network.redacted.har must include matching request/response entry for ${expected.method} ${expected.route}`,
    }));
}

function harEntryMatchesExpectedHttp(entry: unknown, expected: ExpectedHttpTraffic): boolean {
    if (!isRecord(entry) || !isRecord(entry.request) || !isRecord(entry.response)) {
        return false;
    }

    const method = typeof entry.request.method === "string" ? entry.request.method.toUpperCase() : undefined;
    const route = typeof entry.request.url === "string" ? routePathFromHarUrl(entry.request.url) : undefined;
    const status = typeof entry.response.status === "number" ? entry.response.status : undefined;
    return method === expected.method && route === expected.route && typeof status === "number" && status > 0;
}

function routePathFromHarUrl(url: string): string | undefined {
    const withoutOrigin = url.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i, "");
    const pathOnly = withoutOrigin.split(/[?#]/, 1)[0] ?? "";
    const apiMatch = /^\/api\/v\d+(\/.*)$/.exec(pathOnly);
    return apiMatch?.[1] ?? (pathOnly.startsWith("/") ? pathOnly : undefined);
}

function stepMatches(actual: string | undefined, expected: string | undefined): boolean {
    return !expected || actual === expected;
}

function secondaryStepMatches(actual: string | undefined, expected: string | undefined): boolean {
    return !expected || !actual || actual === expected;
}

function deduplicateRedactionPaths(paths: Array<string | undefined>): string[] {
    const output: string[] = [];
    const roots: string[] = [];
    for (const candidate of paths) {
        if (!candidate) {
            continue;
        }
        const resolved = path.resolve(candidate);
        if (roots.some((root) => isSameOrInsidePath(resolved, root))) {
            continue;
        }
        roots.push(resolved);
        output.push(candidate);
    }
    return output;
}

async function existingRedactionPaths(paths: string[]): Promise<string[]> {
    const output: string[] = [];
    for (const candidate of paths) {
        try {
            await stat(candidate);
            output.push(candidate);
        } catch (error) {
            const nodeError = error as NodeJS.ErrnoException;
            if (nodeError.code !== "ENOENT") {
                throw error;
            }
        }
    }
    return output;
}

function isSameOrInsidePath(filePath: string, root: string): boolean {
    const relative = path.relative(root, filePath);
    return relative === "" || (Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative));
}

async function staticContextManifestFileChecks(staticDir: string, files: unknown): Promise<RunAuditCheck[]> {
    if (!Array.isArray(files)) {
        return [];
    }

    const checks: RunAuditCheck[] = [];
    for (let index = 0; index < files.length; index += 1) {
        const entry = files[index];
        const entryPath = isRecord(entry) && typeof entry.path === "string" ? entry.path : `entry-${index}`;
        const id = checkIdForPath(entryPath);
        const shapeOk =
            isRecord(entry) &&
            typeof entry.kind === "string" &&
            entry.kind.length > 0 &&
            typeof entry.path === "string" &&
            isSafeManifestRelativePath(entry.path) &&
            typeof entry.hash === "string" &&
            /^sha256:[a-f0-9]{64}$/u.test(entry.hash) &&
            typeof entry.bytes === "number" &&
            Number.isInteger(entry.bytes) &&
            entry.bytes >= 0;
        checks.push({
            id: `static.context.file.${id}.shape`,
            ok: shapeOk,
            path: path.join(staticDir, "context.manifest.json"),
            message: `context.manifest.json files[${index}] must include safe path, kind, sha256 hash, and byte length`,
        });
        if (!shapeOk || !isRecord(entry) || typeof entry.path !== "string" || typeof entry.hash !== "string" || typeof entry.bytes !== "number") {
            continue;
        }

        const filePath = path.join(staticDir, entry.path);
        try {
            const bytes = await readFile(filePath);
            const actualHash = sha256(bytes);
            checks.push({
                id: `static.context.file.${id}.hash`,
                ok: actualHash === entry.hash,
                path: filePath,
                message: actualHash === entry.hash ? undefined : "context manifest hash does not match copied static catalog",
            });
            checks.push({
                id: `static.context.file.${id}.bytes`,
                ok: bytes.byteLength === entry.bytes,
                path: filePath,
                message: bytes.byteLength === entry.bytes ? undefined : "context manifest byte length does not match copied static catalog",
            });
        } catch (error) {
            checks.push(missingCheck(error, `static.context.file.${id}.readable`, filePath, "context manifest file is missing"));
        }
    }

    return checks;
}

function isSafeManifestRelativePath(filePath: string): boolean {
    if (!filePath || filePath.includes("\0") || filePath.includes("\\")) {
        return false;
    }
    if (path.posix.isAbsolute(filePath) || path.win32.isAbsolute(filePath)) {
        return false;
    }
    const normalized = path.posix.normalize(filePath);
    return normalized === filePath && normalized !== "." && normalized !== ".." && !normalized.startsWith("../");
}

async function readStaticCatalogCounts(staticDir: string): Promise<Array<{ fileName: string; count: number; parseCheck: RunAuditCheck }>> {
    const output: Array<{ fileName: string; count: number; parseCheck: RunAuditCheck }> = [];
    for (const fileName of requiredStaticFiles.filter((file) => file.endsWith(".catalog.json") || file === "docs.index.json")) {
        const filePath = path.join(staticDir, fileName);
        const audit = await readJsonValueAudit(filePath, `static.catalog.${fileName}.parse`, `${fileName} must parse as JSON`);
        const value = audit.value;
        let count = 0;
        if (Array.isArray(value)) {
            count = value.length;
        } else if (isRecord(value) && Array.isArray(value.events) && Array.isArray(value.opcodes)) {
            count = value.events.length + value.opcodes.length;
        }
        output.push({ fileName, count, parseCheck: audit.check });
    }
    return output;
}

async function readStaticRunId(runDir: string): Promise<string | undefined> {
    const build = await readJsonRecord(path.join(runDir, "static", "build.json"), true);
    return typeof build?.run_id === "string" && build.run_id.length > 0 ? build.run_id : undefined;
}

function expectedTrafficFor(featureId: string, summary: FeatureSummary | undefined): FeatureSummary["expected"] {
    return getBuiltInScenario(featureId)?.expected ?? summary?.expected;
}

function expectedTrafficChecks(summary: FeatureSummary, expectedTraffic: FeatureSummary["expected"]): RunAuditCheck[] {
    if (!expectedTraffic) {
        return [];
    }

    const checks: RunAuditCheck[] = [];
    for (const expected of expectedTraffic.http ?? []) {
        checks.push({
            id: `runtime.feature.expected.http.${expected.method}.${expected.route}`,
            ok: summary.traffic.some(
                (item) =>
                    item.type === "http" &&
                    item.method === expected.method &&
                    item.route === `${expected.method} ${expected.route}` &&
                    (item.status_codes?.some((status) => Number.isInteger(status) && status > 0) ?? false) &&
                    (!expected.step_id || item.step_id === expected.step_id) &&
                    (item.attribution === "direct" || item.attribution === "probable"),
            ),
            message: `missing expected HTTP request/response traffic ${expected.method} ${expected.route}`,
        });
    }
    for (const expected of expectedTraffic.gateway ?? []) {
        checks.push({
            id: `runtime.feature.expected.gateway.${expected.direction ?? "any"}.${expected.event ?? expected.opcode ?? "any"}`,
            ok: summary.traffic.some(
                (item) =>
                    item.type === "gateway" &&
                    (!expected.direction || item.direction === expected.direction) &&
                    (!expected.event || item.event === expected.event) &&
                    (typeof expected.opcode === "undefined" || item.opcode === expected.opcode) &&
                    (!expected.step_id || item.step_id === expected.step_id) &&
                    (item.attribution === "direct" || item.attribution === "probable"),
            ),
            message: `missing expected Gateway traffic ${expected.event ?? expected.opcode ?? "unknown"}`,
        });
    }
    return checks;
}

function expectedTrafficMetadataChecks(featureDir: string, featureId: string, summary: FeatureSummary): RunAuditCheck[] {
    const builtInExpected = getBuiltInScenario(featureId)?.expected;
    if (!builtInExpected) {
        return [];
    }

    return [
        {
            id: "runtime.feature.expected.registry_metadata",
            ok: expectedTrafficCovers(summary.expected, builtInExpected),
            path: path.join(featureDir, "summary.json"),
            message: "built-in summary expected metadata must include the registry expectations audited for this feature",
        },
    ];
}

function expectedTrafficCovers(actual: FeatureDefinition["expected"], required: FeatureDefinition["expected"]): boolean {
    if (!required) {
        return true;
    }
    if (!actual) {
        return false;
    }

    return (
        (required.http ?? []).every((expected) =>
            (actual.http ?? []).some((item) => item.method === expected.method && item.route === expected.route && item.step_id === expected.step_id),
        ) &&
        (required.gateway ?? []).every((expected) =>
            (actual.gateway ?? []).some(
                (item) => item.direction === expected.direction && item.event === expected.event && item.opcode === expected.opcode && item.step_id === expected.step_id,
            ),
        )
    );
}

function summaryEventConsistencyChecks(featureDir: string, summary: FeatureSummary, events: CaptureEvent[]): RunAuditCheck[] {
    const summaryPath = path.join(featureDir, "summary.json");
    const summarySteps = summary.steps ?? [];
    const eventSteps = summaryStepsFromEvents(events);
    const summaryStepIds = new Set(summarySteps.map((step) => step.step_id));
    const eventStepIds = new Set(eventSteps.map((step) => step.step_id));
    return [
        {
            id: "runtime.feature.summary.events.steps",
            ok: summarySteps.length === eventSteps.length && summarySteps.every((step, index) => step.step_id === eventSteps[index]?.step_id),
            path: summaryPath,
            message: "summary.json steps must match the ordered step markers in events.ndjson",
        },
        {
            id: "runtime.feature.summary.events.step_windows",
            ok: summarySteps.length === eventSteps.length && summarySteps.every((step, index) => summaryStepWindowMatches(step, eventSteps[index])),
            path: summaryPath,
            message: "summary.json step windows must match step.start/step.end timestamps and titles from events.ndjson",
        },
        {
            id: "runtime.feature.summary.events.actions",
            ok: summarySteps.length === eventSteps.length && summarySteps.every((step, index) => summaryStepActionsMatch(step, eventSteps[index])),
            path: summaryPath,
            message: "summary.json actions must match redacted ui.action markers from events.ndjson",
        },
        {
            id: "runtime.feature.summary.events.traffic_steps",
            ok: summary.traffic.every((item) => typeof item.step_id === "undefined" || (summaryStepIds.has(item.step_id) && eventStepIds.has(item.step_id))),
            path: summaryPath,
            message: "summary.json traffic step IDs must refer to audited summary steps and events.ndjson step markers",
        },
    ];
}

function summaryStepsFromEvents(events: CaptureEvent[]): NonNullable<FeatureSummary["steps"]> {
    const steps: NonNullable<FeatureSummary["steps"]> = [];
    for (const event of events) {
        if (event.kind === "step.start") {
            steps.push({
                step_id: event.step_id,
                title: event.title,
                started_at_ms: event.ts_monotonic_ms,
            });
            continue;
        }
        if (event.kind === "step.end") {
            const step = [...steps].reverse().find((item) => item.step_id === event.step_id && typeof item.ended_at_ms === "undefined");
            if (step) {
                step.ended_at_ms = event.ts_monotonic_ms;
                step.title ??= event.title;
            }
            continue;
        }
        if (event.kind === "ui.action") {
            const step = stepForSummaryAction(steps, event.step_id, event.ts_monotonic_ms);
            if (step) {
                step.actions = [...(step.actions ?? []), summaryActionFromEvent(event)];
            }
        }
    }
    return steps;
}

function stepForSummaryAction(
    steps: NonNullable<FeatureSummary["steps"]>,
    stepId: string | undefined,
    timestamp: number,
): NonNullable<FeatureSummary["steps"]>[number] | undefined {
    return [...steps]
        .reverse()
        .find((step) => (!stepId || step.step_id === stepId) && timestamp >= step.started_at_ms && timestamp <= (step.ended_at_ms ?? Number.MAX_SAFE_INTEGER));
}

function summaryActionFromEvent(event: Extract<CaptureEvent, { kind: "ui.action" }>): NonNullable<NonNullable<FeatureSummary["steps"]>[number]["actions"]>[number] {
    return {
        action: event.action,
        ...(event.target ? { target: event.target } : {}),
        ...(event.detail ? { detail: event.detail } : {}),
        ...(event.value_redacted ? { value_redacted: event.value_redacted } : {}),
        occurred_at_ms: event.ts_monotonic_ms,
    };
}

function summaryStepWindowMatches(summaryStep: NonNullable<FeatureSummary["steps"]>[number], eventStep: NonNullable<FeatureSummary["steps"]>[number] | undefined): boolean {
    return (
        Boolean(eventStep) &&
        summaryStep.step_id === eventStep?.step_id &&
        summaryStep.title === eventStep.title &&
        summaryStep.started_at_ms === eventStep.started_at_ms &&
        summaryStep.ended_at_ms === eventStep.ended_at_ms
    );
}

function summaryStepActionsMatch(summaryStep: NonNullable<FeatureSummary["steps"]>[number], eventStep: NonNullable<FeatureSummary["steps"]>[number] | undefined): boolean {
    if (!eventStep) {
        return false;
    }
    const summaryActions = summaryStep.actions ?? [];
    const eventActions = eventStep.actions ?? [];
    return summaryActions.length === eventActions.length && summaryActions.every((action, index) => summaryActionMatches(action, eventActions[index]));
}

function summaryActionMatches(
    summaryAction: NonNullable<NonNullable<FeatureSummary["steps"]>[number]["actions"]>[number],
    eventAction: NonNullable<NonNullable<FeatureSummary["steps"]>[number]["actions"]>[number] | undefined,
): boolean {
    return (
        Boolean(eventAction) &&
        summaryAction.action === eventAction?.action &&
        summaryAction.target === eventAction.target &&
        summaryAction.detail === eventAction.detail &&
        Boolean(summaryAction.value_redacted) === Boolean(eventAction.value_redacted) &&
        summaryAction.occurred_at_ms === eventAction.occurred_at_ms
    );
}

function preflightReportChecks(filePath: string, featureId: string, value: unknown): RunAuditCheck[] {
    const checks: RunAuditCheck[] = [];
    const record = isRecord(value) ? value : undefined;
    const storageState = record?.storage_state;
    const fixtures = record?.fixtures;
    const topLevelShapeOk =
        Boolean(record) &&
        typeof record?.ok === "boolean" &&
        isStringArray(record?.violations) &&
        isRecord(storageState) &&
        (typeof fixtures === "undefined" || isRecord(fixtures));
    checks.push({
        id: "runtime.feature.preflight.shape",
        ok: topLevelShapeOk,
        path: filePath,
        message: "preflight.json must be a redacted runtime preflight report with ok, violations, and storage_state",
    });
    if (!record) {
        return checks;
    }

    checks.push(...unknownObjectKeyChecks(filePath, "runtime.feature.preflight", record, new Set(["ok", "violations", "storage_state", "fixtures"])));
    checks.push({
        id: "runtime.feature.preflight.ok",
        ok: record.ok === true,
        path: filePath,
        message: "preflight.json must be ok before runtime artifacts are accepted",
    });
    checks.push({
        id: "runtime.feature.preflight.violations",
        ok: isStringArray(record.violations) && record.violations.length === 0,
        path: filePath,
        message: "accepted preflight.json must have no violations",
    });
    checks.push({
        id: "runtime.feature.preflight.redacted",
        ok: scanForSecrets(record).ok,
        path: filePath,
        message: "preflight.json must not contain storage-state values, raw fixture IDs, or secret-looking content",
    });
    checks.push(...preflightStorageStateChecks(filePath, storageState));
    checks.push(...preflightFixtureChecks(filePath, featureId, fixtures));
    return checks;
}

function preflightStorageStateChecks(filePath: string, value: unknown): RunAuditCheck[] {
    const checks: RunAuditCheck[] = [];
    if (!isRecord(value)) {
        checks.push({
            id: "runtime.feature.preflight.storage_state.shape",
            ok: false,
            path: filePath,
            message: "preflight storage_state must be a redacted object",
        });
        return checks;
    }

    checks.push(
        ...unknownObjectKeyChecks(
            filePath,
            "runtime.feature.preflight.storage_state",
            value,
            new Set([
                "path",
                "cookie_count",
                "origin_count",
                "discord_cookie_count",
                "discord_origin_count",
                "discord_auth_cookie_count",
                "discord_expired_auth_cookie_count",
                "discord_auth_storage_count",
                "has_discord_session",
                "storage_state_age_ms",
                "max_storage_state_age_ms",
                "storage_state_age_source",
                "storage_state_fresh",
                "earliest_cookie_expiry",
                "latest_cookie_expiry",
                "forbidden_storage_root",
                "parse_error",
            ]),
        ),
    );
    const countsOk = [
        value.cookie_count,
        value.origin_count,
        value.discord_cookie_count,
        value.discord_origin_count,
        value.discord_auth_cookie_count,
        value.discord_expired_auth_cookie_count,
        value.discord_auth_storage_count,
    ].every(isNonNegativeInteger);
    const freshnessOk =
        typeof value.storage_state_age_ms === "undefined" ||
        (isNonNegativeInteger(value.storage_state_age_ms) &&
            isNonNegativeInteger(value.max_storage_state_age_ms) &&
            isStorageStateAgeSource(value.storage_state_age_source) &&
            typeof value.storage_state_fresh === "boolean");
    const optionalFieldsOk =
        freshnessOk &&
        optionalPositiveNumber(value.earliest_cookie_expiry) &&
        optionalPositiveNumber(value.latest_cookie_expiry) &&
        (typeof value.forbidden_storage_root === "undefined" || value.forbidden_storage_root === "{forbidden_storage_root}") &&
        (typeof value.parse_error === "undefined" || typeof value.parse_error === "string");
    checks.push({
        id: "runtime.feature.preflight.storage_state.shape",
        ok: value.path === "{storage_state_path}" && countsOk && typeof value.has_discord_session === "boolean" && optionalFieldsOk,
        path: filePath,
        message: "preflight storage_state must contain only redacted path placeholders, counts, session status, and optional error metadata",
    });
    checks.push({
        id: "runtime.feature.preflight.storage_state.path",
        ok: value.path === "{storage_state_path}",
        path: filePath,
        message: "storage_state.path must be the durable placeholder, not a local path",
    });
    checks.push({
        id: "runtime.feature.preflight.storage_state.session",
        ok: value.has_discord_session === true && (Number(value.discord_auth_cookie_count) > 0 || Number(value.discord_auth_storage_count) > 0),
        path: filePath,
        message: "accepted preflight storage_state must prove an active Discord session without exposing session material",
    });
    checks.push({
        id: "runtime.feature.preflight.storage_state.counts",
        ok:
            countsOk &&
            Number(value.discord_cookie_count) <= Number(value.cookie_count) &&
            Number(value.discord_origin_count) <= Number(value.origin_count) &&
            Number(value.discord_auth_cookie_count) <= Number(value.discord_cookie_count) &&
            Number(value.discord_expired_auth_cookie_count) <= Number(value.discord_cookie_count) &&
            Number(value.discord_auth_cookie_count) + Number(value.discord_expired_auth_cookie_count) <= Number(value.discord_cookie_count) &&
            Number(value.discord_auth_storage_count) <= Number(value.discord_origin_count),
        path: filePath,
        message: "preflight storage_state Discord/session counts must be internally consistent",
    });
    checks.push({
        id: "runtime.feature.preflight.storage_state.expiry_range",
        ok:
            typeof value.earliest_cookie_expiry === "undefined" ||
            typeof value.latest_cookie_expiry === "undefined" ||
            Number(value.earliest_cookie_expiry) <= Number(value.latest_cookie_expiry),
        path: filePath,
        message: "preflight storage_state cookie expiry range must be ordered when present",
    });
    checks.push({
        id: "runtime.feature.preflight.storage_state.freshness",
        ok:
            value.storage_state_fresh === true &&
            isNonNegativeInteger(value.storage_state_age_ms) &&
            isNonNegativeInteger(value.max_storage_state_age_ms) &&
            isStorageStateAgeSource(value.storage_state_age_source) &&
            Number(value.storage_state_age_ms) <= Number(value.max_storage_state_age_ms),
        path: filePath,
        message: "accepted preflight storage_state must be freshly generated before runtime capture",
    });
    checks.push({
        id: "runtime.feature.preflight.storage_state.no_expired_auth_cookie",
        ok: Number(value.discord_expired_auth_cookie_count) === 0,
        path: filePath,
        message: "accepted preflight storage_state must not include expired Discord auth cookies",
    });
    checks.push({
        id: "runtime.feature.preflight.storage_state.no_parse_error",
        ok: typeof value.parse_error === "undefined",
        path: filePath,
        message: "accepted preflight storage_state must not include a parse_error",
    });
    checks.push({
        id: "runtime.feature.preflight.storage_state.no_forbidden_root",
        ok: typeof value.forbidden_storage_root === "undefined",
        path: filePath,
        message: "accepted preflight storage_state must not come from a forbidden artifact root",
    });
    return checks;
}

function preflightFixtureChecks(filePath: string, featureId: string, value: unknown): RunAuditCheck[] {
    const checks: RunAuditCheck[] = [];
    const feature = getBuiltInScenario(featureId);
    const requiredFixtures = feature?.requiredFixtures ?? [];
    const requiredDisposableFixtures = feature?.safety?.requiredDisposableFixtures ?? [];
    const requiresFixtureValidation = requiredFixtures.length > 0 || requiredDisposableFixtures.length > 0;
    if (requiresFixtureValidation) {
        checks.push({
            id: "runtime.feature.preflight.fixtures.present",
            ok: isRecord(value),
            path: filePath,
            message: "preflight.json must include redacted fixture validation for built-in scenario requirements",
        });
    }
    if (typeof value === "undefined") {
        return checks;
    }
    if (!isRecord(value)) {
        checks.push({
            id: "runtime.feature.preflight.fixtures.shape",
            ok: false,
            path: filePath,
            message: "preflight fixtures must be a redacted fixture validation object",
        });
        return checks;
    }

    checks.push(...unknownObjectKeyChecks(filePath, "runtime.feature.preflight.fixtures", value, new Set(["redacted_manifest", "validation", "disposable_validation"])));
    const redactedManifest = value.redacted_manifest;
    checks.push({
        id: "runtime.feature.preflight.fixtures.redacted_manifest",
        ok: isRecord(redactedManifest) && scanForSecrets(redactedManifest).ok,
        path: filePath,
        message: "preflight fixtures.redacted_manifest must be an object without raw fixture IDs or private file paths",
    });
    checks.push({
        id: "runtime.feature.preflight.fixtures.validation",
        ok: isFixtureValidationOk(value.validation),
        path: filePath,
        message: "preflight fixtures.validation must be ok with no missing required fixtures",
    });
    checks.push({
        id: "runtime.feature.preflight.fixtures.disposable_validation",
        ok: isDisposableFixtureValidationOk(value.disposable_validation),
        path: filePath,
        message: "preflight fixtures.disposable_validation must be ok with no missing or non-disposable destructive fixtures",
    });

    if (isRecord(redactedManifest)) {
        for (const fixturePath of requiredFixtures) {
            checks.push({
                id: `runtime.feature.preflight.fixtures.required.${checkIdForPath(fixturePath)}`,
                ok: typeof valueAtDottedPath(redactedManifest, fixturePath) !== "undefined",
                path: filePath,
                message: `redacted fixture manifest must include required fixture ${fixturePath}`,
            });
        }
        const disposable = Array.isArray(redactedManifest.disposable) ? redactedManifest.disposable : [];
        for (const fixturePath of requiredDisposableFixtures) {
            checks.push({
                id: `runtime.feature.preflight.fixtures.disposable.${checkIdForPath(fixturePath)}`,
                ok: disposable.includes(fixturePath),
                path: filePath,
                message: `redacted fixture manifest must mark destructive fixture ${fixturePath} as disposable`,
            });
        }
    }
    if (isRecord(value.disposable_validation) && Array.isArray(value.disposable_validation.required)) {
        for (const fixturePath of requiredDisposableFixtures) {
            checks.push({
                id: `runtime.feature.preflight.fixtures.disposable_required.${checkIdForPath(fixturePath)}`,
                ok: value.disposable_validation.required.includes(fixturePath),
                path: filePath,
                message: `disposable validation must include required destructive fixture ${fixturePath}`,
            });
        }
    }
    return checks;
}

function isFixtureValidationOk(value: unknown): boolean {
    return (
        isRecord(value) && value.ok === true && Array.isArray(value.missing) && value.missing.length === 0 && Object.keys(value).every((key) => key === "ok" || key === "missing")
    );
}

function isDisposableFixtureValidationOk(value: unknown): boolean {
    return (
        isRecord(value) &&
        value.ok === true &&
        Array.isArray(value.missing) &&
        value.missing.length === 0 &&
        Array.isArray(value.not_disposable) &&
        value.not_disposable.length === 0 &&
        isStringArray(value.required) &&
        Object.keys(value).every((key) => key === "ok" || key === "missing" || key === "not_disposable" || key === "required")
    );
}

function unknownObjectKeyChecks(filePath: string, idPrefix: string, value: Record<string, unknown>, allowedKeys: Set<string>): RunAuditCheck[] {
    return Object.keys(value)
        .filter((key) => !allowedKeys.has(key))
        .map((key) => ({
            id: `${idPrefix}.${checkIdForPath(key)}.unknown_key`,
            ok: false,
            path: filePath,
            message: `${key} is not an allowed key`,
        }));
}

function valueAtDottedPath(value: Record<string, unknown>, fixturePath: string): unknown {
    return fixturePath.split(".").reduce<unknown>((current, part) => {
        if (!isRecord(current)) {
            return undefined;
        }
        return current[part];
    }, value);
}

function isNonNegativeInteger(value: unknown): boolean {
    return Number.isInteger(value) && Number(value) >= 0;
}

function isStorageStateAgeSource(value: unknown): boolean {
    return value === "provided_created_at" || value === "file_mtime" || value === "unavailable";
}

function optionalPositiveNumber(value: unknown): boolean {
    return typeof value === "undefined" || (typeof value === "number" && Number.isFinite(value) && value > 0);
}

function featureSummaryShapeAudit(filePath: string, featureId: string, value: unknown): { summary?: FeatureSummary; checks: RunAuditCheck[] } {
    const checks: RunAuditCheck[] = [];
    const shapeOk =
        isRecord(value) &&
        typeof value.run_id === "string" &&
        typeof value.feature_id === "string" &&
        Array.isArray(value.traffic) &&
        typeof value.unknown_events === "number" &&
        typeof value.background_events === "number" &&
        typeof value.generated_at === "string" &&
        (typeof value.title === "undefined" || typeof value.title === "string") &&
        (typeof value.steps === "undefined" || Array.isArray(value.steps)) &&
        (typeof value.expected === "undefined" || isRecord(value.expected));
    checks.push({
        id: "runtime.feature.summary.shape",
        ok: shapeOk,
        path: filePath,
        message: "summary.json must be an object with run_id, feature_id, traffic, event counts, and generated_at",
    });

    const steps = isRecord(value) && Array.isArray(value.steps) ? value.steps : undefined;
    const stepsOk = typeof steps === "undefined" || steps.every(isFeatureSummaryStep);
    checks.push({
        id: "runtime.feature.summary.steps_shape",
        ok: stepsOk,
        path: filePath,
        message: "summary.json steps must include valid step IDs, timestamps, and redacted action metadata",
    });

    const traffic = isRecord(value) && Array.isArray(value.traffic) ? value.traffic : undefined;
    const trafficOk = Array.isArray(traffic) && traffic.every(isTrafficSummaryItem);
    checks.push({
        id: "runtime.feature.summary.traffic_shape",
        ok: trafficOk,
        path: filePath,
        message: "summary.json traffic entries must be valid HTTP or Gateway observations with attribution",
    });

    const expected = isRecord(value) ? value.expected : undefined;
    const expectedOk = typeof expected === "undefined" || isExpectedTrafficShape(expected);
    checks.push({
        id: "runtime.feature.summary.expected_shape",
        ok: expectedOk,
        path: filePath,
        message: "summary.json expected metadata must contain valid HTTP/Gateway expectation arrays",
    });

    return {
        summary: shapeOk && stepsOk && trafficOk && expectedOk && isRecord(value) ? (value as unknown as FeatureSummary) : undefined,
        checks,
    };
}

function isFeatureSummaryStep(value: unknown): boolean {
    const startedAtMs = isRecord(value) && typeof value.started_at_ms === "number" ? value.started_at_ms : undefined;
    const endedAtMs = isRecord(value) && typeof value.ended_at_ms === "number" ? value.ended_at_ms : undefined;
    return (
        isRecord(value) &&
        typeof value.step_id === "string" &&
        value.step_id.length > 0 &&
        (typeof value.title === "undefined" || typeof value.title === "string") &&
        typeof value.started_at_ms === "number" &&
        Number.isFinite(value.started_at_ms) &&
        (typeof value.ended_at_ms === "undefined" || (typeof value.ended_at_ms === "number" && Number.isFinite(value.ended_at_ms) && value.ended_at_ms >= value.started_at_ms)) &&
        (typeof value.actions === "undefined" ||
            (Array.isArray(value.actions) && value.actions.every((action) => isFeatureSummaryAction(action) && summaryActionWithinStepWindow(action, startedAtMs, endedAtMs))))
    );
}

function isFeatureSummaryAction(value: unknown): boolean {
    return (
        isRecord(value) &&
        typeof value.action === "string" &&
        uiActionKinds.has(value.action) &&
        (typeof value.target === "undefined" || typeof value.target === "string") &&
        (typeof value.detail === "undefined" || typeof value.detail === "string") &&
        (typeof value.value_redacted === "undefined" || typeof value.value_redacted === "boolean") &&
        typeof value.occurred_at_ms === "number" &&
        Number.isFinite(value.occurred_at_ms)
    );
}

function summaryActionWithinStepWindow(action: unknown, startedAtMs: number | undefined, endedAtMs: number | undefined): boolean {
    return (
        isRecord(action) &&
        typeof startedAtMs === "number" &&
        typeof action.occurred_at_ms === "number" &&
        action.occurred_at_ms >= startedAtMs &&
        (typeof endedAtMs === "undefined" || action.occurred_at_ms <= endedAtMs)
    );
}

function isTrafficSummaryItem(value: unknown): boolean {
    if (!isRecord(value) || typeof value.attribution !== "string" || !attributions.has(value.attribution)) {
        return false;
    }
    if (typeof value.step_id !== "undefined" && typeof value.step_id !== "string") {
        return false;
    }
    if (!optionalShapeHash(value.request_shape) || !optionalShapeHash(value.response_shape) || !optionalShapeHash(value.payload_shape)) {
        return false;
    }
    if (value.type === "http") {
        return typeof value.route === "string" && typeof value.method === "string" && optionalStatusCodes(value.status_codes);
    }
    if (value.type === "gateway") {
        return (value.direction === "sent" || value.direction === "received") && (typeof value.event === "string" || typeof value.opcode === "number");
    }
    return false;
}

function isExpectedTrafficShape(value: unknown): boolean {
    if (!isRecord(value)) {
        return false;
    }
    return (
        (typeof value.http === "undefined" || (Array.isArray(value.http) && value.http.every(isExpectedHttpShape))) &&
        (typeof value.gateway === "undefined" || (Array.isArray(value.gateway) && value.gateway.every(isExpectedGatewayShape)))
    );
}

function isExpectedHttpShape(value: unknown): boolean {
    return isRecord(value) && typeof value.method === "string" && typeof value.route === "string" && (typeof value.step_id === "undefined" || typeof value.step_id === "string");
}

function isExpectedGatewayShape(value: unknown): boolean {
    return (
        isRecord(value) &&
        (typeof value.direction === "undefined" || value.direction === "sent" || value.direction === "received") &&
        (typeof value.event === "undefined" || typeof value.event === "string") &&
        (typeof value.opcode === "undefined" || typeof value.opcode === "number") &&
        (typeof value.step_id === "undefined" || typeof value.step_id === "string")
    );
}

function optionalStatusCodes(value: unknown): boolean {
    return typeof value === "undefined" || (Array.isArray(value) && value.every((status) => Number.isInteger(status) && status > 0));
}

function optionalShapeHash(value: unknown): boolean {
    return typeof value === "undefined" || (typeof value === "string" && value.startsWith("sha256:"));
}

const attributions = new Set(["direct", "probable", "background", "unknown"]);

async function discoverFeatureIds(featuresDir: string): Promise<string[]> {
    const entries = await readdir(featuresDir, { withFileTypes: true });
    return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
}

async function fileExistsCheck(filePath: string, id: string): Promise<RunAuditCheck> {
    try {
        const details = await stat(filePath);
        return {
            id,
            ok: details.isFile(),
            path: filePath,
            message: details.isFile() ? undefined : "path exists but is not a file",
        };
    } catch (error) {
        return missingCheck(error, id, filePath, "missing required file");
    }
}

async function absentFileCheck(filePath: string, id: string, message = "raw artifact must not remain in durable run output"): Promise<RunAuditCheck> {
    try {
        await access(filePath);
        return {
            id,
            ok: false,
            path: filePath,
            message,
        };
    } catch {
        return {
            id,
            ok: true,
            path: filePath,
        };
    }
}

async function directoryExistsCheck(directoryPath: string, id: string): Promise<RunAuditCheck> {
    try {
        const details = await stat(directoryPath);
        return {
            id,
            ok: details.isDirectory(),
            path: directoryPath,
            message: details.isDirectory() ? undefined : "path exists but is not a directory",
        };
    } catch (error) {
        return missingCheck(error, id, directoryPath, "missing required directory");
    }
}

async function directoryHasFilesCheck(directoryPath: string, id: string): Promise<RunAuditCheck> {
    const exists = await directoryExistsCheck(directoryPath, id);
    if (!exists.ok) {
        return exists;
    }
    const files = await readdir(directoryPath);
    return {
        id,
        ok: files.length > 0,
        path: directoryPath,
        message: files.length > 0 ? undefined : "directory must contain captured artifacts",
    };
}

function missingCheck(error: unknown, id: string, filePath: string, message: string): RunAuditCheck {
    const nodeError = error as NodeJS.ErrnoException;
    return {
        id,
        ok: false,
        path: filePath,
        message: nodeError.code === "ENOENT" ? message : nodeError.message,
    };
}

async function readJsonArrayAudit(filePath: string, id: string, message: string): Promise<{ entries?: unknown[]; check: RunAuditCheck }> {
    try {
        const value = await readJsonFile<unknown>(filePath);
        const ok = Array.isArray(value);
        return {
            entries: ok ? value : undefined,
            check: {
                id,
                ok,
                path: filePath,
                message: ok ? undefined : message,
            },
        };
    } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;
        return {
            check: {
                id,
                ok: false,
                path: filePath,
                message: nodeError.code === "ENOENT" ? "missing required file" : nodeError.message,
            },
        };
    }
}

async function readJsonValueAudit(filePath: string, id: string, message: string): Promise<{ value?: unknown; check: RunAuditCheck }> {
    try {
        const value = await readJsonFile<unknown>(filePath);
        return {
            value,
            check: {
                id,
                ok: true,
                path: filePath,
            },
        };
    } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;
        return {
            check: {
                id,
                ok: false,
                path: filePath,
                message: nodeError.code === "ENOENT" ? "missing required file" : `${message}: ${nodeError.message}`,
            },
        };
    }
}

async function readOptionalJsonValueAudit(filePath: string, id: string, message: string): Promise<{ value?: unknown; check: RunAuditCheck } | undefined> {
    try {
        await access(filePath);
    } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;
        if (nodeError.code === "ENOENT") {
            return undefined;
        }
        throw error;
    }
    return readJsonValueAudit(filePath, id, message);
}

async function readJsonRecord(filePath: string, suppressParseErrors = false): Promise<Record<string, unknown> | undefined> {
    const value = suppressParseErrors ? await readJsonFileIfExists<unknown>(filePath, true) : await readJsonFileIfExists<unknown>(filePath);
    return isRecord(value) ? value : undefined;
}

async function readJsonFileIfExists<T>(filePath: string, suppressParseErrors = false): Promise<T | undefined> {
    try {
        return await readJsonFile<T>(filePath);
    } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;
        if (nodeError.code === "ENOENT" || suppressParseErrors) {
            return undefined;
        }
        throw error;
    }
}

async function readTextFileAudit(filePath: string, id: string, message: string): Promise<{ text?: string; check: RunAuditCheck }> {
    try {
        const text = await readFile(filePath, "utf8");
        return {
            text,
            check: {
                id,
                ok: true,
                path: filePath,
            },
        };
    } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;
        return {
            check: {
                id,
                ok: false,
                path: filePath,
                message: nodeError.code === "ENOENT" ? "missing required file" : `${message}: ${nodeError.message}`,
            },
        };
    }
}

async function readNdjsonAudit(filePath: string, id: string): Promise<{ events?: CaptureEvent[]; check: RunAuditCheck }> {
    try {
        const raw = await readFile(filePath, "utf8");
        const values = raw
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => JSON.parse(line) as unknown);
        const violations = values.flatMap((event, index) => captureEventShapeViolations(event, index));
        return {
            events: violations.length === 0 ? (values as CaptureEvent[]) : undefined,
            check: {
                id,
                ok: violations.length === 0,
                path: filePath,
                message: violations.length === 0 ? undefined : `invalid event shape: ${violations.slice(0, 5).join(", ")}`,
            },
        };
    } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;
        return {
            check: {
                id,
                ok: false,
                path: filePath,
                message: nodeError.code === "ENOENT" ? "missing required file" : `invalid NDJSON: ${nodeError.message}`,
            },
        };
    }
}

function captureEventShapeViolations(value: unknown, index: number): string[] {
    const prefix = `line ${index + 1}`;
    if (!isRecord(value)) {
        return [`${prefix}:event_not_object`];
    }

    const kind = typeof value.kind === "string" ? value.kind : undefined;
    const violations = commonEventShapeViolations(value, prefix);
    switch (kind) {
        case "step.start":
        case "step.end":
            requireString(value.step_id, `${prefix}.step_id`, violations);
            optionalString(value.title, `${prefix}.title`, violations);
            break;
        case "ui.action":
            if (typeof value.action !== "string" || !uiActionKinds.has(value.action)) {
                violations.push(`${prefix}.action`);
            }
            optionalString(value.target, `${prefix}.target`, violations);
            optionalString(value.detail, `${prefix}.detail`, violations);
            optionalBoolean(value.value_redacted, `${prefix}.value_redacted`, violations);
            break;
        case "http.request":
            requireString(value.cdp_request_id, `${prefix}.cdp_request_id`, violations);
            requireString(value.method, `${prefix}.method`, violations);
            requireString(value.url, `${prefix}.url`, violations);
            requireString(value.normalized_route, `${prefix}.normalized_route`, violations);
            requireTrue(value.headers_redacted, `${prefix}.headers_redacted`, violations);
            optionalString(value.request_body_shape_hash, `${prefix}.request_body_shape_hash`, violations);
            break;
        case "playwright.http.request":
            requireString(value.playwright_request_id, `${prefix}.playwright_request_id`, violations);
            requireString(value.method, `${prefix}.method`, violations);
            requireString(value.url, `${prefix}.url`, violations);
            requireString(value.normalized_route, `${prefix}.normalized_route`, violations);
            requireTrue(value.headers_redacted, `${prefix}.headers_redacted`, violations);
            optionalString(value.request_body_shape_hash, `${prefix}.request_body_shape_hash`, violations);
            break;
        case "http.response":
            requireString(value.cdp_request_id, `${prefix}.cdp_request_id`, violations);
            optionalString(value.method, `${prefix}.method`, violations);
            requireString(value.url, `${prefix}.url`, violations);
            requireString(value.normalized_route, `${prefix}.normalized_route`, violations);
            requireNumber(value.status, `${prefix}.status`, violations);
            requireTrue(value.headers_redacted, `${prefix}.headers_redacted`, violations);
            optionalString(value.response_body_shape_hash, `${prefix}.response_body_shape_hash`, violations);
            break;
        case "playwright.http.response":
            requireString(value.playwright_request_id, `${prefix}.playwright_request_id`, violations);
            optionalString(value.method, `${prefix}.method`, violations);
            requireString(value.url, `${prefix}.url`, violations);
            requireString(value.normalized_route, `${prefix}.normalized_route`, violations);
            requireNumber(value.status, `${prefix}.status`, violations);
            requireTrue(value.headers_redacted, `${prefix}.headers_redacted`, violations);
            optionalString(value.response_body_shape_hash, `${prefix}.response_body_shape_hash`, violations);
            break;
        case "http.failure":
            requireString(value.cdp_request_id, `${prefix}.cdp_request_id`, violations);
            optionalString(value.url, `${prefix}.url`, violations);
            optionalString(value.normalized_route, `${prefix}.normalized_route`, violations);
            optionalString(value.error_text, `${prefix}.error_text`, violations);
            break;
        case "http.request.extra_info":
        case "http.response.extra_info":
            requireString(value.cdp_request_id, `${prefix}.cdp_request_id`, violations);
            requireTrue(value.headers_redacted, `${prefix}.headers_redacted`, violations);
            optionalNumber(value.status, `${prefix}.status`, violations);
            break;
        case "ws.created":
        case "ws.closed":
        case "ws.error":
        case "playwright.ws.created":
        case "playwright.ws.closed":
        case "playwright.ws.error":
            requireString(value.websocket_id, `${prefix}.websocket_id`, violations);
            requireString(value.url, `${prefix}.url`, violations);
            optionalString(value.error_text, `${prefix}.error_text`, violations);
            break;
        case "ws.handshake.request":
        case "ws.handshake.response":
            requireString(value.websocket_id, `${prefix}.websocket_id`, violations);
            requireString(value.url, `${prefix}.url`, violations);
            requireTrue(value.headers_redacted, `${prefix}.headers_redacted`, violations);
            optionalNumber(value.status, `${prefix}.status`, violations);
            optionalString(value.status_text, `${prefix}.status_text`, violations);
            break;
        case "ws.frame.sent":
        case "ws.frame.received":
        case "playwright.ws.frame.sent":
        case "playwright.ws.frame.received":
            requireString(value.websocket_id, `${prefix}.websocket_id`, violations);
            requireString(value.url, `${prefix}.url`, violations);
            if (value.direction !== "sent" && value.direction !== "received") {
                violations.push(`${prefix}.direction`);
            }
            optionalNumber(value.opcode, `${prefix}.opcode`, violations);
            optionalString(value.gateway_event, `${prefix}.gateway_event`, violations);
            optionalNumber(value.sequence, `${prefix}.sequence`, violations);
            optionalString(value.payload_shape_hash, `${prefix}.payload_shape_hash`, violations);
            break;
        case "runtime.abort":
            if (value.reason !== "rate_limited" && value.reason !== "captcha" && value.reason !== "checkpoint") {
                violations.push(`${prefix}.reason`);
            }
            requireString(value.message, `${prefix}.message`, violations);
            requireTrue(value.quarantine, `${prefix}.quarantine`, violations);
            optionalNumber(value.status, `${prefix}.status`, violations);
            optionalNumber(value.retry_after_ms, `${prefix}.retry_after_ms`, violations);
            break;
        default:
            violations.push(`${prefix}.kind`);
    }
    return violations;
}

function commonEventShapeViolations(event: Record<string, unknown>, prefix: string): string[] {
    const violations: string[] = [];
    requireString(event.run_id, `${prefix}.run_id`, violations);
    requireString(event.feature_id, `${prefix}.feature_id`, violations);
    requireNumber(event.ts_monotonic_ms, `${prefix}.ts_monotonic_ms`, violations);
    optionalString(event.step_id, `${prefix}.step_id`, violations);
    return violations;
}

function requireString(value: unknown, field: string, violations: string[]): void {
    if (typeof value !== "string" || value.length === 0) {
        violations.push(field);
    }
}

function optionalString(value: unknown, field: string, violations: string[]): void {
    if (typeof value !== "undefined" && typeof value !== "string") {
        violations.push(field);
    }
}

function requireNumber(value: unknown, field: string, violations: string[]): void {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        violations.push(field);
    }
}

function optionalNumber(value: unknown, field: string, violations: string[]): void {
    if (typeof value !== "undefined" && (typeof value !== "number" || !Number.isFinite(value))) {
        violations.push(field);
    }
}

function optionalBoolean(value: unknown, field: string, violations: string[]): void {
    if (typeof value !== "undefined" && typeof value !== "boolean") {
        violations.push(field);
    }
}

function requireTrue(value: unknown, field: string, violations: string[]): void {
    if (value !== true) {
        violations.push(field);
    }
}

const uiActionKinds = new Set(["goto-channel", "expect-ready", "expect-network", "expect-gateway", "fill", "click", "context-click", "press", "type", "set-input-files"]);

async function readOptionalNdjsonAudit(filePath: string, id: string): Promise<{ events?: CaptureEvent[]; check: RunAuditCheck } | undefined> {
    try {
        await stat(filePath);
    } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;
        if (nodeError.code === "ENOENT") {
            return undefined;
        }
        throw error;
    }
    return readNdjsonAudit(filePath, id);
}

function countEvents(events: CaptureEvent[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const event of events) {
        counts[event.kind] = (counts[event.kind] ?? 0) + 1;
    }
    return counts;
}

function hasEventPrefix(counts: Record<string, number>, prefix: string): boolean {
    return Object.entries(counts).some(([kind, count]) => kind.startsWith(prefix) && count > 0);
}

function hasLocalPathAsset(value: unknown): value is Record<string, unknown> & { local_path: string } {
    return isRecord(value) && typeof value.local_path === "string";
}

async function assetLocalIntegrityChecks(staticDir: string, asset: Record<string, unknown> & { local_path: string }): Promise<RunAuditCheck[]> {
    const filePath = path.join(staticDir, asset.local_path);
    const idPrefix = `static.asset_integrity.${path.basename(asset.local_path)}`;
    const expectedHash =
        typeof asset.local_hash === "string" ? asset.local_hash : asset.local_redacted === true ? undefined : typeof asset.hash === "string" ? asset.hash : undefined;
    const expectedBytes =
        typeof asset.local_bytes === "number" ? asset.local_bytes : asset.local_redacted === true ? undefined : typeof asset.bytes === "number" ? asset.bytes : undefined;
    try {
        const bytes = await readFile(filePath);
        const checks: RunAuditCheck[] = [];
        if (typeof expectedHash === "string") {
            const actualHash = sha256(bytes);
            checks.push({
                id: `${idPrefix}.local_hash`,
                ok: actualHash === expectedHash,
                path: filePath,
                message: actualHash === expectedHash ? undefined : "retained asset hash does not match assets.json integrity metadata",
            });
        } else {
            checks.push({
                id: `${idPrefix}.local_hash`,
                ok: false,
                path: filePath,
                message: "downloaded asset with local_path must include hash or local_hash integrity metadata",
            });
        }
        if (typeof expectedBytes === "number") {
            checks.push({
                id: `${idPrefix}.local_bytes`,
                ok: bytes.byteLength === expectedBytes,
                path: filePath,
                message: bytes.byteLength === expectedBytes ? undefined : "retained asset byte length does not match assets.json integrity metadata",
            });
        } else {
            checks.push({
                id: `${idPrefix}.local_bytes`,
                ok: false,
                path: filePath,
                message: "downloaded asset with local_path must include bytes or local_bytes integrity metadata",
            });
        }
        return checks;
    } catch {
        return [
            {
                id: `${idPrefix}.readable`,
                ok: false,
                path: filePath,
                message: "retained asset file could not be read for integrity checks",
            },
        ];
    }
}

function emptyStaticAudit(message: string): StaticRunAudit {
    return {
        ok: true,
        assets_count: 0,
        downloaded_assets_count: 0,
        catalog_counts: {},
        checks: [{ id: "static.disabled", ok: true, message }],
    };
}

function emptyRuntimeAudit(message: string): RuntimeRunAudit {
    return {
        ok: true,
        feature_count: 0,
        features: [],
        checks: [{ id: "runtime.disabled", ok: true, message }],
    };
}

function checksToViolations(checks: RunAuditCheck[], prefix: string): string[] {
    return checks.filter((check) => !check.ok).map((check) => `${prefix}:${check.id}${check.message ? `:${check.message}` : ""}`);
}
