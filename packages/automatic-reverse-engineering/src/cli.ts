#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildDocsIndex, type DocsIndexEntry } from "./collectors/static/docsIndex.js";
import { collectDiscordStaticSnapshot } from "./collectors/static/discordSnapshot.js";
import { extractExperimentCatalogFromAssets } from "./collectors/static/experimentsCatalog.js";
import { importGatewayCatalogFromSources } from "./collectors/static/gatewayCatalog.js";
import { importOpenApiRouteCatalog } from "./collectors/static/openapiCatalog.js";
import { importExpressSourceRouteCatalog } from "./collectors/static/sourceRouteCatalog.js";
import { defaultGithubSourceRefs, resolveGithubSourceRefs } from "./collectors/static/sourceRefs.js";
import { bundleStaticContext } from "./collectors/static/staticContext.js";
import {
    importUserdoccersGatewayCatalog,
    importUserdoccersRouteCatalog,
    importXhyromExperimentCatalog,
    importXhyromRouteCatalog,
    readUserdoccersMdxDocuments,
} from "./collectors/static/thirdPartySnapshots.js";
import {
    buildFixtureManifestTemplate,
    describeFixtureTemplate,
    FixtureManifest,
    redactFixtureManifest,
    validateDisposableFixtures,
    validateRequiredFixtures,
} from "./fixtures/manifest.js";
import { buildFixtureSeedPlan } from "./fixtures/seedPlan.js";
import { correlateFeatureTraffic } from "./processors/correlate.js";
import { buildGatewayCoverage, buildRouteCoverage } from "./processors/coverage.js";
import { diffBuildSnapshots, diffFeatureSummary, diffFeatureSummarySets, FeatureTrafficDiff } from "./processors/diff.js";
import { sanitizeHar } from "./processors/harSanitizer.js";
import { importMitmproxyFlowEvents } from "./processors/mitmproxyImport.js";
import { auditRedactionPaths } from "./processors/redactionAudit.js";
import { buildReviewQueue, type ReviewQueueItem } from "./processors/reviewQueue.js";
import { auditDataminingRun } from "./processors/runAudit.js";
import { buildSqliteIndexSql } from "./processors/sqliteIndex.js";
import { attachStaticCandidates, StaticCandidateOptions } from "./processors/staticCandidates.js";
import { renderGatewayCoverageMarkdown, renderRouteCoverageMarkdown } from "./reports/coverageReport.js";
import { renderBuildDiffMarkdown, renderFeatureDiffMarkdown } from "./reports/diffReport.js";
import { renderFeatureMarkdownReport, writeFeatureReport } from "./reports/featureReport.js";
import { validateRuntimePreflight } from "./runtime/preflight.js";
import { writeRuntimeFailureArtifact, writeRuntimeRunArtifacts } from "./runtime/failureArtifact.js";
import { builtInScenarios, getBuiltInScenario } from "./scenarios/registry.js";
import {
    AssetSnapshot,
    BuildSnapshot,
    DiscordClientChannel,
    FeatureDefinition,
    FeatureSummary,
    GatewayCatalog,
    RouteCatalogEntry,
    RuntimeFailureArtifact,
    SourceRefs,
    StaticSnapshot,
} from "./types.js";
import { readJsonFile, writeJsonFile } from "./util/fs.js";
import { readNdjsonEvents } from "./runtime/eventsFile.js";
import { NdjsonEventWriter } from "./runtime/ndjson.js";
import { runPlaywrightRuntimeFeature } from "./runtime/playwrightRuntimeRunner.js";
import { type FeatureScenario } from "./scenarios/feature.js";

const commands = new Map<string, (args: Map<string, string>) => Promise<void>>([
    ["collect-static", collectStaticCommand],
    ["bundle-static-context", bundleStaticContextCommand],
    ["resolve-source-refs", resolveSourceRefsCommand],
    ["import-openapi", importOpenApiCommand],
    ["import-source-routes", importSourceRoutesCommand],
    ["import-gateway-source", importGatewayCommand],
    ["import-xhyrom-routes", importXhyromRoutesCommand],
    ["import-xhyrom-experiments", importXhyromExperimentsCommand],
    ["import-userdoccers-routes", importUserdoccersRoutesCommand],
    ["import-userdoccers-gateway", importUserdoccersGatewayCommand],
    ["report-feature", reportFeatureCommand],
    ["coverage", coverageCommand],
    ["diff-feature", diffFeatureCommand],
    ["diff-build", diffBuildCommand],
    ["annotate-static", annotateStaticCommand],
    ["extract-experiments", extractExperimentsCommand],
    ["build-docs-index", buildDocsIndexCommand],
    ["validate-redaction", validateRedactionCommand],
    ["validate-fixtures", validateFixturesCommand],
    ["fixture-template", fixtureTemplateCommand],
    ["fixture-seed-plan", fixtureSeedPlanCommand],
    ["preflight-runtime", preflightRuntimeCommand],
    ["run-playwright-feature", runPlaywrightFeatureCommand],
    ["sanitize-har", sanitizeHarCommand],
    ["import-mitmproxy", importMitmproxyCommand],
    ["review-queue", reviewQueueCommand],
    ["export-sqlite-index", exportSqliteIndexCommand],
    ["audit-run", auditRunCommand],
]);

async function main(): Promise<void> {
    const [commandName, ...rawArgs] = process.argv.slice(2);
    const command = commandName ? commands.get(commandName) : undefined;
    if (!command) {
        printUsage();
        process.exitCode = 1;
        return;
    }

    await command(parseArgs(rawArgs));
}

async function collectStaticCommand(args: Map<string, string>): Promise<void> {
    const runId = requiredArg(args, "run-id");
    const channel = channelArg(args.get("channel") ?? "canary");
    const output = requiredArg(args, "out");
    await collectDiscordStaticSnapshot({
        runId,
        channel,
        outputDir: output,
        downloadAssets: args.get("download-assets") === "true",
        discoverChunks: args.get("discover-chunks") !== "false",
        maxAssets: positiveIntegerArg(args.get("max-assets"), "max-assets"),
        sourceRefs: await sourceRefsFromArgs(args),
    });
}

async function bundleStaticContextCommand(args: Map<string, string>): Promise<void> {
    const runDir = args.get("run-dir");
    const staticDir = args.get("static-dir") ?? (runDir ? path.join(runDir, "static") : requiredArg(args, "static-dir"));
    await bundleStaticContext({
        staticDir,
        catalogs: {
            routes: args.get("routes"),
            source_routes: args.get("source-routes"),
            gateway: args.get("gateway"),
            experiments: args.get("experiments"),
            docs_index: args.get("docs"),
            xhyrom_routes: args.get("xhyrom-routes"),
            xhyrom_experiments: args.get("xhyrom-experiments"),
            userdoccers_routes: args.get("userdoccers-routes"),
            userdoccers_gateway: args.get("userdoccers-gateway"),
        },
        sourceRefs: await sourceRefsFromArgs(args),
        manifestPath: args.get("out"),
        updateBuild: args.get("update-build") !== "false",
    });
}

async function resolveSourceRefsCommand(args: Map<string, string>): Promise<void> {
    const refs = defaultGithubSourceRefs.map((sourceRef) => {
        const keySpecificRef = args.get(`${sourceRef.key.replace(/_/g, "-")}-ref`);
        const aliasRef = sourceRef.key === "xhyrom_routes_commit" ? args.get("xhyrom-ref") : sourceRef.key === "userdoccers_commit" ? args.get("userdoccers-ref") : undefined;
        return {
            ...sourceRef,
            ref: keySpecificRef ?? aliasRef ?? sourceRef.ref,
        };
    });
    await writeJsonFile(requiredArg(args, "out"), await resolveGithubSourceRefs({ refs }));
}

async function importOpenApiCommand(args: Map<string, string>): Promise<void> {
    const input = requiredArg(args, "input");
    const output = requiredArg(args, "out");
    const openApi = await readJsonFile(input);
    const routes = importOpenApiRouteCatalog(openApi, {
        source: args.get("source") ?? path.basename(input),
    });
    await writeJsonFile(output, routes);
}

async function importSourceRoutesCommand(args: Map<string, string>): Promise<void> {
    const root = requiredArg(args, "root");
    const output = requiredArg(args, "out");
    const routes = await importExpressSourceRouteCatalog(root, {
        source: args.get("source"),
    });
    await writeJsonFile(output, routes);
}

async function importGatewayCommand(args: Map<string, string>): Promise<void> {
    const constantsPath = requiredArg(args, "constants");
    const handlersPath = requiredArg(args, "handlers");
    const eventsPath = requiredArg(args, "events");
    const output = requiredArg(args, "out");
    const schemasPath = args.get("schemas");
    const catalog = importGatewayCatalogFromSources(
        {
            constants: await readFile(constantsPath, "utf8"),
            opcodeHandlers: await readFile(handlersPath, "utf8"),
            events: await readFile(eventsPath, "utf8"),
            schemasIndex: schemasPath ? await readFile(schemasPath, "utf8") : undefined,
        },
        { source: args.get("source") ?? "spacebar-source" },
    );
    await writeJsonFile(output, catalog);
}

async function importXhyromRoutesCommand(args: Map<string, string>): Promise<void> {
    const input = requiredArg(args, "input");
    await writeJsonFile(requiredArg(args, "out"), importXhyromRouteCatalog(await readJsonFile(input), { source: args.get("source") }));
}

async function importXhyromExperimentsCommand(args: Map<string, string>): Promise<void> {
    const input = requiredArg(args, "input");
    await writeJsonFile(requiredArg(args, "out"), importXhyromExperimentCatalog(await readJsonFile(input), { source: args.get("source") }));
}

async function importUserdoccersRoutesCommand(args: Map<string, string>): Promise<void> {
    const root = requiredArg(args, "root");
    await writeJsonFile(requiredArg(args, "out"), importUserdoccersRouteCatalog(await readUserdoccersMdxDocuments(root), { source: args.get("source") }));
}

async function importUserdoccersGatewayCommand(args: Map<string, string>): Promise<void> {
    await writeJsonFile(
        requiredArg(args, "out"),
        importUserdoccersGatewayCatalog(
            {
                gatewayEvents: await readFile(requiredArg(args, "events"), "utf8"),
                opcodes: await readFile(requiredArg(args, "opcodes"), "utf8"),
            },
            { source: args.get("source") },
        ),
    );
}

async function reportFeatureCommand(args: Map<string, string>): Promise<void> {
    const eventsPath = requiredArg(args, "events");
    const output = requiredArg(args, "out");
    const feature = await featureFromArgs(args);
    const events = await readNdjsonEvents(eventsPath);
    const baselinePath = args.get("baseline");
    const baselineEvents = baselinePath ? await readNdjsonEvents(baselinePath) : undefined;
    const fixturesPath = args.get("fixtures");
    const fixtures = fixturesPath ? await readJsonFile<FixtureManifest>(fixturesPath) : undefined;
    const staticSnapshot = await staticSnapshotFromBuildPath(args.get("build"), false);
    const docsIndex = await docsIndexFromPath(args.get("docs"), false);
    const summary = correlateFeatureTraffic({ feature, events, baselineEvents });
    await writeFeatureReport(output, { summary, staticSnapshot, fixtures, docsIndex });
}

async function coverageCommand(args: Map<string, string>): Promise<void> {
    const summaries = await readSummaryList(requiredArg(args, "summaries"));
    const output = requiredArg(args, "out");
    const builds = args.get("builds") ? await readBuildList(args.get("builds") ?? "") : undefined;
    const routeCatalog = args.get("routes") ? await readJsonFile<RouteCatalogEntry[]>(args.get("routes") ?? "") : undefined;
    const gatewayCatalog = args.get("gateway") ? await readJsonFile<GatewayCatalog>(args.get("gateway") ?? "") : undefined;
    const includeBackground = args.get("include-background") === "true";
    const routeCoverage = buildRouteCoverage(summaries, { builds, routeCatalog, includeBackground });
    const gatewayCoverage = buildGatewayCoverage(summaries, { builds, gatewayCatalog, includeBackground });
    await writeJsonFile(path.join(output, "routes.coverage.json"), routeCoverage);
    await writeJsonFile(path.join(output, "gateway.coverage.json"), gatewayCoverage);
    await writeFile(path.join(output, "routes.coverage.md"), renderRouteCoverageMarkdown(routeCoverage), "utf8");
    await writeFile(path.join(output, "gateway.coverage.md"), renderGatewayCoverageMarkdown(gatewayCoverage), "utf8");
}

async function diffFeatureCommand(args: Map<string, string>): Promise<void> {
    const base = await readJsonFile<FeatureSummary>(requiredArg(args, "base"));
    const head = await readJsonFile<FeatureSummary>(requiredArg(args, "head"));
    const diff = diffFeatureSummary(base, head, { includeBackground: args.get("include-background") === "true" });
    await writeJsonFile(requiredArg(args, "out"), diff);
    const markdownOut = args.get("markdown-out");
    if (markdownOut) {
        await writeFile(markdownOut, renderFeatureDiffMarkdown(diff), "utf8");
    }
}

async function diffBuildCommand(args: Map<string, string>): Promise<void> {
    const baseBuild = await readJsonFile<BuildSnapshot>(requiredArg(args, "base-build"));
    const headBuild = await readJsonFile<BuildSnapshot>(requiredArg(args, "head-build"));
    const baseSummariesPath = args.get("base-summaries");
    const headSummariesPath = args.get("head-summaries");
    const reviewQueuePath = args.get("review-queue");
    const featureDiffs =
        baseSummariesPath && headSummariesPath
            ? diffFeatureSummarySets(await readSummaryList(baseSummariesPath), await readSummaryList(headSummariesPath), {
                  includeBackground: args.get("include-background") === "true",
              })
            : args.get("diffs")
              ? await readDiffList(args.get("diffs") ?? "")
              : [];
    const reviewQueue = reviewQueuePath ? await readReviewQueueList(reviewQueuePath) : undefined;
    const diff = diffBuildSnapshots(baseBuild, headBuild, { featureDiffs, reviewQueue });
    await writeJsonFile(requiredArg(args, "out"), diff);
    const markdownOut = args.get("markdown-out");
    if (markdownOut) {
        await writeFile(markdownOut, renderBuildDiffMarkdown(diff), "utf8");
    }
}

async function annotateStaticCommand(args: Map<string, string>): Promise<void> {
    const summary = await readJsonFile<FeatureSummary>(requiredArg(args, "summary"));
    const assets = await readJsonFile<AssetSnapshot[]>(requiredArg(args, "assets"));
    const staticDir = requiredArg(args, "static-dir");
    const experimentsPath = args.get("experiments") ?? path.join(staticDir, "experiments.catalog.json");
    const experiments = await readOptionalJsonArray(experimentsPath);
    const annotated = await attachStaticCandidates(summary, {
        assets,
        staticDir,
        maxBytesPerAsset: positiveIntegerArg(args.get("max-bytes-per-asset"), "max-bytes-per-asset"),
        experiments,
    });
    await writeJsonFile(requiredArg(args, "out"), annotated);
    const markdownOut = args.get("markdown-out");
    if (markdownOut) {
        const fixturesPath = args.get("fixtures");
        await writeFile(
            markdownOut,
            renderFeatureMarkdownReport({
                summary: annotated,
                staticSnapshot: await staticSnapshotFromBuildPath(args.get("build"), false),
                docsIndex: await docsIndexFromPath(args.get("docs"), false),
                fixtures: fixturesPath ? await readJsonFile<FixtureManifest>(fixturesPath) : undefined,
            }),
            "utf8",
        );
    }
}

async function extractExperimentsCommand(args: Map<string, string>): Promise<void> {
    const assets = await readJsonFile<AssetSnapshot[]>(requiredArg(args, "assets"));
    const experiments = await extractExperimentCatalogFromAssets(requiredArg(args, "static-dir"), assets);
    await writeJsonFile(requiredArg(args, "out"), experiments);
}

async function buildDocsIndexCommand(args: Map<string, string>): Promise<void> {
    const routesPath = args.get("routes");
    const gatewayPath = args.get("gateway");
    const routes = routesPath ? await readJsonFile<RouteCatalogEntry[]>(routesPath) : undefined;
    const gateway = gatewayPath ? await readJsonFile<GatewayCatalog>(gatewayPath) : undefined;
    await writeJsonFile(requiredArg(args, "out"), buildDocsIndex({ routes, gateway }));
}

async function validateRedactionCommand(args: Map<string, string>): Promise<void> {
    const input = requiredArg(args, "input");
    const result = await auditRedactionPaths(
        input
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
    );
    const output = args.get("out");
    if (output) {
        await writeJsonFile(output, result);
    }
    if (!result.ok) {
        throw new Error(`Redaction audit failed with ${result.violations.length} violation(s)`);
    }
}

async function validateFixturesCommand(args: Map<string, string>): Promise<void> {
    const manifest = await readJsonFile<FixtureManifest>(requiredArg(args, "fixtures"));
    const feature = await featureFromArgs(args);
    const result = validateRequiredFixtures(manifest, feature.requiredFixtures);
    const disposableResult = validateDisposableFixtures(manifest, feature.safety?.requiredDisposableFixtures);
    const output = args.get("out");
    if (output) {
        await writeJsonFile(output, {
            feature_id: feature.id,
            fixtures: redactFixtureManifest(manifest),
            validation: result,
            disposable_validation: disposableResult,
        });
    }
    if (!result.ok) {
        throw new Error(`Missing required fixtures for ${feature.id}: ${result.missing.join(", ")}`);
    }
    if (!disposableResult.ok) {
        throw new Error(
            `Unsafe disposable fixture targets for ${feature.id}: ${[
                ...disposableResult.missing.map((fixture) => `missing:${fixture}`),
                ...disposableResult.not_disposable.map((fixture) => `not_disposable:${fixture}`),
            ].join(", ")}`,
        );
    }
}

async function fixtureTemplateCommand(args: Map<string, string>): Promise<void> {
    const features = args.get("all-built-ins") === "true" ? [...builtInScenarios] : [builtInScenarioFromArgs(args)];
    const requiredFixtures = features.flatMap((feature) => feature.requiredFixtures ?? []);
    const requiredDisposableFixtures = features.flatMap((feature) => feature.safety?.requiredDisposableFixtures ?? []);
    await writeJsonFile(requiredArg(args, "out"), {
        features: features.map((feature) => feature.id).sort(),
        required_fixtures: Array.from(new Set(requiredFixtures)).sort(),
        required_disposable_fixtures: Array.from(new Set(requiredDisposableFixtures)).sort(),
        entries: describeFixtureTemplate(requiredFixtures),
        template: buildFixtureManifestTemplate(requiredFixtures, requiredDisposableFixtures),
    });
}

async function fixtureSeedPlanCommand(args: Map<string, string>): Promise<void> {
    const features = args.get("all-built-ins") === "true" ? [...builtInScenarios] : [builtInScenarioFromArgs(args)];
    await writeJsonFile(requiredArg(args, "out"), buildFixtureSeedPlan(features));
}

async function preflightRuntimeCommand(args: Map<string, string>): Promise<void> {
    const storageStatePath = requiredArg(args, "storage-state");
    const fixturesPath = args.get("fixtures");
    const fixtures = fixturesPath ? await readJsonFile<FixtureManifest>(fixturesPath) : undefined;
    const features = args.get("all-built-ins") === "true" ? [...builtInScenarios] : [await featureFromArgs(args)];
    const requiredFixtures = Array.from(new Set(features.flatMap((feature) => feature.requiredFixtures ?? []))).sort();
    const requiredDisposableFixtures = Array.from(new Set(features.flatMap((feature) => feature.safety?.requiredDisposableFixtures ?? []))).sort();
    const packageRoot = packageRootFromImportMeta();
    const repositoryRoot = path.resolve(packageRoot, "..", "..");
    const forbiddenStorageRoots = args.get("allow-artifact-storage-state") === "true" ? [] : [path.join(packageRoot, "data"), path.join(repositoryRoot, ".git")];
    const report = await validateRuntimePreflight({
        storageStatePath,
        fixtures,
        requiredFixtures,
        requiredDisposableFixtures,
        forbiddenStorageRoots,
        maxStorageStateAgeMs: positiveIntegerArg(args.get("max-storage-state-age-ms"), "max-storage-state-age-ms"),
        storageStateCreatedAtMs: timestampArg(args.get("storage-state-created-at"), "storage-state-created-at"),
    });
    const outputReport =
        args.get("all-built-ins") === "true"
            ? {
                  ...report,
                  features: features.map((feature) => feature.id).sort(),
                  required_fixtures: requiredFixtures,
                  required_disposable_fixtures: requiredDisposableFixtures,
                  fixture_template: buildFixtureManifestTemplate(requiredFixtures, requiredDisposableFixtures),
              }
            : report;
    const output = args.get("out");
    if (output) {
        await writeJsonFile(output, outputReport);
    }
    if (!report.ok) {
        throw new Error(`Runtime preflight failed: ${report.violations.join(", ")}`);
    }
}

async function runPlaywrightFeatureCommand(args: Map<string, string>): Promise<void> {
    const runId = requiredArg(args, "run-id");
    const outputDir = requiredArg(args, "out");
    const storageStatePath = requiredArg(args, "storage-state");
    const fixturesPath = requiredArg(args, "fixtures");
    const fixtures = await readJsonFile<FixtureManifest>(fixturesPath);
    const feature = builtInScenarioFromArgs(args);
    const packageRoot = packageRootFromImportMeta();
    const repositoryRoot = path.resolve(packageRoot, "..", "..");
    const forbiddenStorageRoots = args.get("allow-artifact-storage-state") === "true" ? [] : [path.join(packageRoot, "data"), path.join(repositoryRoot, ".git")];
    const preflight = await validateRuntimePreflight({
        storageStatePath,
        fixtures,
        requiredFixtures: feature.requiredFixtures,
        requiredDisposableFixtures: feature.safety?.requiredDisposableFixtures,
        forbiddenStorageRoots,
        maxStorageStateAgeMs: positiveIntegerArg(args.get("max-storage-state-age-ms"), "max-storage-state-age-ms"),
        storageStateCreatedAtMs: timestampArg(args.get("storage-state-created-at"), "storage-state-created-at"),
    });
    await writeJsonFile(path.join(outputDir, "features", feature.id, "preflight.json"), preflight);
    if (!preflight.ok) {
        const error = new Error(`Runtime preflight failed: ${preflight.violations.join(", ")}`);
        const failurePath = path.join(outputDir, "features", feature.id, "failure.json");
        await writeRuntimeFailureArtifact(failurePath, {
            runId,
            feature,
            stage: "preflight",
            error,
            fixtures,
            artifacts: {
                preflight_path: path.join(outputDir, "features", feature.id, "preflight.json"),
            },
        });
        await writeRuntimeRunArtifacts(path.join(outputDir, "features", feature.id, "run-artifacts.json"), {
            status: "failed",
            preflight_path: path.join(outputDir, "features", feature.id, "preflight.json"),
            failure_path: failurePath,
        });
        throw error;
    }

    const routeCatalogPath = args.get("routes");
    const routeCatalog = routeCatalogPath ? await readJsonFile<RouteCatalogEntry[]>(routeCatalogPath) : undefined;
    const staticSnapshot = await staticSnapshotFromBuildPath(args.get("build") ?? path.join(outputDir, "static", "build.json"), true);
    const docsIndex = await docsIndexFromPath(args.get("docs") ?? path.join(outputDir, "static", "docs.index.json"), true);
    const staticDir = args.get("static-dir") ?? path.join(outputDir, "static");
    const staticCandidates = await staticCandidateOptionsFromPaths({
        staticDir,
        assetsPath: args.get("assets") ?? path.join(staticDir, "assets.json"),
        experimentsPath: args.get("experiments") ?? path.join(staticDir, "experiments.catalog.json"),
        optional: true,
    });
    const result = await runPlaywrightRuntimeFeature({
        runId,
        outputDir,
        feature,
        storageStatePath,
        fixtures,
        routeCatalog,
        baselineEventsPath: args.get("baseline"),
        channel: channelArg(args.get("channel") ?? feature.channel ?? "canary"),
        baseUrl: args.get("base-url"),
        headless: args.get("headless") !== "false",
        timeoutMs: positiveIntegerArg(args.get("timeout-ms"), "timeout-ms"),
        failOnSecret: args.get("fail-on-secret") !== "false",
        enforceFixtureScope: args.get("enforce-fixture-scope") !== "false",
        captureScreenshots: args.get("capture-screenshots") !== "false",
        captureTrace: args.get("capture-trace") === "true",
        capturePlaywrightEvents: args.get("capture-playwright-events") !== "false",
        saveVideo: args.get("save-video") === "true",
        saveVideoOnFailure: args.get("save-video-on-failure") !== "false",
        recordHar: args.get("record-har") !== "false",
        staticSnapshot,
        staticCandidates,
        docsIndex,
    });
    await writeRuntimeRunArtifacts(path.join(outputDir, "features", feature.id, "run-artifacts.json"), {
        status: "passed",
        preflight_path: path.join(outputDir, "features", feature.id, "preflight.json"),
        events_path: result.eventsPath,
        playwright_events_path: result.playwrightEventsPath,
        summary_path: result.summaryPath,
        markdown_path: result.markdownPath,
        trace_path: result.tracePath,
        screenshots_dir: result.screenshotsDir,
        video_path: result.videoPath,
        redacted_har_path: result.redactedHarPath,
    });
}

async function sanitizeHarCommand(args: Map<string, string>): Promise<void> {
    const input = requiredArg(args, "input");
    const output = requiredArg(args, "out");
    const fixturesPath = args.get("fixtures");
    const fixtures = fixturesPath ? await readJsonFile<FixtureManifest>(fixturesPath) : undefined;
    const har = await readJsonFile(input);
    await writeJsonFile(
        output,
        sanitizeHar(har, {
            fixtures,
            stripBodies: args.get("strip-bodies") !== "false",
        }),
    );
}

async function importMitmproxyCommand(args: Map<string, string>): Promise<void> {
    const input = requiredArg(args, "input");
    const output = requiredArg(args, "out");
    const fixturesPath = args.get("fixtures");
    const routesPath = args.get("routes");
    const fixtures = fixturesPath ? await readJsonFile<FixtureManifest>(fixturesPath) : undefined;
    const routeCatalog = routesPath ? await readJsonFile<RouteCatalogEntry[]>(routesPath) : undefined;
    const result = importMitmproxyFlowEvents(await readJsonFile(input), {
        runId: requiredArg(args, "run-id"),
        feature: await featureFromArgs(args),
        fixtures,
        routeCatalog,
        defaultStepId: args.get("step-id"),
    });
    const writer = await NdjsonEventWriter.open({ filePath: output, fixtures });
    try {
        for (const event of result.events) {
            await writer.write(event);
        }
    } finally {
        await writer.close();
    }
    const summaryOut = args.get("summary-out");
    if (summaryOut) {
        await writeJsonFile(summaryOut, result.summary);
    }
}

async function reviewQueueCommand(args: Map<string, string>): Promise<void> {
    const summariesPath = args.get("summaries");
    const routeCatalogPath = args.get("routes");
    const gatewayCatalogPath = args.get("gateway");
    const diffsPath = args.get("diffs");
    const failuresPath = args.get("failures");
    if (!summariesPath && !diffsPath && !failuresPath) {
        throw new Error("review-queue requires at least one of --summaries, --diffs, or --failures");
    }
    const summaries = summariesPath ? await readSummaryList(summariesPath) : [];
    const routeCatalog = routeCatalogPath ? await readJsonFile<RouteCatalogEntry[]>(routeCatalogPath) : undefined;
    const gatewayCatalog = gatewayCatalogPath ? await readJsonFile<GatewayCatalog>(gatewayCatalogPath) : undefined;
    const diffs = diffsPath ? await readDiffList(diffsPath) : undefined;
    const failures = failuresPath ? await readFailureList(failuresPath) : undefined;
    await writeJsonFile(
        requiredArg(args, "out"),
        buildReviewQueue({
            summaries,
            routeCatalog,
            gatewayCatalog,
            diffs,
            failures,
            includeBackground: args.get("include-background") === "true",
        }),
    );
}

async function exportSqliteIndexCommand(args: Map<string, string>): Promise<void> {
    const summariesPath = args.get("summaries");
    const buildsPath = args.get("builds");
    const routesPath = args.get("routes");
    const gatewayPath = args.get("gateway");
    if (!summariesPath && !buildsPath && !routesPath && !gatewayPath) {
        throw new Error("export-sqlite-index requires at least one of --summaries, --builds, --routes, or --gateway");
    }

    const summaries = summariesPath ? await readSummaryList(summariesPath) : [];
    const builds = buildsPath ? await readBuildList(buildsPath) : [];
    const routeCatalog = routesPath ? await readJsonFile<RouteCatalogEntry[]>(routesPath) : undefined;
    const gatewayCatalog = gatewayPath ? await readJsonFile<GatewayCatalog>(gatewayPath) : undefined;
    await writeFile(
        requiredArg(args, "out"),
        buildSqliteIndexSql({
            summaries,
            builds,
            routeCatalog,
            gatewayCatalog,
            includeBackground: args.get("include-background") === "true",
            includeSamples: args.get("include-samples") === "true",
        }),
        "utf8",
    );
}

async function auditRunCommand(args: Map<string, string>): Promise<void> {
    const report = await auditDataminingRun({
        runDir: requiredArg(args, "run-dir"),
        requireStatic: args.get("require-static") !== "false",
        requireRuntime: args.get("require-runtime") !== "false",
        requiredFeatureIds: commaSeparatedArg(args.get("features")),
        redactionAuditPath: args.get("redaction-audit"),
        coverageDir: args.get("coverage-dir"),
        reviewQueuePath: args.get("review-queue"),
    });
    await writeJsonFile(requiredArg(args, "out"), report);
    if (!report.ok) {
        throw new Error(`Run audit failed with ${report.violations.length} violation(s)`);
    }
}

async function featureFromArgs(args: Map<string, string>): Promise<FeatureDefinition> {
    const featurePath = args.get("feature");
    if (featurePath) {
        return readJsonFile<FeatureDefinition>(featurePath);
    }

    const featureId = args.get("feature-id") ?? "message.send.basic";
    const builtInScenario = getBuiltInScenario(featureId);
    if (builtInScenario) {
        return builtInScenario;
    }

    return {
        id: featureId,
        title: args.get("title") ?? featureId,
    };
}

function builtInScenarioFromArgs(args: Map<string, string>): FeatureScenario {
    const featureId = args.get("feature-id") ?? "message.send.basic";
    const builtInScenario = getBuiltInScenario(featureId);
    if (!builtInScenario) {
        throw new Error(`run-playwright-feature requires a built-in scenario; unknown --feature-id ${featureId}`);
    }
    return builtInScenario;
}

async function readSummaryList(value: string): Promise<FeatureSummary[]> {
    const paths = value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    return Promise.all(paths.map((filePath) => readJsonFile<FeatureSummary>(filePath)));
}

async function readDiffList(value: string): Promise<FeatureTrafficDiff[]> {
    const paths = value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    return Promise.all(paths.map((filePath) => readJsonFile<FeatureTrafficDiff>(filePath)));
}

async function readReviewQueueList(value: string): Promise<ReviewQueueItem[]> {
    return readJsonFile<ReviewQueueItem[]>(value);
}

async function readBuildList(value: string): Promise<BuildSnapshot[]> {
    const paths = value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    return Promise.all(paths.map((filePath) => readJsonFile<BuildSnapshot>(filePath)));
}

async function readFailureList(value: string): Promise<RuntimeFailureArtifact[]> {
    const paths = value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    return Promise.all(paths.map((filePath) => readJsonFile<RuntimeFailureArtifact>(filePath)));
}

async function readOptionalJsonArray(filePath: string): Promise<unknown[] | undefined> {
    try {
        const value = await readJsonFile<unknown>(filePath);
        return Array.isArray(value) ? value : undefined;
    } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;
        if (nodeError.code === "ENOENT") {
            return undefined;
        }
        throw error;
    }
}

function commaSeparatedArg(value: string | undefined): string[] | undefined {
    if (!value) {
        return undefined;
    }
    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

async function staticSnapshotFromBuildPath(buildPath: string | undefined, optional: boolean): Promise<Pick<StaticSnapshot, "build"> | undefined> {
    if (!buildPath) {
        return undefined;
    }

    try {
        return { build: await readJsonFile<BuildSnapshot>(buildPath) };
    } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;
        if (optional && nodeError.code === "ENOENT") {
            return undefined;
        }
        throw error;
    }
}

async function docsIndexFromPath(docsPath: string | undefined, optional: boolean): Promise<DocsIndexEntry[] | undefined> {
    if (!docsPath) {
        return undefined;
    }

    try {
        return await readJsonFile<DocsIndexEntry[]>(docsPath);
    } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;
        if (optional && nodeError.code === "ENOENT") {
            return undefined;
        }
        throw error;
    }
}

async function staticCandidateOptionsFromPaths(options: {
    staticDir: string;
    assetsPath: string;
    experimentsPath: string;
    optional: boolean;
}): Promise<StaticCandidateOptions | undefined> {
    try {
        return {
            staticDir: options.staticDir,
            assets: await readJsonFile<AssetSnapshot[]>(options.assetsPath),
            experiments: await readOptionalJsonArray(options.experimentsPath),
        };
    } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;
        if (options.optional && nodeError.code === "ENOENT") {
            return undefined;
        }
        throw error;
    }
}

function parseArgs(rawArgs: string[]): Map<string, string> {
    const args = new Map<string, string>();
    for (let index = 0; index < rawArgs.length; index += 1) {
        const arg = rawArgs[index];
        if (!arg.startsWith("--")) {
            throw new Error(`Unexpected positional argument: ${arg}`);
        }

        const key = arg.slice(2);
        const next = rawArgs[index + 1];
        if (!next || next.startsWith("--")) {
            args.set(key, "true");
        } else {
            args.set(key, next);
            index += 1;
        }
    }

    return args;
}

function requiredArg(args: Map<string, string>, key: string): string {
    const value = args.get(key);
    if (!value) {
        throw new Error(`Missing required --${key}`);
    }

    return value;
}

function channelArg(value: string): DiscordClientChannel {
    if (value === "stable" || value === "ptb" || value === "canary") {
        return value;
    }

    throw new Error(`Invalid channel: ${value}`);
}

function positiveIntegerArg(value: string | undefined, key: string): number | undefined {
    if (typeof value === "undefined") {
        return undefined;
    }

    const number = Number(value);
    if (!Number.isInteger(number) || number < 1) {
        throw new Error(`--${key} must be a positive integer`);
    }

    return number;
}

function timestampArg(value: string | undefined, key: string): number | undefined {
    if (typeof value === "undefined") {
        return undefined;
    }

    const parsed = /^\d+$/.test(value) ? Number(value) : Date.parse(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error(`--${key} must be an ISO-8601 timestamp or Unix epoch milliseconds`);
    }

    return parsed;
}

async function sourceRefsFromArgs(args: Map<string, string>): Promise<SourceRefs> {
    const sourceRefs: SourceRefs = {};
    const sourceRefsFile = args.get("source-refs-file");
    if (sourceRefsFile) {
        Object.assign(sourceRefs, await readJsonFile<SourceRefs>(sourceRefsFile));
    }
    const xhyromRoutesCommit = args.get("xhyrom-routes-commit");
    const userdoccersCommit = args.get("userdoccers-commit");
    if (xhyromRoutesCommit) {
        sourceRefs.xhyrom_routes_commit = xhyromRoutesCommit;
    }
    if (userdoccersCommit) {
        sourceRefs.userdoccers_commit = userdoccersCommit;
    }

    for (const value of [args.get("source-refs"), args.get("source-ref")]) {
        if (!value) {
            continue;
        }

        for (const entry of value.split(",")) {
            const [rawKey, ...rawValue] = entry.split("=");
            const key = rawKey?.trim();
            const sourceRef = rawValue.join("=").trim();
            if (!key || !sourceRef) {
                throw new Error(`Invalid source ref entry: ${entry}`);
            }
            sourceRefs[key] = sourceRef;
        }
    }

    return sourceRefs;
}

function packageRootFromImportMeta(): string {
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

function printUsage(): void {
    console.error(`Usage:
  discord-datamine collect-static --run-id <id> --channel canary --out runs/<id> --download-assets
  discord-datamine resolve-source-refs --out data/catalogs/source-refs.json
  discord-datamine bundle-static-context --run-dir runs/<id> --source-routes data/catalogs/routes.source.catalog.json --gateway data/catalogs/gateway.catalog.json --docs data/catalogs/docs.index.json --xhyrom-routes data/catalogs/routes.xhyrom.catalog.json --userdoccers-routes data/catalogs/routes.userdoccers.catalog.json --source-refs xhyrom_routes_commit=<sha>,userdoccers_commit=<sha>
  discord-datamine import-openapi --input assets/openapi.json --out data/catalogs/routes.catalog.json
  discord-datamine import-source-routes --root src/api/routes --out data/catalogs/routes.source.catalog.json
  discord-datamine import-gateway-source --constants src/gateway/util/Constants.ts --handlers src/gateway/opcodes/index.ts --events src/util/interfaces/Event.ts --out data/catalogs/gateway.catalog.json
  discord-datamine import-xhyrom-routes --input /tmp/xhyrom/data/client/routes.json --out data/catalogs/routes.xhyrom.catalog.json
  discord-datamine import-xhyrom-experiments --input /tmp/xhyrom/data/client/experiments/experiments.json --out data/catalogs/experiments.xhyrom.catalog.json
  discord-datamine import-userdoccers-routes --root /tmp/userdoccers/pages --out data/catalogs/routes.userdoccers.catalog.json
  discord-datamine import-userdoccers-gateway --events /tmp/userdoccers/pages/gateway/gateway-events.mdx --opcodes /tmp/userdoccers/pages/gateway/opcodes-and-close-codes.mdx --out data/catalogs/gateway.userdoccers.catalog.json
  discord-datamine report-feature --events runs/<id>/features/message.send.basic/events.ndjson --build runs/<id>/static/build.json --docs runs/<id>/static/docs.index.json --fixtures fixtures.local.json --out runs/<id>/features/message.send.basic
  discord-datamine coverage --summaries runs/<id>/features/message.send.basic/summary.json --builds runs/<id>/static/build.json --routes data/catalogs/routes.source.catalog.json --gateway data/catalogs/gateway.catalog.json --out data/coverage
  discord-datamine diff-feature --base runs/base/features/message.send.basic/summary.json --head runs/head/features/message.send.basic/summary.json --out data/coverage/message.send.basic.diff.json --markdown-out data/coverage/message.send.basic.diff.md
  discord-datamine diff-build --base-build runs/base/static/build.json --head-build runs/head/static/build.json --base-summaries runs/base/features/message.send.basic/summary.json --head-summaries runs/head/features/message.send.basic/summary.json --out runs/head/build-diff.json --markdown-out runs/head/build-diff.md
  discord-datamine annotate-static --summary runs/<id>/features/message.send.basic/summary.json --assets runs/<id>/static/assets.json --static-dir runs/<id>/static --experiments runs/<id>/static/experiments.catalog.json --out runs/<id>/features/message.send.basic/summary.static.json
  discord-datamine extract-experiments --assets runs/<id>/static/assets.json --static-dir runs/<id>/static --out runs/<id>/static/experiments.catalog.json
  discord-datamine build-docs-index --routes data/catalogs/routes.source.catalog.json --gateway data/catalogs/gateway.catalog.json --out runs/<id>/static/docs.index.json
  discord-datamine validate-redaction --input runs/<id> --out runs/<id>/redaction-audit.json
  discord-datamine validate-fixtures --fixtures fixtures.local.json --feature-id message.send.basic --out runs/<id>/fixtures.redacted.json
  discord-datamine fixture-template --all-built-ins true --out packages/automatic-reverse-engineering/data/runs/<id>/fixtures.template.json
  discord-datamine fixture-seed-plan --all-built-ins true --out packages/automatic-reverse-engineering/data/runs/<id>/fixture-seed-plan.json
  discord-datamine preflight-runtime --storage-state ~/.config/spacebar-discord-storage/canary.storage-state.json --fixtures fixtures.local.json --feature-id message.send.basic --out packages/automatic-reverse-engineering/data/runs/<id>/preflight.json
  discord-datamine preflight-runtime --storage-state ~/.config/spacebar-discord-storage/canary.storage-state.json --fixtures fixtures.local.json --all-built-ins true --storage-state-created-at 2026-05-07T12:00:00Z --max-storage-state-age-ms 604800000 --out packages/automatic-reverse-engineering/data/runs/<id>/runtime-readiness.json
  discord-datamine run-playwright-feature --run-id <id> --out packages/automatic-reverse-engineering/data/runs/<id> --feature-id bootstrap.idle.session --storage-state ~/.config/spacebar-discord-storage/canary.storage-state.json --storage-state-created-at 2026-05-07T12:00:00Z --fixtures fixtures.local.json --routes packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json --docs packages/automatic-reverse-engineering/data/runs/<id>/static/docs.index.json --save-video-on-failure true --max-storage-state-age-ms 604800000
  discord-datamine sanitize-har --input /tmp/network.har --out runs/<id>/features/message.send.basic/network.redacted.har --fixtures fixtures.local.json
  discord-datamine import-mitmproxy --input /tmp/mitmproxy.flows.json --out runs/<id>/features/message.send.basic/mitmproxy.redacted.ndjson --summary-out runs/<id>/features/message.send.basic/mitmproxy.summary.json --run-id <id> --feature-id message.send.basic --fixtures fixtures.local.json --routes data/catalogs/routes.source.catalog.json
  discord-datamine review-queue --summaries runs/<id>/features/message.send.basic/summary.json --failures runs/<id>/features/message.send.basic/failure.json --routes data/catalogs/routes.source.catalog.json --gateway data/catalogs/gateway.catalog.json --out runs/<id>/review-queue.json
  discord-datamine export-sqlite-index --summaries runs/<id>/features/message.send.basic/summary.json --builds runs/<id>/static/build.json --routes data/catalogs/routes.source.catalog.json --gateway data/catalogs/gateway.catalog.json --include-samples false --out runs/<id>/datamine.sqlite.sql
  discord-datamine audit-run --run-dir packages/automatic-reverse-engineering/data/runs/<id> --features bootstrap.idle.session,message.send.basic --coverage-dir packages/automatic-reverse-engineering/data/coverage/<id> --review-queue packages/automatic-reverse-engineering/data/runs/<id>/review-queue.json --out packages/automatic-reverse-engineering/data/runs/<id>/run-audit.json`);
}

void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
