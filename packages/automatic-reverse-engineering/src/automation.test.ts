import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { constants as zlibConstants, createDeflate } from "node:zlib";

import { importGatewayCatalogFromSources } from "./collectors/static/gatewayCatalog.js";
import { importOpenApiRouteCatalog } from "./collectors/static/openapiCatalog.js";
import { importExpressSourceRouteCatalog } from "./collectors/static/sourceRouteCatalog.js";
import { buildDocsIndex } from "./collectors/static/docsIndex.js";
import { extractExperimentCatalogFromAssets } from "./collectors/static/experimentsCatalog.js";
import { collectDiscordStaticSnapshot, discoverAssetReferences } from "./collectors/static/discordSnapshot.js";
import { resolveGithubSourceRefs } from "./collectors/static/sourceRefs.js";
import { bundleStaticContext } from "./collectors/static/staticContext.js";
import {
    importUserdoccersGatewayCatalog,
    importUserdoccersRouteCatalog,
    importXhyromExperimentCatalog,
    importXhyromRouteCatalog,
} from "./collectors/static/thirdPartySnapshots.js";
import { buildFixtureManifestTemplate, describeFixtureTemplate, redactFixtureManifest, validateDisposableFixtures, validateRequiredFixtures } from "./fixtures/manifest.js";
import { buildFixtureSeedPlan } from "./fixtures/seedPlan.js";
import { CaptureAbortError, CdpNetworkRecorder, CdpSessionLike } from "./runtime/cdpNetworkRecorder.js";
import { runCapturedFeature } from "./runtime/featureRunner.js";
import { writeRuntimeFailureArtifact, writeRuntimeRunArtifacts } from "./runtime/failureArtifact.js";
import { runPlaywrightCapturedFeature, PlaywrightBrowserContextLike, PlaywrightPageLike } from "./runtime/playwrightFeatureRunner.js";
import { runPlaywrightRuntimeFeature } from "./runtime/playwrightRuntimeRunner.js";
import { validateRuntimePreflight } from "./runtime/preflight.js";
import { NdjsonEventWriter } from "./runtime/ndjson.js";
import { normalizeJsonValue, normalizeUrl } from "./processors/normalize.js";
import { validateFixtureUrlScope } from "./processors/fixtureScope.js";
import { sanitizeHar } from "./processors/harSanitizer.js";
import { importMitmproxyFlowEvents } from "./processors/mitmproxyImport.js";
import { redactHeaders, redactJsonValue, scanForSecrets } from "./processors/redact.js";
import { auditRedactionPaths } from "./processors/redactionAudit.js";
import { buildReviewQueue } from "./processors/reviewQueue.js";
import { auditDataminingRun } from "./processors/runAudit.js";
import { shapeResult } from "./processors/shape.js";
import { buildSqliteIndexSql } from "./processors/sqliteIndex.js";
import { decodeSourceMap, originalPositionFor } from "./processors/sourceMap.js";
import { correlateFeatureTraffic } from "./processors/correlate.js";
import { buildGatewayCoverage, buildRouteCoverage } from "./processors/coverage.js";
import { diffBuildSnapshots, diffFeatureSummary, diffFeatureSummarySets } from "./processors/diff.js";
import { renderFeatureMarkdownReport } from "./reports/featureReport.js";
import { renderBuildDiffMarkdown, renderFeatureDiffMarkdown } from "./reports/diffReport.js";
import { renderGatewayCoverageMarkdown, renderRouteCoverageMarkdown } from "./reports/coverageReport.js";
import { attachStaticCandidates } from "./processors/staticCandidates.js";
import { contextClickRole, contextClickSelector, contextClickText } from "./scenarios/actions.js";
import { expressionPickerBasic } from "./scenarios/expressions/expressionPickerBasic.js";
import { messageSendBasic } from "./scenarios/messages/messageSendBasic.js";
import { messageUploadAttachment } from "./scenarios/messages/messageUploadAttachment.js";
import { messageDeleteBasic } from "./scenarios/messages/messageDeleteBasic.js";
import { messageAck } from "./scenarios/readState/messageAck.js";
import { idleSession } from "./scenarios/bootstrap/idleSession.js";
import { guildSwitch } from "./scenarios/navigation/guildSwitch.js";
import { builtInScenarios, getBuiltInScenario } from "./scenarios/registry.js";
import {
    BuildSnapshot,
    CaptureEvent,
    FeatureSummary,
    RuntimeArtifactPaths,
    RuntimeFailureArtifact,
    RuntimeRunArtifactManifest,
    UiActionDetails,
    WebSocketFrameEvent,
} from "./types.js";
import { sha256 } from "./util/hash.js";
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";

const execFileAsync = promisify(execFile);
const zipHeader = Buffer.from("504b0506000000000000000000000000000000000000", "hex");
const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const numericSnowflake = Number("123456789012345680");
const alternateNumericSnowflake = Number("223456789012345680");

async function writeGatewayZlibFrame(deflate: ReturnType<typeof createDeflate>, payload: unknown): Promise<string> {
    const chunks: Buffer[] = [];
    const text = JSON.stringify(payload);

    return new Promise((resolve, reject) => {
        const cleanup = () => {
            deflate.off("data", onData);
            deflate.off("error", onError);
        };
        const onData = (chunk: Buffer) => {
            chunks.push(Buffer.from(chunk));
        };
        const onError = (error: Error) => {
            cleanup();
            reject(error);
        };

        deflate.on("data", onData);
        deflate.once("error", onError);
        deflate.write(Buffer.from(text), (writeError) => {
            if (writeError) {
                cleanup();
                reject(writeError);
                return;
            }
            deflate.flush(zlibConstants.Z_SYNC_FLUSH, () => {
                cleanup();
                resolve(Buffer.concat(chunks).toString("base64"));
            });
        });
    });
}

function playwrightHttpRequestEvent(featureId: string, stepId: string, method: string, route: string): CaptureEvent {
    return {
        run_id: "run",
        feature_id: featureId,
        step_id: stepId,
        ts_monotonic_ms: 1,
        kind: "playwright.http.request",
        playwright_request_id: `playwright:${featureId}:${stepId}:${method}:${route}`,
        method,
        url: `https://{api_host}/api/v9${route}`,
        normalized_route: route,
        headers_redacted: true,
    };
}

function playwrightHttpResponseEvent(featureId: string, stepId: string, method: string, route: string, status: number): CaptureEvent {
    return {
        run_id: "run",
        feature_id: featureId,
        step_id: stepId,
        ts_monotonic_ms: 2,
        kind: "playwright.http.response",
        playwright_request_id: `playwright:${featureId}:${stepId}:${method}:${route}`,
        method,
        url: `https://{api_host}/api/v9${route}`,
        normalized_route: route,
        status,
        headers_redacted: true,
    };
}

function playwrightGatewayCreatedEvent(featureId: string, stepId: string): CaptureEvent {
    return {
        run_id: "run",
        feature_id: featureId,
        step_id: stepId,
        ts_monotonic_ms: 2.5,
        kind: "playwright.ws.created",
        websocket_id: "playwright-ws-1",
        url: "wss://gateway.discord.gg/?encoding={query}&v={query}",
    };
}

function playwrightGatewayFrameEvent(featureId: string, stepId: string, gatewayEvent: string): CaptureEvent {
    return {
        run_id: "run",
        feature_id: featureId,
        step_id: stepId,
        ts_monotonic_ms: 3,
        kind: "playwright.ws.frame.received",
        websocket_id: "playwright-ws-1",
        url: "wss://gateway.discord.gg/?encoding={query}&v={query}",
        direction: "received",
        gateway_event: gatewayEvent,
    };
}

function mismatchedHttpPairEvents(events: CaptureEvent[]): CaptureEvent[] {
    const output: CaptureEvent[] = [];
    for (const event of events) {
        if (event.kind === "http.request") {
            output.push({ ...event, cdp_request_id: "expected-request" });
            output.push({
                ...event,
                cdp_request_id: "wrong-request",
                ts_monotonic_ms: 2.5,
                url: "https://discord.com/api/v9/channels/{channel_id}/typing",
                normalized_route: "/channels/{channel_id}/typing",
            });
            continue;
        }
        if (event.kind === "http.response") {
            output.push({ ...event, cdp_request_id: "wrong-request" });
            continue;
        }
        output.push(event);
    }
    return output;
}

function validRuntimePreflightReport(featureId?: string): Record<string, unknown> {
    const feature = featureId ? getBuiltInScenario(featureId) : undefined;
    const requiredFixtures = feature?.requiredFixtures ?? [];
    const requiredDisposableFixtures = feature?.safety?.requiredDisposableFixtures ?? [];
    const shouldIncludeFixtures = requiredFixtures.length > 0 || requiredDisposableFixtures.length > 0;
    return {
        ok: true,
        violations: [],
        storage_state: {
            path: "{storage_state_path}",
            cookie_count: 1,
            origin_count: 1,
            discord_cookie_count: 1,
            discord_origin_count: 1,
            discord_auth_cookie_count: 0,
            discord_expired_auth_cookie_count: 0,
            discord_auth_storage_count: 1,
            has_discord_session: true,
            storage_state_age_ms: 1,
            max_storage_state_age_ms: 604800000,
            storage_state_age_source: "provided_created_at",
            storage_state_fresh: true,
        },
        ...(shouldIncludeFixtures
            ? {
                  fixtures: {
                      redacted_manifest: buildFixtureManifestTemplate(requiredFixtures, requiredDisposableFixtures),
                      validation: { ok: true, missing: [] },
                      disposable_validation: {
                          ok: true,
                          missing: [],
                          not_disposable: [],
                          required: [...requiredDisposableFixtures].sort(),
                      },
                  },
              }
            : {}),
    };
}

test("normalizes Discord API URLs with typed fixture placeholders", () => {
    const fixtures = {
        channels: { general: "123456789012345678" },
        emojis: { wave: "223456789012345678" },
        stickers: { party: "323456789012345678" },
    };
    const normalized = normalizeUrl("https://discord.com/api/v9/channels/123456789012345678/messages?limit=50", { fixtures });
    const reaction = normalizeUrl("https://discord.com/api/v9/channels/123456789012345678/messages/423456789012345678/reactions/%F0%9F%98%80/@me", {
        fixtures,
    });

    assert.equal(normalized.api_version, "v9");
    assert.equal(normalized.normalized_route, "/channels/{channel_id}/messages");
    assert.equal(normalized.normalized_url, "https://{api_host}/api/v9/channels/{channel_id}/messages?limit={query}");
    assert.equal(reaction.normalized_route, "/channels/{channel_id}/messages/{message_id}/reactions/{emoji}/@me");
    assert.deepEqual(normalizeJsonValue({ emoji_id: "223456789012345678", sticker_id: "323456789012345678" }, fixtures), {
        emoji_id: "{emoji_id}",
        sticker_id: "{sticker_id}",
    });
    assert.deepEqual(normalizeJsonValue({ id: numericSnowflake, created_at_ms: 1778193389000 }), {
        id: "{snowflake}",
        created_at_ms: "{timestamp}",
    });
    assert.deepEqual(normalizeJsonValue({ "123456789012345678": { id: alternateNumericSnowflake } }), {
        "{snowflake}": { id: "{snowflake}" },
    });
    assert.deepEqual(normalizeJsonValue({ "123456789012345678": { version: 1 }, "223456789012345678": { version: 2 } }), {
        "{snowflake}": { version: 1 },
        "{snowflake}#2": { version: 2 },
    });
});

test("redacts sensitive headers and private payload fields", () => {
    const headers = redactHeaders({
        Authorization: "Bearer token",
        "Content-Type": "application/json",
        "X-Super-Properties": "secret",
    });

    assert.equal(headers.Authorization, "{redacted}");
    assert.equal(headers["X-Super-Properties"], "{redacted}");
    assert.equal(headers["Content-Type"], "application/json");

    const body = redactJsonValue({
        content: "hello",
        channel_id: "123456789012345678",
        nested: { guild_id: alternateNumericSnowflake },
        guild_versions: { "123456789012345678": 1 },
        authorization: "secret",
    });
    assert.deepEqual(body, {
        content: "{redacted_string}",
        channel_id: "{snowflake}",
        nested: { guild_id: "{snowflake}" },
        guild_versions: { "{snowflake}": 1 },
        authorization: "{redacted}",
    });
    assert.equal(scanForSecrets(body).ok, true);
    assert.equal(scanForSecrets({ timing: 0.45999999999999996 }).ok, true);
    assert.equal(scanForSecrets({ hash: "sha256:e3e6688657295695151801e87e8aa1ae2f8d1ea85daeff0b5a5c8037acffc813" }).ok, true);
    assert.equal(scanForSecrets({ id: "123456789012345678" }).ok, false);
});

test("audits generated artifacts for unredacted secrets", async () => {
    const root = await mkdtemp(join(tmpdir(), "are-redaction-audit-"));
    try {
        await writeFile(join(root, "safe.ndjson"), '{"kind":"ok","authorization":"{redacted}"}\n', "utf8");
        await writeFile(join(root, "unsafe.ndjson"), '{"token":"mfa.abcdefghijklmnopqrstuvwxyz"}\n', "utf8");
        await writeFile(
            join(root, "unsafe.js.map"),
            JSON.stringify({
                version: 3,
                sources: ["./src/private@example.com/123456789012345678/sendMessage.ts"],
                mappings: "",
            }),
            "utf8",
        );

        const result = await auditRedactionPaths([root]);
        assert.equal(result.ok, false);
        assert.equal(result.violations.length, 2);
        assert.equal(
            result.violations.some((violation) => violation.file.endsWith("unsafe.ndjson") && violation.line === 1),
            true,
        );
        assert.equal(
            result.violations.some((violation) => violation.file.endsWith("unsafe.js.map")),
            true,
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("static workflow upload staging is allowlisted", async () => {
    const workflow = await readFile(fileURLToPath(new URL("../../../.github/workflows/discord-datamining-static.yml", import.meta.url)), "utf8");
    const stageStep = workflow.slice(workflow.indexOf("- name: Stage redacted static upload"));
    const exactAllowedBlock = stageStep.split("const exactAllowed = new Set([")[1]?.split("]);")[0] ?? "";

    assert.equal(/cp\s+-R\s+"\$RUN_DIR\/static/.test(stageStep), false);
    assert.equal(/cp\s+"\$RUN_DIR\/static\/(?:assets|login\.html)/.test(stageStep), false);
    assert.equal(stageStep.includes("for file in build.json assets.json context.manifest.json"), true);
    assert.equal(stageStep.includes("Unexpected static upload files"), true);
    assert.equal(exactAllowedBlock.includes('"upload-manifest.json"'), true);
    assert.equal(stageStep.includes("manifest.uploaded_files = files"), true);
    assert.equal(stageStep.includes('static_audit: "runner-local run directory before upload staging"'), true);
    assert.equal(stageStep.includes('staged_upload_redaction: "final allowlisted upload directory"'), true);
    assert.equal(exactAllowedBlock.includes('"static/assets/"'), false);
    assert.equal(exactAllowedBlock.includes('"static/login.html"'), false);
    assert.equal(exactAllowedBlock.includes('"static/assets.json"'), true);
    assert.equal(stageStep.includes('omitted_artifacts: ["static/assets/", "static/login.html"]'), true);
    assert.equal(stageStep.includes('--input "$UPLOAD_DIR"'), true);
    assert.equal(workflow.includes("path: $" + "{{ env.UPLOAD_DIR }}"), true);
    assert.equal(workflow.includes("path: $" + "{{ env.RUN_DIR }}"), false);
});

test("runtime smoke workflow upload staging is allowlisted", async () => {
    const workflow = await readFile(fileURLToPath(new URL("../../../.github/workflows/discord-datamining-runtime-smoke.yml", import.meta.url)), "utf8");
    const stageStep = workflow.slice(workflow.indexOf("- name: Stage redacted upload"));
    const exactAllowedBlock = stageStep.split("const exactAllowed = new Set([")[1]?.split("]);")[0] ?? "";

    assert.equal(/cp\s+-R\s+"\$RUN_DIR\/static/.test(stageStep), false);
    assert.equal(/cp\s+"\$RUN_DIR\/static\/(?:assets|login\.html)/.test(stageStep), false);
    assert.equal(stageStep.includes("for file in build.json assets.json context.manifest.json"), true);
    assert.equal(stageStep.includes("Unexpected runtime upload files"), true);
    assert.equal(exactAllowedBlock.includes('"upload-manifest.json"'), true);
    assert.equal(stageStep.includes("manifest.uploaded_files = files"), true);
    assert.equal(stageStep.includes('completion_audit: "runner-local run directory before upload staging"'), true);
    assert.equal(stageStep.includes("final allowlisted upload directory after binary omissions"), true);
    assert.equal(exactAllowedBlock.includes('"static/assets/"'), false);
    assert.equal(exactAllowedBlock.includes('"static/login.html"'), false);
    assert.equal(exactAllowedBlock.includes('"static/assets.json"'), true);
    assert.equal(exactAllowedBlock.includes('"coverage/routes.coverage.json"'), true);
    assert.equal(stageStep.includes('omitted_artifacts: ["static/assets/", "static/login.html"'), true);
    assert.equal(workflow.includes('--input "$RUN_DIR,$COVERAGE_DIR"'), true);
    assert.equal(workflow.includes('--coverage-dir "$COVERAGE_DIR"'), true);
    assert.equal(workflow.includes('--review-queue "$RUN_DIR/review-queue.json"'), true);
    assert.equal(stageStep.includes('"storage-state.json"'), true);
    assert.equal(stageStep.includes('"fixtures.local.json"'), true);
    assert.equal(stageStep.includes("completion-audit.json was produced against the runner-local run directory"), true);
});

test("operator docs keep raw HAR and mitmproxy inputs outside durable run output", async () => {
    const cliPath = fileURLToPath(new URL("./cli.js", import.meta.url));
    let cliUsage = "";
    try {
        await execFileAsync(process.execPath, [cliPath]);
    } catch (error) {
        cliUsage = String((error as { stderr?: string }).stderr ?? "");
    }
    const runbook = await readFile(fileURLToPath(new URL("../docs/runbook.md", import.meta.url)), "utf8");
    const redactionPolicy = await readFile(fileURLToPath(new URL("../docs/redaction-policy.md", import.meta.url)), "utf8");
    const operatorText = [cliUsage, runbook, redactionPolicy].join("\n");

    assert.equal(operatorText.includes("--input /tmp/network.har"), true);
    assert.equal(operatorText.includes("--input /tmp/mitmproxy.flows.json"), true);
    assert.equal(operatorText.includes("--input packages/automatic-reverse-engineering/data/runs/<run_id>/features/message.send.basic/network.har"), false);
    assert.equal(operatorText.includes("--input runs/<id>/features/message.send.basic/network.har"), false);
    assert.equal(operatorText.includes("--input runs/<id>/features/message.send.basic/mitmproxy.flows.json"), false);
});

test("redaction audit rejects persisted Playwright storage state artifacts", async () => {
    const root = await mkdtemp(join(tmpdir(), "are-storage-state-audit-"));
    try {
        const storageState = {
            cookies: [{ name: "locale", value: "en-US", domain: ".discord.com", expires: 1_800_000_000 }],
            origins: [
                {
                    origin: "https://canary.discord.com",
                    localStorage: [{ name: "theme", value: "dark" }],
                },
            ],
        };
        await writeFile(join(root, "storage-state.json"), JSON.stringify(storageState), "utf8");
        await writeFile(join(root, "empty-cookie-origin-shape.json"), JSON.stringify({ cookies: [], origins: [] }), "utf8");

        assert.equal(scanForSecrets(storageState).ok, true);
        const result = await auditRedactionPaths([root]);
        assert.equal(result.ok, false);
        assert.equal(result.violations.length, 1);
        assert.equal(result.violations[0].violations.includes("$:playwright_storage_state_artifact"), true);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("refuses unsafe ui action labels before writing NDJSON", async () => {
    const root = await mkdtemp(join(tmpdir(), "are-ui-action-redaction-"));
    const writer = await NdjsonEventWriter.open({ filePath: join(root, "events.ndjson") });
    try {
        await writer.write({
            run_id: "run",
            feature_id: messageSendBasic.id,
            step_id: "send-message",
            ts_monotonic_ms: 1,
            kind: "ui.action",
            action: "fill",
            target: "role:textbox",
            value_redacted: true,
        });
        await assert.rejects(
            writer.write({
                run_id: "run",
                feature_id: messageSendBasic.id,
                step_id: "send-message",
                ts_monotonic_ms: 2,
                kind: "ui.action",
                action: "fill",
                target: "role:textbox",
                detail: "hello from message box",
            }),
            /value_redacted_required/,
        );
        await assert.rejects(
            writer.write({
                run_id: "run",
                feature_id: messageSendBasic.id,
                step_id: "send-message",
                ts_monotonic_ms: 3,
                kind: "ui.action",
                action: "click",
                target: "fixture-channel:123456789012345678",
            }),
            /raw_snowflake/,
        );
        await assert.rejects(
            writer.write({
                run_id: "run",
                feature_id: messageSendBasic.id,
                step_id: "send-message",
                ts_monotonic_ms: 4,
                kind: "ui.action",
                action: "set-input-files",
                target: "label",
                detail: "/Users/user/private.png",
                value_redacted: true,
            }),
            /local_path/,
        );
        await assert.rejects(
            writer.write({
                run_id: "run",
                feature_id: messageSendBasic.id,
                step_id: "send-message",
                ts_monotonic_ms: 5,
                kind: "ui.action",
                action: "context-click",
                target: "text",
            }),
            /context-click:text_value_redacted_required/,
        );
    } finally {
        await writer.close();
        await rm(root, { recursive: true, force: true });
    }
});

test("normalizes numeric snowflakes before writing WebSocket payload NDJSON", async () => {
    const root = await mkdtemp(join(tmpdir(), "are-ws-numeric-snowflake-redaction-"));
    const writer = await NdjsonEventWriter.open({ filePath: join(root, "events.ndjson") });
    let writerClosed = false;
    try {
        await writer.write({
            run_id: "run",
            feature_id: messageSendBasic.id,
            step_id: "send-message",
            ts_monotonic_ms: 1,
            kind: "playwright.ws.frame.sent",
            websocket_id: "playwright-ws-1",
            url: "wss://gateway.discord.gg/?v={query}&encoding={query}",
            direction: "sent",
            opcode: 2,
            payload_redacted: redactJsonValue({
                op: 2,
                d: {
                    guild_id: numericSnowflake,
                    guild_versions: {
                        "123456789012345678": {
                            version: 1,
                        },
                    },
                    nonce: alternateNumericSnowflake,
                },
            }),
        });

        await writer.close();
        writerClosed = true;
        const events = await readFile(join(root, "events.ndjson"), "utf8");
        assert.equal(events.includes("{snowflake}"), true);
        assert.equal(scanForSecrets(events).ok, true);
    } finally {
        if (!writerClosed) {
            await writer.close();
        }
        await rm(root, { recursive: true, force: true });
    }
});

async function writeMinimalStaticRun(root: string): Promise<void> {
    const staticDir = join(root, "static");
    const webAssetBody = "webpackChunkdiscord_app.push([]);";
    const webAssetHash = sha256(Buffer.from(webAssetBody));
    await mkdir(join(staticDir, "assets"), { recursive: true });
    await writeFile(join(staticDir, "login.html"), "<html></html>", "utf8");
    await writeFile(join(staticDir, "assets", "web.js"), webAssetBody, "utf8");
    await writeFile(
        join(staticDir, "build.json"),
        JSON.stringify({
            run_id: "run",
            channel: "canary",
            base_url: "https://canary.discord.com",
            api_base_url: "https://discord.com/api",
            x_build_id: "build",
            asset_hashes: [webAssetHash],
            source_refs: {
                xhyrom_routes_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                userdoccers_commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            },
            collected_at: "2026-05-07T00:00:00.000Z",
        }),
        "utf8",
    );
    await writeFile(
        join(staticDir, "assets.json"),
        JSON.stringify([
            {
                url: "https://canary.discord.com/assets/web.js",
                kind: "script",
                file_name: "web.js",
                hash: webAssetHash,
                bytes: Buffer.byteLength(webAssetBody),
                local_path: "assets/web.js",
            },
        ]),
        "utf8",
    );
    const routeCatalog = [
        {
            method: "POST",
            route: "/channels/{channel_id}/messages",
            route_name: "CREATE_MESSAGE",
            source: "test",
        },
    ];
    const gatewayCatalog = {
        opcodes: [{ opcode: 0, name: "Dispatch", direction: "received", source: "test" }],
        events: [{ event: "MESSAGE_CREATE", direction: "received", source: "test" }],
    };
    const docsIndex = [{ kind: "route", key: "POST /channels/{channel_id}/messages", url: "https://docs.discord.com" }];
    const experiments = [{ key: "experimentId", value: "{redacted_string}", source: "test" }];
    const catalogs = [
        { kind: "routes", path: "routes.catalog.json", value: routeCatalog },
        { kind: "source_routes", path: "routes.source.catalog.json", value: routeCatalog },
        { kind: "xhyrom_routes", path: "routes.xhyrom.catalog.json", value: routeCatalog },
        { kind: "userdoccers_routes", path: "routes.userdoccers.catalog.json", value: routeCatalog },
        { kind: "gateway", path: "gateway.catalog.json", value: gatewayCatalog },
        { kind: "userdoccers_gateway", path: "gateway.userdoccers.catalog.json", value: gatewayCatalog },
        { kind: "docs_index", path: "docs.index.json", value: docsIndex },
        { kind: "experiments", path: "experiments.catalog.json", value: [] },
        { kind: "xhyrom_experiments", path: "experiments.xhyrom.catalog.json", value: experiments },
    ];
    const manifestFiles = [];
    for (const catalog of catalogs) {
        const body = JSON.stringify(catalog.value);
        await writeFile(join(staticDir, catalog.path), body, "utf8");
        manifestFiles.push({
            kind: catalog.kind,
            path: catalog.path,
            source_path: `../../catalogs/${catalog.path}`,
            hash: sha256(Buffer.from(body)),
            bytes: Buffer.byteLength(body),
        });
    }
    await writeFile(
        join(staticDir, "context.manifest.json"),
        JSON.stringify({
            files: manifestFiles,
            source_refs: {
                xhyrom_routes_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                userdoccers_commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            },
        }),
        "utf8",
    );
}

test("sanitizes HAR headers, cookies, query strings, and bodies", () => {
    const har = {
        log: {
            entries: [
                {
                    request: {
                        method: "POST",
                        url: "https://discord.com/api/v9/channels/123456789012345678/messages?token=mfa.abcdefghijklmnopqrstuvwxyz",
                        headers: [
                            { name: "Authorization", value: "Bearer mfa.abcdefghijklmnopqrstuvwxyz" },
                            { name: "Content-Type", value: "application/json" },
                            { name: "Referer", value: "https://discord.com/channels/123456789012345678/234567890123456789?token=raw" },
                        ],
                        cookies: [{ name: "__dcfduid", value: "secret" }],
                        queryString: [{ name: "token", value: "mfa.abcdefghijklmnopqrstuvwxyz" }],
                        postData: {
                            mimeType: "application/json",
                            text: '{"content":"hello","authorization":"mfa.abcdefghijklmnopqrstuvwxyz"}',
                            params: [{ name: "content", value: "hello" }],
                        },
                    },
                    response: {
                        status: 200,
                        headers: [
                            { name: "Set-Cookie", value: "secret" },
                            { name: "Content-Type", value: "application/json" },
                        ],
                        cookies: [{ name: "session", value: "secret" }],
                        content: {
                            mimeType: "application/json",
                            text: '{"token":"mfa.abcdefghijklmnopqrstuvwxyz"}',
                        },
                    },
                },
            ],
        },
    };

    const sanitized = sanitizeHar(har, {
        fixtures: { channels: { general: "123456789012345678" } },
    }) as typeof har;
    const entry = sanitized.log.entries[0];

    assert.equal(entry.request.url.includes("123456789012345678"), false);
    assert.equal(entry.request.headers[0].value, "{redacted}");
    assert.equal(entry.request.headers[2].value, "{redacted}");
    assert.equal(entry.request.cookies[0].value, "{redacted}");
    assert.equal(entry.request.queryString[0].value, "{redacted_query}");
    assert.equal(entry.request.postData.text, "{redacted_body}");
    assert.equal(entry.response.headers[0].value, "{redacted}");
    assert.equal(entry.response.cookies[0].value, "{redacted}");
    assert.equal(entry.response.content.text, "{redacted_body}");
    assert.equal(scanForSecrets(sanitized).ok, true);
    assert.deepEqual(sanitizeHar(sanitized), sanitized);
    assert.equal(har.log.entries[0].request.cookies[0].value, "secret");
});

test("HAR audit rejects raw structured HAR secrets and accepts sanitized HAR", async () => {
    const root = await mkdtemp(join(tmpdir(), "are-har-audit-"));
    try {
        const rawHar = {
            log: {
                entries: [
                    {
                        request: {
                            url: "https://discord.com/api/v9/users/@me",
                            headers: [
                                { name: "Authorization", value: "Bearer session-secret" },
                                { name: "Referer", value: "https://discord.com/channels/123456789012345678/234567890123456789" },
                            ],
                            cookies: [{ name: "__dcfduid", value: "cookie-secret" }],
                            queryString: [{ name: "analytics_id", value: "raw-value" }],
                            postData: {
                                text: "raw-body",
                                params: [{ name: "content", value: "private message" }],
                            },
                        },
                        response: {
                            headers: [{ name: "Set-Cookie", value: "session=raw" }],
                            cookies: [{ name: "session", value: "raw" }],
                            content: { text: "raw-response" },
                        },
                    },
                ],
            },
        };
        const sanitizedHar = sanitizeHar(rawHar);
        await writeFile(join(root, "raw.har"), JSON.stringify(rawHar), "utf8");
        await writeFile(join(root, "sanitized.har"), JSON.stringify(sanitizedHar), "utf8");
        await writeFile(join(root, "invalid.har"), "{not json", "utf8");
        await writeFile(join(root, "malformed.har"), JSON.stringify({ log: { entries: [{ request: {} }] } }), "utf8");

        const rawResult = await auditRedactionPaths([join(root, "raw.har")]);
        const sanitizedResult = await auditRedactionPaths([join(root, "sanitized.har")]);
        const invalidResult = await auditRedactionPaths([join(root, "invalid.har")]);
        const malformedResult = await auditRedactionPaths([join(root, "malformed.har")]);

        assert.equal(rawResult.ok, false);
        assert.equal(
            rawResult.violations[0].violations.some((violation) => violation.includes("Authorization")),
            true,
        );
        assert.equal(sanitizedResult.ok, true);
        assert.equal(invalidResult.ok, false);
        assert.equal(invalidResult.violations[0].violations.includes("har:invalid_json"), true);
        assert.equal(malformedResult.ok, false);
        assert.equal(malformedResult.violations[0].violations.includes("entries[0].response:missing"), true);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("HAR sanitizer strips base64 content even when body preservation is requested", () => {
    const sanitized = sanitizeHar(
        {
            log: {
                entries: [
                    {
                        request: {
                            url: "https://discord.com/api/v9/users/@me",
                            postData: { text: "YmFzZTY0", encoding: "base64" },
                        },
                        response: {
                            content: { text: "YmFzZTY0", encoding: "base64" },
                        },
                    },
                ],
            },
        },
        { stripBodies: false },
    ) as {
        log: {
            entries: Array<{
                request: { postData: { text: string; encoding?: string } };
                response: { content: { text: string; encoding?: string } };
            }>;
        };
    };

    assert.equal(sanitized.log.entries[0].request.postData.text, "{redacted_body}");
    assert.equal(sanitized.log.entries[0].request.postData.encoding, undefined);
    assert.equal(sanitized.log.entries[0].response.content.text, "{redacted_body}");
    assert.equal(sanitized.log.entries[0].response.content.encoding, undefined);
});

test("imports mitmproxy flow JSON as redacted secondary validation events", async () => {
    const channelId = "123456789012345678";
    const userId = "223456789012345678";
    const messageId = "323456789012345678";
    const token = "mfa.abcdefghijklmnopqrstuvwxyz012345";
    const fixtures = {
        channels: { general: channelId },
        users: { runner: userId },
        messages: { sent: messageId },
    };
    const flow = {
        id: "flow-1",
        request: {
            method: "POST",
            url: `https://discord.com/api/v9/channels/${channelId}/messages?token=private`,
            headers: {
                Authorization: token,
                Cookie: "session=private",
                "Content-Type": "application/json",
            },
            text: JSON.stringify({ content: "private message text", nonce: messageId }),
            timestamp_start: 1,
        },
        response: {
            status_code: 200,
            headers: {
                "Set-Cookie": "session=private",
                "Content-Type": "application/json",
            },
            text: JSON.stringify({
                id: messageId,
                channel_id: channelId,
                content: "private message text",
                author: { id: userId, username: "runner@example.com" },
            }),
            timestamp_end: 2,
        },
        websocket: {
            url: "wss://gateway.discord.gg/?v=9&encoding=json",
            messages: [
                {
                    from_client: false,
                    timestamp: 3,
                    content: JSON.stringify({
                        op: 0,
                        t: "MESSAGE_CREATE",
                        s: 42,
                        d: { id: messageId, channel_id: channelId, content: "private message text" },
                    }),
                },
            ],
        },
    };
    const nonDiscordApiFlow = {
        request: {
            method: "POST",
            url: "https://internal.example/api/messages",
            headers: { Authorization: token },
            text: JSON.stringify({ message: "private non-discord payload" }),
        },
        response: {
            status_code: 200,
            text: JSON.stringify({ message: "private non-discord response" }),
        },
    };
    const nonDiscordWebSocketFlow = {
        request: {
            url: "wss://internal.example/socket?session=private-value",
        },
        websocket: {
            messages: [{ from_client: true, content: JSON.stringify({ message: "private websocket payload" }) }],
        },
    };

    const result = importMitmproxyFlowEvents(
        { flows: [flow, nonDiscordApiFlow, nonDiscordWebSocketFlow] },
        {
            runId: "run",
            feature: messageSendBasic,
            fixtures,
            routeCatalog: [
                {
                    method: "POST",
                    route: "/channels/{channel_id}/messages",
                    route_name: "CREATE_MESSAGE",
                    source: "test",
                },
            ],
            defaultStepId: "send-message",
        },
    );

    assert.equal(result.summary.flows_seen, 3);
    assert.equal(result.summary.flows_skipped, 2);
    assert.equal(result.summary.http_requests, 1);
    assert.equal(result.summary.http_responses, 1);
    assert.equal(result.summary.websocket_frames, 1);
    const request = result.events.find((event): event is Extract<CaptureEvent, { kind: "http.request" }> => event.kind === "http.request");
    const response = result.events.find((event): event is Extract<CaptureEvent, { kind: "http.response" }> => event.kind === "http.response");
    const frame = result.events.find((event): event is WebSocketFrameEvent => event.kind === "ws.frame.received");
    assert.equal(request?.normalized_route, "/channels/{channel_id}/messages");
    assert.equal(request?.route_name, "CREATE_MESSAGE");
    assert.equal(request?.url, "https://{api_host}/api/v9/channels/{channel_id}/messages?token={query}");
    assert.equal(request?.cdp_request_id, "mitmproxy:flow-1");
    assert.equal(request?.request_headers_redacted?.Authorization, "{redacted}");
    assert.equal(response?.status, 200);
    assert.equal(response?.cdp_request_id, request?.cdp_request_id);
    assert.equal(frame?.gateway_event, "MESSAGE_CREATE");
    assert.equal(frame?.opcode, 0);
    assert.equal(frame?.url, "wss://gateway.discord.gg/?encoding={query}&v={query}");
    assert.equal(JSON.stringify(result).includes(channelId), false);
    assert.equal(JSON.stringify(result).includes(token), false);
    assert.equal(JSON.stringify(result).includes("internal.example"), false);
    assert.equal(JSON.stringify(result).includes("private-value"), false);
    assert.equal(scanForSecrets(result).ok, true);

    const root = await mkdtemp(join(tmpdir(), "are-mitmproxy-import-"));
    try {
        const inputPath = join(root, "mitmproxy.flows.json");
        const fixturesPath = join(root, "fixtures.local.json");
        const outPath = join(root, "mitmproxy.redacted.ndjson");
        const summaryPath = join(root, "mitmproxy.summary.json");
        await writeFile(inputPath, JSON.stringify([flow]), "utf8");
        await writeFile(fixturesPath, JSON.stringify(fixtures), "utf8");
        await execFileAsync(process.execPath, [
            fileURLToPath(new URL("./cli.js", import.meta.url)),
            "import-mitmproxy",
            "--input",
            inputPath,
            "--out",
            outPath,
            "--summary-out",
            summaryPath,
            "--run-id",
            "run",
            "--feature-id",
            messageSendBasic.id,
            "--fixtures",
            fixturesPath,
            "--step-id",
            "send-message",
        ]);
        const output = await readFile(outPath, "utf8");
        const summary = JSON.parse(await readFile(summaryPath, "utf8")) as { events: number };
        assert.equal(summary.events, result.events.length);
        assert.equal(output.includes(channelId), false);
        assert.equal(output.includes(token), false);
        assert.equal((await auditRedactionPaths([outPath, summaryPath])).ok, true);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("detects non-fixture IDs in guarded API route scope", () => {
    const ok = validateFixtureUrlScope("https://discord.com/api/v9/channels/123456789012345678/messages", { channels: { general: "123456789012345678" } });
    const secondaryGuild = validateFixtureUrlScope("https://discord.com/api/v9/guilds/723456789012345678/channels", { guilds: { secondary: "723456789012345678" } });
    const dynamicallyAllowed = validateFixtureUrlScope("https://discord.com/api/v9/channels/923456789012345678/messages", undefined, {
        allowedIds: ["923456789012345678"],
    });
    const violation = validateFixtureUrlScope("https://discord.com/api/v9/guilds/999999999999999999/roles", { guild: "123456789012345678" });

    assert.equal(ok.ok, true);
    assert.equal(secondaryGuild.ok, true);
    assert.equal(dynamicallyAllowed.ok, true);
    assert.equal(violation.ok, false);
    assert.deepEqual(
        violation.violations.map((entry) => entry.kind),
        ["guild"],
    );
});

test("validates required fixtures and redacts fixture manifests", () => {
    const manifest = {
        guild: "123456789012345678",
        guilds: { secondary: "723456789012345678" },
        channels: { general: "223456789012345678" },
        users: { runner: "323456789012345678" },
        messages: { delete_target: "423456789012345678" },
        emojis: { wave: "523456789012345678" },
        stickers: { party: "623456789012345678" },
        files: { small_attachment: "/tmp/private-attachment.txt" },
        disposable: ["messages.delete_target", "123456789012345678"],
        notes: { private: "do-not-share" },
    };

    assert.deepEqual(validateRequiredFixtures(manifest, ["guild", "channels.general"]), {
        ok: true,
        missing: [],
    });
    assert.deepEqual(validateRequiredFixtures(manifest, ["roles.feature_test_role"]), {
        ok: false,
        missing: ["roles.feature_test_role"],
    });
    assert.deepEqual(validateDisposableFixtures(manifest, ["messages.delete_target", "channels.general"]), {
        ok: false,
        missing: [],
        not_disposable: ["channels.general"],
        required: ["channels.general", "messages.delete_target"],
    });
    assert.deepEqual(redactFixtureManifest(manifest), {
        guild: "{guild_id}",
        channels: { general: "{channel_id}" },
        disposable: ["messages.delete_target", "{redacted}"],
        emojis: { wave: "{emoji_id}" },
        files: { small_attachment: "{local_file_path}" },
        messages: { delete_target: "{message_id}" },
        guilds: { secondary: "{guild_id}" },
        stickers: { party: "{sticker_id}" },
        users: { runner: "{user_id}" },
        notes: { private: "{redacted}" },
    });
});

test("builds fixture templates from scenario requirements", () => {
    const requiredFixtures = ["guild", "channels.general", "messages.reply_target", "files.small_attachment", "guilds.secondary", "emojis.wave", "stickers.party"];
    const template = buildFixtureManifestTemplate(requiredFixtures, ["messages.reply_target"]);
    const entries = describeFixtureTemplate(requiredFixtures);

    assert.deepEqual(template, {
        channels: { general: "{channel_id}" },
        disposable: ["messages.reply_target"],
        emojis: { wave: "{emoji_id}" },
        files: { small_attachment: "{local_file_path}" },
        guild: "{guild_id}",
        guilds: { secondary: "{guild_id}" },
        messages: { reply_target: "{message_id}" },
        stickers: { party: "{sticker_id}" },
    });
    assert.deepEqual(
        entries.map((entry) => `${entry.path}=${entry.placeholder}`),
        [
            "channels.general={channel_id}",
            "emojis.wave={emoji_id}",
            "files.small_attachment={local_file_path}",
            "guild={guild_id}",
            "guilds.secondary={guild_id}",
            "messages.reply_target={message_id}",
            "stickers.party={sticker_id}",
        ],
    );
});

test("builds a redacted fixture seed plan for built-in scenarios", async () => {
    const plan = buildFixtureSeedPlan(builtInScenarios);
    const resourceByPath = new Map(plan.resources.map((resource) => [resource.fixture_path, resource]));
    const stepByPath = new Map(plan.steps.flatMap((step) => step.fixture_paths.map((fixturePath) => [fixturePath, step])));

    assert.equal(plan.features.length, builtInScenarios.length);
    assert.equal(plan.required_fixtures.includes("files.small_attachment"), true);
    assert.equal(plan.template.files?.small_attachment, "{local_file_path}");
    assert.equal(resourceByPath.get("channels.general")?.setup, "official_api");
    assert.equal(resourceByPath.get("channels.general")?.disposable, true);
    assert.equal(resourceByPath.get("channels.dm")?.setup, "browser_session");
    assert.equal(resourceByPath.get("messages.delete_target")?.setup, "browser_session");
    assert.equal(resourceByPath.get("messages.reply_target")?.setup, "official_api");
    assert.equal(resourceByPath.get("files.small_attachment")?.setup, "local_file");
    assert.equal(stepByPath.get("channels.voice")?.official_api?.route, "/guilds/{guild_id}/channels");
    assert.equal(stepByPath.get("messages.reply_target")?.official_api?.route, "/channels/{channel_id}/messages");
    assert.equal(scanForSecrets(plan).ok, true);

    const root = await mkdtemp(join(tmpdir(), "are-fixture-seed-plan-"));
    try {
        const outPath = join(root, "fixture-seed-plan.json");
        await execFileAsync(process.execPath, [fileURLToPath(new URL("./cli.js", import.meta.url)), "fixture-seed-plan", "--all-built-ins", "true", "--out", outPath]);

        const cliPlan = JSON.parse(await readFile(outPath, "utf8")) as typeof plan;
        assert.equal(
            cliPlan.resources.some((resource) => resource.fixture_path === "roles.feature_test_role" && resource.disposable),
            true,
        );
        assert.equal(scanForSecrets(cliPlan).ok, true);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("preflights runtime fixtures and storage state without exposing secrets", async () => {
    const root = await mkdtemp(join(tmpdir(), "are-runtime-preflight-"));
    try {
        const storageStatePath = join(root, "canary.storage-state.json");
        await writeFile(
            storageStatePath,
            JSON.stringify({
                cookies: [
                    {
                        name: "token",
                        value: "mfa.abcdefghijklmnopqrstuvwxyz",
                        domain: ".discord.com",
                        path: "/",
                        expires: 1_800_000_000,
                    },
                ],
                origins: [
                    {
                        origin: "https://canary.discord.com",
                        localStorage: [{ name: "token", value: "mfa.abcdefghijklmnopqrstuvwxyz" }],
                    },
                ],
            }),
            "utf8",
        );

        const okReport = await validateRuntimePreflight({
            storageStatePath,
            fixtures: {
                guild: "123456789012345678",
                channels: { general: "223456789012345678" },
            },
            requiredFixtures: ["guild", "channels.general"],
            forbiddenStorageRoots: [join(root, "data")],
        });
        const serialized = JSON.stringify(okReport);
        assert.equal(okReport.ok, true);
        assert.equal(okReport.storage_state.cookie_count, 1);
        assert.equal(okReport.storage_state.path, "{storage_state_path}");
        assert.equal(okReport.storage_state.discord_origin_count, 1);
        assert.equal(okReport.storage_state.discord_auth_storage_count, 1);
        assert.equal(okReport.storage_state.discord_expired_auth_cookie_count, 0);
        assert.equal(okReport.storage_state.storage_state_fresh, true);
        assert.equal(okReport.storage_state.storage_state_age_source, "file_mtime");
        assert.equal(okReport.storage_state.max_storage_state_age_ms, 604800000);
        assert.equal(serialized.includes("mfa."), false);
        assert.equal(serialized.includes(storageStatePath), false);
        assert.equal(serialized.includes(root), false);
        assert.equal(scanForSecrets(okReport).ok, true);

        const weakStatePath = join(root, "weak.storage-state.json");
        await writeFile(
            weakStatePath,
            JSON.stringify({
                cookies: [{ name: "locale", value: "en-US", domain: ".discord.com", expires: 1_800_000_000 }],
                origins: [{ origin: "https://canary.discord.com", localStorage: [] }],
            }),
            "utf8",
        );
        const weakReport = await validateRuntimePreflight({
            storageStatePath: weakStatePath,
            fixtures: {
                guild: "123456789012345678",
                channels: { general: "223456789012345678" },
            },
            requiredFixtures: ["guild", "channels.general"],
        });
        assert.equal(weakReport.ok, false);
        assert.equal(weakReport.storage_state.discord_cookie_count, 1);
        assert.equal(weakReport.storage_state.discord_origin_count, 1);
        assert.equal(weakReport.storage_state.has_discord_session, false);
        assert.equal(weakReport.violations.includes("storage_state_missing_discord_session"), true);

        const nowMs = Date.now();
        const expiredStatePath = join(root, "expired.storage-state.json");
        await writeFile(
            expiredStatePath,
            JSON.stringify({
                cookies: [{ name: "token", value: "mfa.abcdefghijklmnopqrstuvwxyz", domain: ".discord.com", expires: Math.floor(nowMs / 1000) - 60 }],
                origins: [
                    {
                        origin: "https://canary.discord.com",
                        localStorage: [{ name: "token", value: "mfa.abcdefghijklmnopqrstuvwxyz" }],
                    },
                ],
            }),
            "utf8",
        );
        const expiredReport = await validateRuntimePreflight({
            storageStatePath: expiredStatePath,
            fixtures: {
                guild: "123456789012345678",
                channels: { general: "223456789012345678" },
            },
            requiredFixtures: ["guild", "channels.general"],
            nowMs,
        });
        assert.equal(expiredReport.ok, false);
        assert.equal(expiredReport.storage_state.has_discord_session, true);
        assert.equal(expiredReport.storage_state.discord_auth_cookie_count, 0);
        assert.equal(expiredReport.storage_state.discord_expired_auth_cookie_count, 1);
        assert.equal(expiredReport.violations.includes("storage_state_expired_discord_auth_cookie"), true);
        assert.equal(JSON.stringify(expiredReport).includes("mfa."), false);

        const staleStatePath = join(root, "stale.storage-state.json");
        await writeFile(
            staleStatePath,
            JSON.stringify({
                cookies: [{ name: "token", value: "mfa.abcdefghijklmnopqrstuvwxyz", domain: ".discord.com", expires: Math.floor(nowMs / 1000) + 3600 }],
                origins: [
                    {
                        origin: "https://canary.discord.com",
                        localStorage: [{ name: "token", value: "mfa.abcdefghijklmnopqrstuvwxyz" }],
                    },
                ],
            }),
            "utf8",
        );
        const staleMtime = new Date(nowMs - 10_000);
        await utimes(staleStatePath, staleMtime, staleMtime);
        const staleReport = await validateRuntimePreflight({
            storageStatePath: staleStatePath,
            fixtures: {
                guild: "123456789012345678",
                channels: { general: "223456789012345678" },
            },
            requiredFixtures: ["guild", "channels.general"],
            nowMs,
            maxStorageStateAgeMs: 1_000,
        });
        assert.equal(staleReport.ok, false);
        assert.equal(staleReport.storage_state.has_discord_session, true);
        assert.equal(staleReport.storage_state.storage_state_fresh, false);
        assert.equal(staleReport.storage_state.storage_state_age_source, "file_mtime");
        assert.equal(staleReport.storage_state.max_storage_state_age_ms, 1_000);
        assert.equal(staleReport.violations.includes("storage_state_stale"), true);
        assert.equal(JSON.stringify(staleReport).includes(staleStatePath), false);

        const copiedOldStatePath = join(root, "copied-old.storage-state.json");
        await writeFile(
            copiedOldStatePath,
            JSON.stringify({
                cookies: [{ name: "token", value: "mfa.abcdefghijklmnopqrstuvwxyz", domain: ".discord.com", expires: Math.floor(nowMs / 1000) + 3600 }],
                origins: [
                    {
                        origin: "https://canary.discord.com",
                        localStorage: [{ name: "token", value: "mfa.abcdefghijklmnopqrstuvwxyz" }],
                    },
                ],
            }),
            "utf8",
        );
        const copiedOldReport = await validateRuntimePreflight({
            storageStatePath: copiedOldStatePath,
            fixtures: {
                guild: "123456789012345678",
                channels: { general: "223456789012345678" },
            },
            requiredFixtures: ["guild", "channels.general"],
            nowMs,
            storageStateCreatedAtMs: nowMs - 10_000,
            maxStorageStateAgeMs: 1_000,
        });
        assert.equal(copiedOldReport.ok, false);
        assert.equal(copiedOldReport.storage_state.storage_state_age_source, "provided_created_at");
        assert.equal(copiedOldReport.storage_state.storage_state_fresh, false);
        assert.equal(copiedOldReport.violations.includes("storage_state_stale"), true);

        const futureCreatedAtReport = await validateRuntimePreflight({
            storageStatePath: copiedOldStatePath,
            fixtures: {
                guild: "123456789012345678",
                channels: { general: "223456789012345678" },
            },
            requiredFixtures: ["guild", "channels.general"],
            nowMs,
            storageStateCreatedAtMs: nowMs + 60_000,
        });
        assert.equal(futureCreatedAtReport.ok, false);
        assert.equal(futureCreatedAtReport.storage_state.storage_state_age_source, "provided_created_at");
        assert.equal(futureCreatedAtReport.storage_state.storage_state_fresh, false);
        assert.equal(futureCreatedAtReport.violations.includes("storage_state_created_at_in_future"), true);

        const noFixturesReport = await validateRuntimePreflight({
            storageStatePath,
            requiredFixtures: ["guild", "channels.general"],
        });
        assert.equal(noFixturesReport.ok, false);
        assert.deepEqual(noFixturesReport.fixtures?.validation.missing, ["guild", "channels.general"]);
        assert.equal(noFixturesReport.violations.includes("missing_fixture:guild"), true);
        assert.equal(noFixturesReport.violations.includes("missing_fixture:channels.general"), true);

        const destructiveReport = await validateRuntimePreflight({
            storageStatePath,
            fixtures: {
                guild: "123456789012345678",
                channels: { general: "223456789012345678" },
                messages: { delete_target: "423456789012345678" },
            },
            requiredFixtures: messageDeleteBasic.requiredFixtures,
            requiredDisposableFixtures: messageDeleteBasic.safety?.requiredDisposableFixtures,
        });
        assert.equal(destructiveReport.ok, false);
        assert.equal(destructiveReport.violations.includes("fixture_not_disposable:messages.delete_target"), true);
        assert.equal(JSON.stringify(destructiveReport).includes("423456789012345678"), false);

        const disposableReport = await validateRuntimePreflight({
            storageStatePath,
            fixtures: {
                guild: "123456789012345678",
                channels: { general: "223456789012345678" },
                messages: { delete_target: "423456789012345678" },
                disposable: ["messages.delete_target"],
            },
            requiredFixtures: messageDeleteBasic.requiredFixtures,
            requiredDisposableFixtures: messageDeleteBasic.safety?.requiredDisposableFixtures,
        });
        assert.equal(disposableReport.ok, true);
        assert.equal(disposableReport.fixtures?.disposable_validation.ok, true);

        const artifactStoragePath = join(root, "data", "runs", "state.json");
        await mkdir(join(root, "data", "runs"), { recursive: true });
        await writeFile(artifactStoragePath, JSON.stringify({ cookies: [], origins: [] }), "utf8");
        const badReport = await validateRuntimePreflight({
            storageStatePath: artifactStoragePath,
            fixtures: { guild: "123456789012345678" },
            requiredFixtures: ["guild", "channels.general"],
            forbiddenStorageRoots: [join(root, "data")],
        });

        assert.equal(badReport.ok, false);
        assert.equal(badReport.violations.includes("storage_state_empty"), true);
        assert.equal(badReport.violations.includes("storage_state_missing_discord_session"), true);
        assert.equal(badReport.violations.includes("storage_state_in_artifact_root"), true);
        assert.equal(badReport.storage_state.forbidden_storage_root, "{forbidden_storage_root}");
        assert.equal(JSON.stringify(badReport).includes(artifactStoragePath), false);
        assert.equal(JSON.stringify(badReport).includes(join(root, "data")), false);
        assert.equal(badReport.violations.includes("missing_fixture:channels.general"), true);

        const missingStatePath = join(root, "private@example.com", "missing.storage-state.json");
        const missingStateReport = await validateRuntimePreflight({ storageStatePath: missingStatePath });
        const serializedMissingState = JSON.stringify(missingStateReport);
        assert.equal(missingStateReport.ok, false);
        assert.equal(missingStateReport.violations.includes("storage_state_unreadable"), true);
        assert.equal(missingStateReport.storage_state.parse_error, "ENOENT");
        assert.equal(serializedMissingState.includes(missingStatePath), false);
        assert.equal(serializedMissingState.includes("private@example.com"), false);
        assert.equal(scanForSecrets(missingStateReport).ok, true);

        const readinessPath = join(root, "runtime-readiness.json");
        await assert.rejects(
            execFileAsync(process.execPath, [
                fileURLToPath(new URL("./cli.js", import.meta.url)),
                "preflight-runtime",
                "--storage-state",
                storageStatePath,
                "--all-built-ins",
                "true",
                "--out",
                readinessPath,
            ]),
            /missing_fixture:guild/,
        );
        const readiness = JSON.parse(await readFile(readinessPath, "utf8")) as {
            features?: string[];
            required_fixtures?: string[];
            required_disposable_fixtures?: string[];
            fixture_template?: unknown;
        };
        assert.equal(readiness.features?.includes(messageSendBasic.id), true);
        assert.equal(readiness.required_fixtures?.includes("channels.general"), true);
        assert.equal(readiness.required_disposable_fixtures?.includes("messages.delete_target"), true);
        assert.equal(JSON.stringify(readiness.fixture_template).includes("{channel_id}"), true);
        assert.equal(JSON.stringify(readiness).includes("mfa."), false);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("audits static-only runs as incomplete when runtime evidence is required", async () => {
    const root = await mkdtemp(join(tmpdir(), "are-run-audit-static-"));
    try {
        await writeMinimalStaticRun(root);
        await writeFile(join(root, "redaction-audit.json"), JSON.stringify({ ok: true, violations: [] }), "utf8");

        const report = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [idleSession.id],
        });

        assert.equal(report.static.ok, true);
        assert.equal(report.redaction.ok, true);
        assert.equal(report.runtime.ok, false);
        assert.equal(report.ok, false);
        assert.equal(
            report.violations.some((violation) => violation.includes("runtime.features_dir")),
            true,
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("audits malformed redaction audit artifacts without throwing", async () => {
    const root = await mkdtemp(join(tmpdir(), "are-run-audit-redaction-artifact-"));
    try {
        await writeMinimalStaticRun(root);
        await writeFile(join(root, "redaction-audit.json"), "{not json", "utf8");

        const malformedReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: false,
        });

        assert.equal(malformedReport.ok, false);
        assert.equal(malformedReport.redaction_artifact.ok, false);
        assert.equal(
            malformedReport.redaction_artifact.checks.some((check) => check.id === "redaction.audit_file.parse" && !check.ok),
            true,
        );
        assert.equal(
            malformedReport.violations.some((violation) => violation.includes("redaction.audit_file.parse")),
            true,
        );

        await writeFile(join(root, "redaction-audit.json"), JSON.stringify([]), "utf8");
        const nonObjectReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: false,
        });

        assert.equal(nonObjectReport.ok, false);
        assert.equal(nonObjectReport.redaction_artifact.ok, false);
        assert.equal(
            nonObjectReport.redaction_artifact.checks.some((check) => check.id === "redaction.audit_file.ok" && !check.ok),
            true,
        );
        assert.equal(
            nonObjectReport.violations.some((violation) => violation.includes("redaction.audit_file.ok")),
            true,
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("audits static context manifest file integrity", async () => {
    const root = await mkdtemp(join(tmpdir(), "are-run-audit-static-context-"));
    try {
        await writeMinimalStaticRun(root);
        const manifestPath = join(root, "static", "context.manifest.json");
        const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as { files: Array<Record<string, unknown>> };

        await writeFile(join(root, "static", "routes.catalog.json"), JSON.stringify([{ route: "tampered" }]), "utf8");
        const tamperedReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: false,
        });
        assert.equal(tamperedReport.static.ok, false);
        assert.equal(
            tamperedReport.violations.some((violation) => violation.includes("static.context.file.routes_catalog_json.hash")),
            true,
        );

        await writeMinimalStaticRun(root);
        manifest.files[0].path = "../outside.json";
        await writeFile(manifestPath, JSON.stringify(manifest), "utf8");
        const unsafePathReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: false,
        });
        assert.equal(unsafePathReport.static.ok, false);
        assert.equal(
            unsafePathReport.violations.some((violation) => violation.includes("static.context.file.outside_json.shape")),
            true,
        );

        await writeMinimalStaticRun(root);
        const windowsManifest = JSON.parse(await readFile(manifestPath, "utf8")) as { files: Array<Record<string, unknown>> };
        windowsManifest.files[0].path = "..\\outside.json";
        await writeFile(manifestPath, JSON.stringify(windowsManifest), "utf8");
        const windowsTraversalReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: false,
        });
        assert.equal(windowsTraversalReport.static.ok, false);
        assert.equal(
            windowsTraversalReport.violations.some((violation) => violation.includes("static.context.file.outside_json.shape")),
            true,
        );

        await writeMinimalStaticRun(root);
        const malformedHashManifest = JSON.parse(await readFile(manifestPath, "utf8")) as { files: Array<Record<string, unknown>> };
        malformedHashManifest.files[0].hash = "sha256:not-a-real-hash";
        await writeFile(manifestPath, JSON.stringify(malformedHashManifest), "utf8");
        const malformedHashReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: false,
        });
        assert.equal(malformedHashReport.static.ok, false);
        assert.equal(
            malformedHashReport.violations.some((violation) => violation.includes("static.context.file.routes_catalog_json.shape")),
            true,
        );

        await writeMinimalStaticRun(root);
        await writeFile(manifestPath, JSON.stringify([]), "utf8");
        const nonObjectReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: false,
        });
        assert.equal(nonObjectReport.static.ok, false);
        assert.equal(
            nonObjectReport.violations.some((violation) => violation.includes("static.context.shape")),
            true,
        );

        await writeMinimalStaticRun(root);
        await writeFile(join(root, "static", "build.json"), "{not json", "utf8");
        const malformedBuildReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: false,
        });
        assert.equal(malformedBuildReport.static.ok, false);
        assert.equal(
            malformedBuildReport.violations.some((violation) => violation.includes("static.build.parse")),
            true,
        );

        await writeMinimalStaticRun(root);
        await writeFile(manifestPath, "{not json", "utf8");
        const malformedContextReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: false,
        });
        assert.equal(malformedContextReport.static.ok, false);
        assert.equal(
            malformedContextReport.violations.some((violation) => violation.includes("static.context.parse")),
            true,
        );

        await writeMinimalStaticRun(root);
        await writeFile(join(root, "static", "routes.catalog.json"), "{not json", "utf8");
        const malformedCatalogReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: false,
        });
        assert.equal(malformedCatalogReport.static.ok, false);
        assert.equal(
            malformedCatalogReport.violations.some((violation) => violation.includes("static.catalog.routes.catalog.json.parse")),
            true,
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("audits retained static asset local hash and byte metadata", async () => {
    const root = await mkdtemp(join(tmpdir(), "are-run-audit-static-integrity-"));
    try {
        await writeMinimalStaticRun(root);
        const assetsPath = join(root, "static", "assets.json");
        const assets = JSON.parse(await readFile(assetsPath, "utf8")) as Array<Record<string, unknown>>;
        assets[0].local_hash = undefined;
        assets[0].local_bytes = undefined;
        await writeFile(assetsPath, JSON.stringify(assets), "utf8");

        const fallbackReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: false,
        });
        assert.equal(fallbackReport.static.ok, true);

        assets[0].local_hash = "sha256:not-the-retained-file";
        assets[0].local_bytes = 1;
        await writeFile(assetsPath, JSON.stringify(assets), "utf8");

        const report = await auditDataminingRun({
            runDir: root,
            requireRuntime: false,
        });

        assert.equal(report.static.ok, false);
        assert.equal(report.ok, false);
        assert.equal(
            report.violations.some((violation) => violation.includes("local_hash")),
            true,
        );
        assert.equal(
            report.violations.some((violation) => violation.includes("local_bytes")),
            true,
        );

        assets[0].local_hash = undefined;
        assets[0].local_bytes = undefined;
        assets[0].hash = undefined;
        assets[0].bytes = undefined;
        await writeFile(assetsPath, JSON.stringify(assets), "utf8");
        const missingIntegrityReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: false,
        });
        assert.equal(missingIntegrityReport.static.ok, false);
        assert.equal(
            missingIntegrityReport.violations.some((violation) => violation.includes("must include hash or local_hash")),
            true,
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("audits static assets catalog as a JSON array", async () => {
    const root = await mkdtemp(join(tmpdir(), "are-run-audit-static-assets-array-"));
    try {
        await writeMinimalStaticRun(root);
        await writeFile(join(root, "redaction-audit.json"), JSON.stringify({ ok: true, violations: [] }), "utf8");
        await writeFile(join(root, "static", "assets.json"), JSON.stringify({ assets: [] }), "utf8");

        const report = await auditDataminingRun({
            runDir: root,
            requireRuntime: false,
        });

        assert.equal(report.static.ok, false);
        assert.equal(
            report.violations.some((violation) => violation.includes("static.assets.array")),
            true,
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("audits malformed static JSON artifacts without throwing", async () => {
    const cases = [
        { file: "assets.json", violation: "static.assets.array" },
        { file: "routes.catalog.json", violation: "static.catalog.routes.catalog.json.parse" },
        { file: "routes.source.catalog.json", violation: "static.catalog.routes.source.catalog.json.parse" },
        { file: "gateway.catalog.json", violation: "static.catalog.gateway.catalog.json.parse" },
        { file: "experiments.catalog.json", violation: "static.catalog.experiments.catalog.json.parse" },
        { file: "docs.index.json", violation: "static.catalog.docs.index.json.parse" },
        { file: "routes.xhyrom.catalog.json", violation: "static.catalog.routes.xhyrom.catalog.json.parse" },
        { file: "experiments.xhyrom.catalog.json", violation: "static.catalog.experiments.xhyrom.catalog.json.parse" },
        { file: "routes.userdoccers.catalog.json", violation: "static.catalog.routes.userdoccers.catalog.json.parse" },
        { file: "gateway.userdoccers.catalog.json", violation: "static.catalog.gateway.userdoccers.catalog.json.parse" },
    ];

    for (const { file, violation } of cases) {
        const root = await mkdtemp(join(tmpdir(), "are-run-audit-static-json-"));
        try {
            await writeMinimalStaticRun(root);
            await writeFile(join(root, "static", file), "{not json", "utf8");

            const report = await auditDataminingRun({
                runDir: root,
                requireRuntime: false,
            });

            assert.equal(report.static.ok, false, file);
            assert.equal(report.ok, false, file);
            assert.equal(
                report.violations.some((candidate) => candidate.includes(violation)),
                true,
                `${file} should fail ${violation}`,
            );
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    }
});

test("audits coverage artifacts with HTTP-only or Gateway-only observations", async () => {
    const root = await mkdtemp(join(tmpdir(), "are-run-audit-coverage-"));
    try {
        await writeMinimalStaticRun(root);
        await writeFile(join(root, "redaction-audit.json"), JSON.stringify({ ok: true, violations: [] }), "utf8");
        const coverageDir = join(root, "coverage-http-only");
        await mkdir(coverageDir, { recursive: true });
        const routeCoverageEntries = [
            {
                route: "POST /channels/{channel_id}/messages",
                methods_observed: ["POST"],
                feature_ids: ["message.send.basic"],
                observed_run_ids: ["run"],
                build_ids: ["build-run"],
                first_observed_run_id: "run",
                last_observed_run_id: "run",
                first_observed_build: "build-run",
                last_observed_build: "build-run",
                payload_shape_hashes: ["sha256:request"],
                response_shape_hashes: ["sha256:response"],
                request_shape_history: [],
                response_shape_history: [],
            },
        ];
        await writeFile(join(coverageDir, "routes.coverage.json"), JSON.stringify(routeCoverageEntries), "utf8");
        await writeFile(join(coverageDir, "gateway.coverage.json"), "[]", "utf8");
        await writeFile(join(coverageDir, "routes.coverage.md"), renderRouteCoverageMarkdown(routeCoverageEntries), "utf8");
        await writeFile(join(coverageDir, "gateway.coverage.md"), renderGatewayCoverageMarkdown([]), "utf8");

        const httpOnly = await auditDataminingRun({
            runDir: root,
            requireRuntime: false,
            coverageDir,
        });
        assert.equal(httpOnly.coverage?.ok, true);
        assert.equal(httpOnly.ok, true);

        await writeFile(
            join(coverageDir, "routes.coverage.md"),
            renderRouteCoverageMarkdown(routeCoverageEntries).replace("- builds: build-run", "- builds: stale-build-run"),
            "utf8",
        );
        const staleRouteBuildMarkdown = await auditDataminingRun({
            runDir: root,
            requireRuntime: false,
            coverageDir,
        });
        assert.equal(staleRouteBuildMarkdown.coverage?.ok, false);
        assert.equal(
            staleRouteBuildMarkdown.violations.some((violation) => violation.includes("coverage.routes_markdown.entry.0")),
            true,
        );

        await writeFile(
            join(coverageDir, "routes.coverage.md"),
            renderRouteCoverageMarkdown(routeCoverageEntries).replace("- request shapes: sha256:request", "- request shapes: sha256:request-extra"),
            "utf8",
        );
        const staleRouteShapeMarkdown = await auditDataminingRun({
            runDir: root,
            requireRuntime: false,
            coverageDir,
        });
        assert.equal(staleRouteShapeMarkdown.coverage?.ok, false);
        assert.equal(
            staleRouteShapeMarkdown.violations.some((violation) => violation.includes("coverage.routes_markdown.entry.0")),
            true,
        );

        await writeFile(join(coverageDir, "routes.coverage.md"), "# Route Coverage\n", "utf8");
        const staleRouteMarkdown = await auditDataminingRun({
            runDir: root,
            requireRuntime: false,
            coverageDir,
        });
        assert.equal(staleRouteMarkdown.coverage?.ok, false);
        assert.equal(
            staleRouteMarkdown.violations.some((violation) => violation.includes("coverage.routes_markdown.entry.0")),
            true,
        );

        await rm(join(coverageDir, "routes.coverage.md"), { force: true });
        const missingRouteMarkdown = await auditDataminingRun({
            runDir: root,
            requireRuntime: false,
            coverageDir,
        });
        assert.equal(missingRouteMarkdown.coverage?.ok, false);
        assert.equal(
            missingRouteMarkdown.violations.some((violation) => violation.includes("coverage.routes_markdown")),
            true,
        );

        await mkdir(join(coverageDir, "routes.coverage.md"));
        const unreadableRouteMarkdown = await auditDataminingRun({
            runDir: root,
            requireRuntime: false,
            coverageDir,
        });
        assert.equal(unreadableRouteMarkdown.coverage?.ok, false);
        assert.equal(
            unreadableRouteMarkdown.violations.some((violation) => violation.includes("coverage.routes_markdown")),
            true,
        );
        await rm(join(coverageDir, "routes.coverage.md"), { recursive: true, force: true });
        await writeFile(join(coverageDir, "routes.coverage.md"), renderRouteCoverageMarkdown(routeCoverageEntries), "utf8");

        await writeFile(join(coverageDir, "routes.coverage.json"), "{", "utf8");
        const malformedRouteCoverageJson = await auditDataminingRun({
            runDir: root,
            requireRuntime: false,
            coverageDir,
        });
        assert.equal(malformedRouteCoverageJson.coverage?.ok, false);
        assert.equal(
            malformedRouteCoverageJson.violations.some((violation) => violation.includes("coverage.routes_array")),
            true,
        );
        await writeFile(join(coverageDir, "routes.coverage.json"), JSON.stringify(routeCoverageEntries), "utf8");

        const multiRouteCoverageDir = join(root, "coverage-multi-route-stale-section");
        await mkdir(multiRouteCoverageDir, { recursive: true });
        const multiRouteCoverageEntries = [
            ...routeCoverageEntries,
            {
                ...routeCoverageEntries[0],
                route: "POST /channels/{channel_id}/typing",
            },
        ];
        await writeFile(join(multiRouteCoverageDir, "routes.coverage.json"), JSON.stringify(multiRouteCoverageEntries), "utf8");
        await writeFile(join(multiRouteCoverageDir, "gateway.coverage.json"), "[]", "utf8");
        await writeFile(
            join(multiRouteCoverageDir, "routes.coverage.md"),
            [
                "# Route Coverage",
                "",
                "## POST /channels/{channel_id}/messages",
                "",
                "- methods: POST",
                "- features: message.send.basic",
                "- runs: run",
                "- builds: build-run",
                "- request shapes: sha256:request",
                "- response shapes: sha256:response",
                "",
                "## POST /channels/{channel_id}/typing",
                "",
            ].join("\n"),
            "utf8",
        );
        await writeFile(join(multiRouteCoverageDir, "gateway.coverage.md"), renderGatewayCoverageMarkdown([]), "utf8");
        const staleRouteSectionMarkdown = await auditDataminingRun({
            runDir: root,
            requireRuntime: false,
            coverageDir: multiRouteCoverageDir,
        });
        assert.equal(staleRouteSectionMarkdown.coverage?.ok, false);
        assert.equal(
            staleRouteSectionMarkdown.violations.some((violation) => violation.includes("coverage.routes_markdown.entry.1")),
            true,
        );

        const gatewayOnlyCoverageDir = join(root, "coverage-gateway-only");
        await mkdir(gatewayOnlyCoverageDir, { recursive: true });
        await writeFile(join(gatewayOnlyCoverageDir, "routes.coverage.json"), "[]", "utf8");
        const gatewayCoverageEntries = [
            {
                event: "VOICE_STATE_UPDATE",
                directions: ["received"],
                feature_ids: ["voice.mute_toggle"],
                observed_run_ids: ["run"],
                build_ids: ["build-run"],
                first_observed_run_id: "run",
                last_observed_run_id: "run",
                first_observed_build: "build-run",
                last_observed_build: "build-run",
                payload_shape_hashes: ["sha256:payload"],
                payload_shape_history: [],
            },
        ];
        await writeFile(join(gatewayOnlyCoverageDir, "gateway.coverage.json"), JSON.stringify(gatewayCoverageEntries), "utf8");
        await writeFile(join(gatewayOnlyCoverageDir, "routes.coverage.md"), renderRouteCoverageMarkdown([]), "utf8");
        await writeFile(join(gatewayOnlyCoverageDir, "gateway.coverage.md"), renderGatewayCoverageMarkdown(gatewayCoverageEntries), "utf8");

        const gatewayOnly = await auditDataminingRun({
            runDir: root,
            requireRuntime: false,
            coverageDir: gatewayOnlyCoverageDir,
        });
        assert.equal(gatewayOnly.coverage?.ok, true);
        assert.equal(gatewayOnly.ok, true);

        await writeFile(
            join(gatewayOnlyCoverageDir, "gateway.coverage.md"),
            renderGatewayCoverageMarkdown(gatewayCoverageEntries).replace("- builds: build-run", "- builds: stale-build-run"),
            "utf8",
        );
        const staleGatewayBuildMarkdown = await auditDataminingRun({
            runDir: root,
            requireRuntime: false,
            coverageDir: gatewayOnlyCoverageDir,
        });
        assert.equal(staleGatewayBuildMarkdown.coverage?.ok, false);
        assert.equal(
            staleGatewayBuildMarkdown.violations.some((violation) => violation.includes("coverage.gateway_markdown.entry.0")),
            true,
        );

        await writeFile(join(gatewayOnlyCoverageDir, "gateway.coverage.md"), "# Gateway Coverage\n", "utf8");
        const staleGatewayMarkdown = await auditDataminingRun({
            runDir: root,
            requireRuntime: false,
            coverageDir: gatewayOnlyCoverageDir,
        });
        assert.equal(staleGatewayMarkdown.coverage?.ok, false);
        assert.equal(
            staleGatewayMarkdown.violations.some((violation) => violation.includes("coverage.gateway_markdown.entry.0")),
            true,
        );

        const duplicateGatewayHeadingDir = join(root, "coverage-duplicate-gateway-heading");
        await mkdir(duplicateGatewayHeadingDir, { recursive: true });
        const duplicateGatewayEntries = [
            {
                ...gatewayCoverageEntries[0],
                directions: ["received"],
                feature_ids: ["message.send.basic"],
                observed_run_ids: ["run-a"],
                first_observed_run_id: "run-a",
                last_observed_run_id: "run-a",
                payload_shape_hashes: ["sha256:received"],
            },
            {
                ...gatewayCoverageEntries[0],
                directions: ["sent"],
                feature_ids: ["message.ack"],
                observed_run_ids: ["run-b"],
                first_observed_run_id: "run-b",
                last_observed_run_id: "run-b",
                payload_shape_hashes: ["sha256:sent"],
            },
        ];
        await writeFile(join(duplicateGatewayHeadingDir, "routes.coverage.json"), "[]", "utf8");
        await writeFile(join(duplicateGatewayHeadingDir, "gateway.coverage.json"), JSON.stringify(duplicateGatewayEntries), "utf8");
        await writeFile(join(duplicateGatewayHeadingDir, "routes.coverage.md"), renderRouteCoverageMarkdown([]), "utf8");
        await writeFile(join(duplicateGatewayHeadingDir, "gateway.coverage.md"), renderGatewayCoverageMarkdown(duplicateGatewayEntries), "utf8");
        const duplicateGatewayHeading = await auditDataminingRun({
            runDir: root,
            requireRuntime: false,
            coverageDir: duplicateGatewayHeadingDir,
        });
        assert.equal(duplicateGatewayHeading.coverage?.ok, true);

        const malformedShapeCoverageDir = join(root, "coverage-malformed-shapes");
        await mkdir(malformedShapeCoverageDir, { recursive: true });
        await writeFile(
            join(malformedShapeCoverageDir, "routes.coverage.json"),
            JSON.stringify([
                {
                    ...routeCoverageEntries[0],
                    payload_shape_hashes: ["sha256:request", 7],
                },
            ]),
            "utf8",
        );
        await writeFile(
            join(malformedShapeCoverageDir, "gateway.coverage.json"),
            JSON.stringify([
                {
                    ...gatewayCoverageEntries[0],
                    payload_shape_hashes: "sha256:payload",
                },
            ]),
            "utf8",
        );
        await writeFile(join(malformedShapeCoverageDir, "routes.coverage.md"), "# Route Coverage\n", "utf8");
        await writeFile(join(malformedShapeCoverageDir, "gateway.coverage.md"), "# Gateway Coverage\n", "utf8");
        const malformedShapeCoverage = await auditDataminingRun({
            runDir: root,
            requireRuntime: false,
            coverageDir: malformedShapeCoverageDir,
        });
        assert.equal(malformedShapeCoverage.coverage?.ok, false);
        assert.equal(
            malformedShapeCoverage.violations.some((violation) => violation.includes("coverage.routes_entry.0")),
            true,
        );
        assert.equal(
            malformedShapeCoverage.violations.some((violation) => violation.includes("coverage.gateway_entry.0")),
            true,
        );

        const malformedCatalogCoverageDir = join(root, "coverage-malformed-catalog");
        await mkdir(malformedCatalogCoverageDir, { recursive: true });
        await writeFile(
            join(malformedCatalogCoverageDir, "routes.coverage.json"),
            JSON.stringify([
                {
                    ...routeCoverageEntries[0],
                    catalog: { source: "test" },
                },
            ]),
            "utf8",
        );
        await writeFile(
            join(malformedCatalogCoverageDir, "gateway.coverage.json"),
            JSON.stringify([
                {
                    ...gatewayCoverageEntries[0],
                    catalog: { name: "Voice State Update" },
                },
            ]),
            "utf8",
        );
        await writeFile(join(malformedCatalogCoverageDir, "routes.coverage.md"), "# Route Coverage\n", "utf8");
        await writeFile(join(malformedCatalogCoverageDir, "gateway.coverage.md"), "# Gateway Coverage\n", "utf8");
        const malformedCatalogCoverage = await auditDataminingRun({
            runDir: root,
            requireRuntime: false,
            coverageDir: malformedCatalogCoverageDir,
        });
        assert.equal(malformedCatalogCoverage.coverage?.ok, false);
        assert.equal(
            malformedCatalogCoverage.violations.some((violation) => violation.includes("coverage.routes_entry.0")),
            true,
        );
        assert.equal(
            malformedCatalogCoverage.violations.some((violation) => violation.includes("coverage.gateway_entry.0")),
            true,
        );

        const malformedRangeCoverageDir = join(root, "coverage-malformed-ranges");
        await mkdir(malformedRangeCoverageDir, { recursive: true });
        await writeFile(
            join(malformedRangeCoverageDir, "routes.coverage.json"),
            JSON.stringify([
                {
                    ...routeCoverageEntries[0],
                    first_observed_run_id: "stale-run",
                    last_observed_run_id: "stale-run",
                },
            ]),
            "utf8",
        );
        await writeFile(
            join(malformedRangeCoverageDir, "gateway.coverage.json"),
            JSON.stringify([
                {
                    ...gatewayCoverageEntries[0],
                    first_observed_build: "stale-build",
                    last_observed_build: "stale-build",
                },
            ]),
            "utf8",
        );
        await writeFile(join(malformedRangeCoverageDir, "routes.coverage.md"), "# Route Coverage\n", "utf8");
        await writeFile(join(malformedRangeCoverageDir, "gateway.coverage.md"), "# Gateway Coverage\n", "utf8");
        const malformedRangeCoverage = await auditDataminingRun({
            runDir: root,
            requireRuntime: false,
            coverageDir: malformedRangeCoverageDir,
        });
        assert.equal(malformedRangeCoverage.coverage?.ok, false);
        assert.equal(
            malformedRangeCoverage.violations.some((violation) => violation.includes("coverage.routes_entry.0")),
            true,
        );
        assert.equal(
            malformedRangeCoverage.violations.some((violation) => violation.includes("coverage.gateway_entry.0")),
            true,
        );

        const emptyCoverageDir = join(root, "coverage-empty");
        await mkdir(emptyCoverageDir, { recursive: true });
        await writeFile(join(emptyCoverageDir, "routes.coverage.json"), "[]", "utf8");
        await writeFile(join(emptyCoverageDir, "gateway.coverage.json"), "[]", "utf8");
        await writeFile(join(emptyCoverageDir, "routes.coverage.md"), "# Routes\n", "utf8");
        await writeFile(join(emptyCoverageDir, "gateway.coverage.md"), "# Gateway\n", "utf8");
        const emptyCoverage = await auditDataminingRun({
            runDir: root,
            requireRuntime: false,
            coverageDir: emptyCoverageDir,
        });

        assert.equal(emptyCoverage.coverage?.ok, false);
        assert.equal(
            emptyCoverage.violations.some((violation) => violation.includes("coverage.observed_entries")),
            true,
        );

        const malformedCoverageDir = join(root, "coverage-non-array");
        await mkdir(malformedCoverageDir, { recursive: true });
        await writeFile(join(malformedCoverageDir, "routes.coverage.json"), JSON.stringify({ routes: [] }), "utf8");
        await writeFile(join(malformedCoverageDir, "gateway.coverage.json"), JSON.stringify([{ event: "VOICE_STATE_UPDATE", feature_ids: ["voice.mute_toggle"] }]), "utf8");
        await writeFile(join(malformedCoverageDir, "routes.coverage.md"), "# Routes\n", "utf8");
        await writeFile(join(malformedCoverageDir, "gateway.coverage.md"), "# Gateway\n", "utf8");
        const malformedCoverage = await auditDataminingRun({
            runDir: root,
            requireRuntime: false,
            coverageDir: malformedCoverageDir,
        });

        assert.equal(malformedCoverage.coverage?.ok, false);
        assert.equal(
            malformedCoverage.violations.some((violation) => violation.includes("coverage.routes_array")),
            true,
        );

        const malformedEntryCoverageDir = join(root, "coverage-malformed-entry");
        await mkdir(malformedEntryCoverageDir, { recursive: true });
        await writeFile(join(malformedEntryCoverageDir, "routes.coverage.json"), JSON.stringify([{ route: "POST /missing-context" }]), "utf8");
        await writeFile(join(malformedEntryCoverageDir, "gateway.coverage.json"), "[]", "utf8");
        await writeFile(join(malformedEntryCoverageDir, "routes.coverage.md"), "# Routes\n", "utf8");
        await writeFile(join(malformedEntryCoverageDir, "gateway.coverage.md"), "# Gateway\n", "utf8");
        const malformedEntryCoverage = await auditDataminingRun({
            runDir: root,
            requireRuntime: false,
            coverageDir: malformedEntryCoverageDir,
        });

        assert.equal(malformedEntryCoverage.coverage?.ok, false);
        assert.equal(
            malformedEntryCoverage.violations.some((violation) => violation.includes("coverage.routes_entry.0")),
            true,
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("audits review queue artifacts as JSON arrays", async () => {
    const root = await mkdtemp(join(tmpdir(), "are-run-audit-review-queue-"));
    try {
        await writeMinimalStaticRun(root);
        await writeFile(join(root, "redaction-audit.json"), JSON.stringify({ ok: true, violations: [] }), "utf8");
        const reviewQueuePath = join(root, "review-queue.json");
        await writeFile(reviewQueuePath, JSON.stringify([]), "utf8");

        const emptyReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: false,
            reviewQueuePath,
        });
        assert.equal(emptyReport.review_queue?.ok, true);

        await writeFile(
            reviewQueuePath,
            JSON.stringify([{ feature_id: "message.send.basic", reason: "new_route", severity: "medium", subject: "POST /channels/{channel_id}/messages" }]),
            "utf8",
        );
        const validReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: false,
            reviewQueuePath,
        });
        assert.equal(validReport.review_queue?.ok, true);

        await writeFile(reviewQueuePath, JSON.stringify({ items: [] }), "utf8");

        const report = await auditDataminingRun({
            runDir: root,
            requireRuntime: false,
            reviewQueuePath,
        });

        assert.equal(report.review_queue?.ok, false);
        assert.equal(
            report.violations.some((violation) => violation.includes("review_queue.array")),
            true,
        );

        await writeFile(reviewQueuePath, JSON.stringify([{ reason: "new_route" }]), "utf8");
        const malformedEntryReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: false,
            reviewQueuePath,
        });
        assert.equal(malformedEntryReport.review_queue?.ok, false);
        assert.equal(
            malformedEntryReport.violations.some((violation) => violation.includes("review_queue.entry.0")),
            true,
        );

        await writeFile(reviewQueuePath, "[", "utf8");
        const malformedJsonReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: false,
            reviewQueuePath,
        });
        assert.equal(malformedJsonReport.review_queue?.ok, false);
        assert.equal(
            malformedJsonReport.violations.some((violation) => violation.includes("review_queue.array")),
            true,
        );

        await rm(reviewQueuePath, { force: true });
        const missingReviewQueueReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: false,
            reviewQueuePath,
        });
        assert.equal(missingReviewQueueReport.review_queue?.ok, false);
        assert.equal(
            missingReviewQueueReport.violations.some((violation) => violation.includes("review_queue.file")),
            true,
        );
        assert.equal(
            missingReviewQueueReport.violations.some((violation) => violation.includes("review_queue.array")),
            true,
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("audits redaction for coverage and review queue paths outside the run directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "are-run-audit-external-redaction-"));
    try {
        const runDir = join(root, "run");
        const coverageDir = join(root, "coverage");
        const reviewQueuePath = join(root, "review-queue.json");
        await writeMinimalStaticRun(runDir);
        await writeFile(join(runDir, "redaction-audit.json"), JSON.stringify({ ok: true, violations: [] }), "utf8");
        await mkdir(coverageDir, { recursive: true });
        const routeCoverageEntries = [
            {
                route: "GET /private@example.com",
                methods_observed: ["GET"],
                feature_ids: ["bootstrap.idle.session"],
                observed_run_ids: ["run"],
                build_ids: ["build-run"],
                first_observed_run_id: "run",
                last_observed_run_id: "run",
                first_observed_build: "build-run",
                last_observed_build: "build-run",
                payload_shape_hashes: [],
                response_shape_hashes: [],
                request_shape_history: [],
                response_shape_history: [],
            },
        ];
        await writeFile(join(coverageDir, "routes.coverage.json"), JSON.stringify(routeCoverageEntries), "utf8");
        await writeFile(join(coverageDir, "gateway.coverage.json"), "[]", "utf8");
        await writeFile(join(coverageDir, "routes.coverage.md"), renderRouteCoverageMarkdown(routeCoverageEntries), "utf8");
        await writeFile(join(coverageDir, "gateway.coverage.md"), renderGatewayCoverageMarkdown([]), "utf8");
        await writeFile(
            reviewQueuePath,
            JSON.stringify([{ feature_id: "bootstrap.idle.session", reason: "new_route", severity: "medium", subject: "GET /private@example.com" }]),
            "utf8",
        );

        const report = await auditDataminingRun({
            runDir,
            requireRuntime: false,
            coverageDir,
            reviewQueuePath,
        });

        assert.equal(report.coverage?.ok, true);
        assert.equal(report.review_queue?.ok, true);
        assert.equal(report.redaction.ok, false);
        assert.equal(
            report.violations.some((violation) => violation.includes("coverage") && violation.includes("redaction:")),
            true,
        );
        assert.equal(
            report.violations.some((violation) => violation.includes("review-queue.json") && violation.includes("redaction:")),
            true,
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("reports missing external coverage artifacts without aborting redaction scan", async () => {
    const root = await mkdtemp(join(tmpdir(), "are-run-audit-missing-coverage-"));
    try {
        await writeMinimalStaticRun(root);
        await writeFile(join(root, "redaction-audit.json"), JSON.stringify({ ok: true, violations: [] }), "utf8");

        const report = await auditDataminingRun({
            runDir: root,
            requireRuntime: false,
            coverageDir: join(root, "..", "missing-coverage"),
        });

        assert.equal(report.redaction.ok, true);
        assert.equal(report.coverage?.ok, false);
        assert.equal(
            report.violations.some((violation) => violation.includes("coverage.routes_json")),
            true,
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("audits a redacted runtime feature run with expected provenance evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "are-run-audit-runtime-"));
    try {
        await writeMinimalStaticRun(root);
        const featureDir = join(root, "features", messageSendBasic.id);
        await mkdir(join(featureDir, "screenshots"), { recursive: true });
        const events: CaptureEvent[] = [
            {
                run_id: "run",
                feature_id: messageSendBasic.id,
                step_id: "send-message",
                ts_monotonic_ms: 1,
                kind: "step.start",
                title: "Send plain message",
            },
            {
                run_id: "run",
                feature_id: messageSendBasic.id,
                step_id: "send-message",
                ts_monotonic_ms: 1.5,
                kind: "ui.action",
                action: "fill",
                target: "role:textbox",
                value_redacted: true,
            },
            {
                run_id: "run",
                feature_id: messageSendBasic.id,
                step_id: "send-message",
                ts_monotonic_ms: 2,
                kind: "http.request",
                cdp_request_id: "message-send-request",
                method: "POST",
                url: "https://discord.com/api/v9/channels/{channel_id}/messages",
                normalized_route: "/channels/{channel_id}/messages",
                headers_redacted: true,
                request_body_shape_hash: "sha256:request",
            },
            {
                run_id: "run",
                feature_id: messageSendBasic.id,
                step_id: "send-message",
                ts_monotonic_ms: 3,
                kind: "http.response",
                cdp_request_id: "message-send-request",
                method: "POST",
                url: "https://discord.com/api/v9/channels/{channel_id}/messages",
                normalized_route: "/channels/{channel_id}/messages",
                status: 200,
                headers_redacted: true,
                response_body_shape_hash: "sha256:response",
            },
            {
                run_id: "run",
                feature_id: messageSendBasic.id,
                step_id: "send-message",
                ts_monotonic_ms: 4,
                kind: "ws.created",
                websocket_id: "gateway-1",
                url: "wss://gateway.discord.gg/?v={query}&encoding={query}",
            },
            {
                run_id: "run",
                feature_id: messageSendBasic.id,
                step_id: "send-message",
                ts_monotonic_ms: 5,
                kind: "ws.frame.received",
                websocket_id: "gateway-1",
                url: "wss://gateway.discord.gg/?v={query}&encoding={query}",
                direction: "received",
                opcode: 0,
                gateway_event: "MESSAGE_CREATE",
                payload_shape_hash: "sha256:payload",
            },
            {
                run_id: "run",
                feature_id: messageSendBasic.id,
                step_id: "send-message",
                ts_monotonic_ms: 6,
                kind: "step.end",
                title: "Send plain message",
            },
        ];
        const summary: FeatureSummary = {
            run_id: "run",
            feature_id: messageSendBasic.id,
            title: messageSendBasic.title,
            expected: messageSendBasic.expected,
            steps: [
                {
                    step_id: "send-message",
                    title: "Send plain message",
                    started_at_ms: 1,
                    ended_at_ms: 6,
                    actions: [
                        {
                            action: "fill",
                            target: "role:textbox",
                            value_redacted: true,
                            occurred_at_ms: 1.5,
                        },
                    ],
                },
            ],
            traffic: [
                {
                    type: "http",
                    step_id: "send-message",
                    method: "POST",
                    route: "POST /channels/{channel_id}/messages",
                    status_codes: [200],
                    request_shape: "sha256:request",
                    response_shape: "sha256:response",
                    attribution: "direct",
                },
                {
                    type: "gateway",
                    step_id: "send-message",
                    direction: "received",
                    event: "MESSAGE_CREATE",
                    opcode: 0,
                    payload_shape: "sha256:payload",
                    attribution: "direct",
                },
            ],
            unknown_events: 0,
            background_events: 0,
            generated_at: "2026-05-07T00:00:00.000Z",
        };
        await writeFile(join(featureDir, "preflight.json"), JSON.stringify(validRuntimePreflightReport(messageSendBasic.id)), "utf8");
        await writeFile(join(featureDir, "events.ndjson"), `${events.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");
        await writeFile(
            join(featureDir, "playwright-events.ndjson"),
            [
                playwrightHttpRequestEvent(messageSendBasic.id, "send-message", "POST", "/channels/{channel_id}/messages"),
                playwrightHttpResponseEvent(messageSendBasic.id, "send-message", "POST", "/channels/{channel_id}/messages", 200),
                playwrightGatewayCreatedEvent(messageSendBasic.id, "send-message"),
                playwrightGatewayFrameEvent(messageSendBasic.id, "send-message", "MESSAGE_CREATE"),
            ]
                .map((event) => JSON.stringify(event))
                .join("\n") + "\n",
            "utf8",
        );
        await writeFile(
            join(featureDir, "mitmproxy.redacted.ndjson"),
            `${events
                .filter((event) => event.kind === "http.request" || event.kind === "http.response" || event.kind === "ws.created" || event.kind === "ws.frame.received")
                .map((event) => JSON.stringify(event))
                .join("\n")}\n`,
            "utf8",
        );
        await writeFile(join(featureDir, "summary.json"), JSON.stringify(summary), "utf8");
        await writeFile(
            join(featureDir, "report.md"),
            [
                "# Feature: Send a plain text message",
                "",
                "Run: run",
                `Scenario: ${messageSendBasic.id}`,
                "",
                "## Step: Send plain message (send-message)",
                "",
                "Actions:",
                "",
                "- fill / role:textbox / value redacted",
                "",
                "HTTP:",
                "",
                "- direct: POST /channels/{channel_id}/messages",
                "",
                "Gateway:",
                "",
                "- direct received: MESSAGE_CREATE",
                "",
            ].join("\n"),
            "utf8",
        );
        await writeFile(
            join(featureDir, "run-artifacts.json"),
            JSON.stringify({
                status: "passed",
                preflight_path: "preflight.json",
                events_path: "events.ndjson",
                playwright_events_path: "playwright-events.ndjson",
                summary_path: "summary.json",
                markdown_path: "report.md",
                trace_path: "trace.zip",
                screenshots_dir: "screenshots",
                redacted_har_path: "network.redacted.har",
            }),
            "utf8",
        );
        await writeFile(join(featureDir, "trace.zip"), zipHeader);
        await writeFile(join(featureDir, "screenshots", "001-send-message-start.png"), pngHeader);
        await writeFile(join(featureDir, "screenshots", "002-send-message-end.png"), pngHeader);
        await writeFile(
            join(featureDir, "network.redacted.har"),
            JSON.stringify({
                log: {
                    entries: [
                        {
                            request: {
                                method: "POST",
                                url: "https://{api_host}/api/v9/channels/{channel_id}/messages",
                                headers: [],
                                cookies: [],
                                queryString: [],
                                postData: { text: "{redacted_body}", params: [] },
                            },
                            response: {
                                status: 200,
                                headers: [],
                                cookies: [],
                                content: { text: "{redacted_body}" },
                            },
                        },
                    ],
                },
            }),
            "utf8",
        );
        await writeFile(join(root, "redaction-audit.json"), JSON.stringify({ ok: true, violations: [] }), "utf8");

        const report = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });

        assert.equal(report.ok, true);
        assert.equal(report.runtime.feature_count, 1);
        assert.equal(report.runtime.features[0].http_traffic_count, 1);
        assert.equal(report.runtime.features[0].gateway_traffic_count, 1);
        assert.equal(
            report.runtime.features[0].checks.some((check) => check.id === "runtime.feature.events.ui_action" && check.ok),
            true,
        );
        assert.equal(
            report.runtime.features[0].checks.some((check) => check.id === "runtime.feature.summary.actions" && check.ok),
            true,
        );
        assert.equal(
            report.runtime.features[0].checks.some((check) => check.id === "runtime.feature.report.actions" && check.ok),
            true,
        );
        assert.equal(
            report.runtime.features[0].checks.some((check) => check.id === "runtime.feature.mitmproxy_events.expected_http.POST./channels/{channel_id}/messages" && check.ok),
            true,
        );
        assert.equal(report.violations.length, 0);

        const writePreflight = async (value: unknown) => {
            await writeFile(join(featureDir, "preflight.json"), typeof value === "string" ? value : JSON.stringify(value), "utf8");
        };

        await writePreflight({
            ...validRuntimePreflightReport(messageSendBasic.id),
            violations: ["storage_state_missing_discord_session"],
        });
        const preflightViolationReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(preflightViolationReport.ok, false);
        assert.equal(
            preflightViolationReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.preflight.violations" && !check.ok),
            true,
        );

        const missingStoragePreflight = validRuntimePreflightReport(messageSendBasic.id);
        delete missingStoragePreflight.storage_state;
        await writePreflight(missingStoragePreflight);
        const missingStoragePreflightReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(missingStoragePreflightReport.ok, false);
        assert.equal(
            missingStoragePreflightReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.preflight.shape" && !check.ok),
            true,
        );

        const weakStoragePreflight = validRuntimePreflightReport(messageSendBasic.id);
        const weakStorage = weakStoragePreflight.storage_state as Record<string, unknown>;
        weakStorage.has_discord_session = false;
        weakStorage.discord_auth_storage_count = 0;
        weakStorage.parse_error = "SyntaxError";
        weakStorage.forbidden_storage_root = "{forbidden_storage_root}";
        weakStorage.storage_state_fresh = false;
        weakStorage.storage_state_age_ms = 604800001;
        weakStorage.discord_expired_auth_cookie_count = 1;
        await writePreflight(weakStoragePreflight);
        const weakStoragePreflightReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(weakStoragePreflightReport.ok, false);
        assert.equal(
            weakStoragePreflightReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.preflight.storage_state.session" && !check.ok),
            true,
        );
        assert.equal(
            weakStoragePreflightReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.preflight.storage_state.no_parse_error" && !check.ok),
            true,
        );
        assert.equal(
            weakStoragePreflightReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.preflight.storage_state.no_forbidden_root" && !check.ok),
            true,
        );
        assert.equal(
            weakStoragePreflightReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.preflight.storage_state.freshness" && !check.ok),
            true,
        );
        assert.equal(
            weakStoragePreflightReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.preflight.storage_state.no_expired_auth_cookie" && !check.ok),
            true,
        );

        const failedFixturePreflight = validRuntimePreflightReport(messageSendBasic.id);
        const failedFixtures = failedFixturePreflight.fixtures as Record<string, unknown>;
        failedFixtures.validation = { ok: false, missing: ["channels.general"] };
        await writePreflight(failedFixturePreflight);
        const failedFixturePreflightReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(failedFixturePreflightReport.ok, false);
        assert.equal(
            failedFixturePreflightReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.preflight.fixtures.validation" && !check.ok),
            true,
        );

        await writePreflight([]);
        const nonObjectPreflightReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(nonObjectPreflightReport.ok, false);
        assert.equal(
            nonObjectPreflightReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.preflight.shape" && !check.ok),
            true,
        );

        await writePreflight("{not json");
        const malformedPreflightReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(malformedPreflightReport.ok, false);
        assert.equal(
            malformedPreflightReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.preflight.parse" && !check.ok),
            true,
        );
        await writePreflight(validRuntimePreflightReport(messageSendBasic.id));

        await writeFile(
            join(featureDir, "summary.json"),
            JSON.stringify({
                ...summary,
                steps: summary.steps?.map((step) => ({ ...step, started_at_ms: 0.5 })),
            }),
            "utf8",
        );
        const staleSummaryStepWindowReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(staleSummaryStepWindowReport.ok, false);
        assert.equal(
            staleSummaryStepWindowReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.summary.events.step_windows" && !check.ok),
            true,
        );

        await writeFile(
            join(featureDir, "summary.json"),
            JSON.stringify({
                ...summary,
                steps: summary.steps?.map((step) => ({
                    ...step,
                    actions: step.actions?.map((action) => ({ ...action, occurred_at_ms: 1.75 })),
                })),
            }),
            "utf8",
        );
        const staleSummaryActionReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(staleSummaryActionReport.ok, false);
        assert.equal(
            staleSummaryActionReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.summary.events.actions" && !check.ok),
            true,
        );

        await writeFile(
            join(featureDir, "summary.json"),
            JSON.stringify({
                ...summary,
                steps: summary.steps?.map((step) => ({ ...step, ended_at_ms: 0.75 })),
            }),
            "utf8",
        );
        const impossibleSummaryStepWindowReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(impossibleSummaryStepWindowReport.ok, false);
        assert.equal(
            impossibleSummaryStepWindowReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.summary.steps_shape" && !check.ok),
            true,
        );
        await writeFile(join(featureDir, "summary.json"), JSON.stringify(summary), "utf8");

        await writeFile(
            join(featureDir, "events.ndjson"),
            `${events.map((event) => JSON.stringify(event.kind === "http.response" ? { ...event, ts_monotonic_ms: 1.75 } : event)).join("\n")}\n`,
            "utf8",
        );
        const nonMonotonicEventReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(nonMonotonicEventReport.ok, false);
        assert.equal(
            nonMonotonicEventReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.events.monotonic_timestamps" && !check.ok),
            true,
        );
        await writeFile(join(featureDir, "events.ndjson"), `${events.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");

        await writeFile(
            join(featureDir, "events.ndjson"),
            `${events
                .filter((event) => event.kind !== "http.request")
                .map((event) => JSON.stringify(event))
                .join("\n")}\n`,
            "utf8",
        );
        const orphanHttpResponseReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(orphanHttpResponseReport.ok, false);
        assert.equal(
            orphanHttpResponseReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.events.http_lifecycle" && !check.ok),
            true,
        );
        await writeFile(join(featureDir, "events.ndjson"), `${events.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");

        await writeFile(
            join(featureDir, "events.ndjson"),
            `${events
                .map((event) => JSON.stringify(event.kind === "http.response" ? { ...event, kind: "http.failure", cdp_request_id: "wrong-request", error_text: "failed" } : event))
                .join("\n")}\n`,
            "utf8",
        );
        const mismatchedHttpFailureReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(mismatchedHttpFailureReport.ok, false);
        assert.equal(
            mismatchedHttpFailureReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.events.http_lifecycle" && !check.ok),
            true,
        );
        await writeFile(join(featureDir, "events.ndjson"), `${events.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");

        await writeFile(
            join(featureDir, "events.ndjson"),
            `${mismatchedHttpPairEvents(events)
                .map((event) => JSON.stringify(event))
                .join("\n")}\n`,
            "utf8",
        );
        const mismatchedCdpPairReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(mismatchedCdpPairReport.ok, false);
        assert.equal(
            mismatchedCdpPairReport.runtime.features[0].checks.some(
                (check) => check.id === "runtime.feature.events.expected_http.POST./channels/{channel_id}/messages" && !check.ok,
            ),
            true,
        );
        await writeFile(join(featureDir, "events.ndjson"), `${events.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");

        await writeFile(
            join(featureDir, "events.ndjson"),
            `${events.map((event) => JSON.stringify(event.kind === "step.start" || event.kind === "step.end" ? { ...event, step_id: "stale-step" } : event)).join("\n")}\n`,
            "utf8",
        );
        const staleStepMarkerReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(staleStepMarkerReport.ok, false);
        assert.equal(
            staleStepMarkerReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.summary.events.steps" && !check.ok),
            true,
        );
        await writeFile(join(featureDir, "events.ndjson"), `${events.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");

        await writeFile(
            join(featureDir, "events.ndjson"),
            `${events.map((event) => JSON.stringify(event.kind === "step.end" ? { ...event, step_id: "unmatched-step" } : event)).join("\n")}\n`,
            "utf8",
        );
        const unpairedStepMarkerReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(unpairedStepMarkerReport.ok, false);
        assert.equal(
            unpairedStepMarkerReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.events.step_pairs" && !check.ok),
            true,
        );
        assert.equal(
            unpairedStepMarkerReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.events.open_steps" && !check.ok),
            true,
        );

        await writeFile(
            join(featureDir, "events.ndjson"),
            `${events.map((event) => JSON.stringify(event.kind === "step.end" ? { ...event, ts_monotonic_ms: 0.5 } : event)).join("\n")}\n`,
            "utf8",
        );
        const impossibleEventStepWindowReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(impossibleEventStepWindowReport.ok, false);
        assert.equal(
            impossibleEventStepWindowReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.events.step_windows" && !check.ok),
            true,
        );

        await writeFile(
            join(featureDir, "events.ndjson"),
            `${events
                .filter((event) => event.kind !== "ws.created")
                .map((event) => JSON.stringify(event))
                .join("\n")}\n`,
            "utf8",
        );
        const orphanWebSocketFrameReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(orphanWebSocketFrameReport.ok, false);
        assert.equal(
            orphanWebSocketFrameReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.events.websocket_lifecycle" && !check.ok),
            true,
        );

        const orphanUiAction: CaptureEvent = {
            run_id: "run",
            feature_id: messageSendBasic.id,
            step_id: "orphan-step",
            ts_monotonic_ms: 7,
            kind: "ui.action",
            action: "click",
            target: "role:button",
            value_redacted: true,
        };
        await writeFile(join(featureDir, "events.ndjson"), `${[...events, orphanUiAction].map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");
        const orphanUiActionReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(orphanUiActionReport.ok, false);
        assert.equal(
            orphanUiActionReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.events.ui_action_step" && !check.ok),
            true,
        );
        await writeFile(join(featureDir, "events.ndjson"), `${events.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");

        await writeFile(join(featureDir, "run-artifacts.json"), JSON.stringify([]), "utf8");
        const nonObjectRunArtifactsReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(nonObjectRunArtifactsReport.ok, false);
        assert.equal(
            nonObjectRunArtifactsReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.run_artifacts.status" && !check.ok),
            true,
        );
        assert.equal(
            nonObjectRunArtifactsReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.run_artifacts.shape" && !check.ok),
            true,
        );

        await writeFile(join(featureDir, "run-artifacts.json"), "{not json", "utf8");
        const malformedRunArtifactsReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(malformedRunArtifactsReport.ok, false);
        assert.equal(
            malformedRunArtifactsReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.run_artifacts.parse" && !check.ok),
            true,
        );
        await writeFile(
            join(featureDir, "run-artifacts.json"),
            JSON.stringify({
                status: "passed",
                preflight_path: "preflight.json",
                events_path: "events.ndjson",
                playwright_events_path: "playwright-events.ndjson",
                summary_path: "summary.json",
                markdown_path: "report.md",
                trace_path: "trace.zip",
                screenshots_dir: "screenshots",
                redacted_har_path: "network.redacted.har",
            } satisfies RuntimeRunArtifactManifest),
            "utf8",
        );

        await writeFile(join(featureDir, "events.ndjson"), `${events.map((event) => JSON.stringify({ ...event, feature_id: "message.edit.basic" })).join("\n")}\n`, "utf8");
        const wrongCdpEventIdentityReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(wrongCdpEventIdentityReport.ok, false);
        assert.equal(
            wrongCdpEventIdentityReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.events.feature_id" && !check.ok),
            true,
        );
        await writeFile(join(featureDir, "events.ndjson"), `${events.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");

        await writeFile(join(featureDir, "events.ndjson"), `${events.map((event) => JSON.stringify({ ...event, run_id: "stale-run" })).join("\n")}\n`, "utf8");
        const wrongCdpRunIdentityReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(wrongCdpRunIdentityReport.ok, false);
        assert.equal(
            wrongCdpRunIdentityReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.events.run_id" && !check.ok),
            true,
        );
        await writeFile(join(featureDir, "events.ndjson"), `${events.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");

        await writeFile(
            join(featureDir, "playwright-events.ndjson"),
            [
                playwrightHttpRequestEvent(messageSendBasic.id, "send-message", "POST", "/channels/{channel_id}/messages"),
                playwrightHttpResponseEvent(messageSendBasic.id, "send-message", "POST", "/channels/{channel_id}/messages", 200),
                playwrightGatewayCreatedEvent(messageSendBasic.id, "send-message"),
                playwrightGatewayFrameEvent(messageSendBasic.id, "send-message", "MESSAGE_CREATE"),
            ]
                .map((event) => JSON.stringify({ ...event, run_id: "stale-run" }))
                .join("\n") + "\n",
            "utf8",
        );
        const wrongPlaywrightRunIdentityReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(wrongPlaywrightRunIdentityReport.ok, false);
        assert.equal(
            wrongPlaywrightRunIdentityReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.playwright_events.run_id" && !check.ok),
            true,
        );
        await writeFile(
            join(featureDir, "playwright-events.ndjson"),
            [
                playwrightHttpRequestEvent(messageSendBasic.id, "send-message", "POST", "/channels/{channel_id}/messages"),
                playwrightHttpResponseEvent(messageSendBasic.id, "send-message", "POST", "/channels/{channel_id}/messages", 200),
                playwrightGatewayCreatedEvent(messageSendBasic.id, "send-message"),
                playwrightGatewayFrameEvent(messageSendBasic.id, "send-message", "MESSAGE_CREATE"),
            ]
                .map((event) => JSON.stringify(event))
                .join("\n") + "\n",
            "utf8",
        );

        await writeFile(
            join(featureDir, "playwright-events.ndjson"),
            [
                playwrightHttpRequestEvent(messageSendBasic.id, "send-message", "POST", "/channels/{channel_id}/messages"),
                playwrightHttpResponseEvent(messageSendBasic.id, "send-message", "POST", "/channels/{channel_id}/messages", 200),
                playwrightGatewayCreatedEvent(messageSendBasic.id, "send-message"),
                playwrightGatewayFrameEvent(messageSendBasic.id, "send-message", "MESSAGE_CREATE"),
            ]
                .map((event) => JSON.stringify({ ...event, feature_id: "message.edit.basic" }))
                .join("\n") + "\n",
            "utf8",
        );
        const wrongPlaywrightFeatureIdentityReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(wrongPlaywrightFeatureIdentityReport.ok, false);
        assert.equal(
            wrongPlaywrightFeatureIdentityReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.playwright_events.feature_id" && !check.ok),
            true,
        );
        await writeFile(
            join(featureDir, "playwright-events.ndjson"),
            [
                playwrightHttpRequestEvent(messageSendBasic.id, "send-message", "POST", "/channels/{channel_id}/messages"),
                playwrightHttpResponseEvent(messageSendBasic.id, "send-message", "POST", "/channels/{channel_id}/messages", 200),
                playwrightGatewayCreatedEvent(messageSendBasic.id, "send-message"),
                playwrightGatewayFrameEvent(messageSendBasic.id, "send-message", "MESSAGE_CREATE"),
            ]
                .map((event) => JSON.stringify(event))
                .join("\n") + "\n",
            "utf8",
        );

        await writeFile(
            join(featureDir, "playwright-events.ndjson"),
            [
                playwrightHttpResponseEvent(messageSendBasic.id, "send-message", "POST", "/channels/{channel_id}/messages", 200),
                playwrightGatewayCreatedEvent(messageSendBasic.id, "send-message"),
                playwrightGatewayFrameEvent(messageSendBasic.id, "send-message", "MESSAGE_CREATE"),
            ]
                .map((event) => JSON.stringify(event))
                .join("\n") + "\n",
            "utf8",
        );
        const orphanPlaywrightResponseReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(orphanPlaywrightResponseReport.ok, false);
        assert.equal(
            orphanPlaywrightResponseReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.playwright_events.http_lifecycle" && !check.ok),
            true,
        );

        await writeFile(
            join(featureDir, "playwright-events.ndjson"),
            [
                playwrightHttpRequestEvent(messageSendBasic.id, "send-message", "POST", "/channels/{channel_id}/messages"),
                playwrightHttpResponseEvent(messageSendBasic.id, "send-message", "POST", "/channels/{channel_id}/messages", 200),
                playwrightGatewayFrameEvent(messageSendBasic.id, "send-message", "MESSAGE_CREATE"),
            ]
                .map((event) => JSON.stringify(event))
                .join("\n") + "\n",
            "utf8",
        );
        const orphanPlaywrightWebSocketReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(orphanPlaywrightWebSocketReport.ok, false);
        assert.equal(
            orphanPlaywrightWebSocketReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.playwright_events.websocket_lifecycle" && !check.ok),
            true,
        );
        await writeFile(
            join(featureDir, "playwright-events.ndjson"),
            [
                playwrightHttpRequestEvent(messageSendBasic.id, "send-message", "POST", "/channels/{channel_id}/messages"),
                playwrightHttpResponseEvent(messageSendBasic.id, "send-message", "POST", "/channels/{channel_id}/messages", 200),
                playwrightGatewayCreatedEvent(messageSendBasic.id, "send-message"),
                playwrightGatewayFrameEvent(messageSendBasic.id, "send-message", "MESSAGE_CREATE"),
            ]
                .map((event) => JSON.stringify(event))
                .join("\n") + "\n",
            "utf8",
        );

        await writeFile(
            join(featureDir, "mitmproxy.redacted.ndjson"),
            `${events
                .filter((event) => event.kind === "http.request" || event.kind === "http.response" || event.kind === "ws.created" || event.kind === "ws.frame.received")
                .map((event) => JSON.stringify({ ...event, run_id: "stale-run" }))
                .join("\n")}\n`,
            "utf8",
        );
        const wrongMitmproxyRunIdentityReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(wrongMitmproxyRunIdentityReport.ok, false);
        assert.equal(
            wrongMitmproxyRunIdentityReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.mitmproxy_events.run_id" && !check.ok),
            true,
        );
        await writeFile(
            join(featureDir, "mitmproxy.redacted.ndjson"),
            `${events
                .filter((event) => event.kind === "http.request" || event.kind === "http.response" || event.kind === "ws.created" || event.kind === "ws.frame.received")
                .map((event) => JSON.stringify(event))
                .join("\n")}\n`,
            "utf8",
        );

        await writeFile(
            join(featureDir, "mitmproxy.redacted.ndjson"),
            `${events
                .filter((event) => event.kind === "http.request" || event.kind === "http.response" || event.kind === "ws.created" || event.kind === "ws.frame.received")
                .map((event) => JSON.stringify({ ...event, feature_id: "message.edit.basic" }))
                .join("\n")}\n`,
            "utf8",
        );
        const wrongMitmproxyFeatureIdentityReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(wrongMitmproxyFeatureIdentityReport.ok, false);
        assert.equal(
            wrongMitmproxyFeatureIdentityReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.mitmproxy_events.feature_id" && !check.ok),
            true,
        );
        await writeFile(
            join(featureDir, "mitmproxy.redacted.ndjson"),
            `${events
                .filter((event) => event.kind === "http.request" || event.kind === "http.response" || event.kind === "ws.created" || event.kind === "ws.frame.received")
                .map((event) => JSON.stringify(event))
                .join("\n")}\n`,
            "utf8",
        );

        await writeFile(
            join(featureDir, "mitmproxy.redacted.ndjson"),
            `${events
                .filter((event) => event.kind === "http.response" || event.kind === "ws.created" || event.kind === "ws.frame.received")
                .map((event) => JSON.stringify(event))
                .join("\n")}\n`,
            "utf8",
        );
        const orphanMitmproxyResponseReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(orphanMitmproxyResponseReport.ok, false);
        assert.equal(
            orphanMitmproxyResponseReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.mitmproxy_events.http_lifecycle" && !check.ok),
            true,
        );

        await writeFile(
            join(featureDir, "mitmproxy.redacted.ndjson"),
            `${events
                .filter((event) => event.kind === "http.request" || event.kind === "http.response" || event.kind === "ws.frame.received")
                .map((event) => JSON.stringify(event))
                .join("\n")}\n`,
            "utf8",
        );
        const orphanMitmproxyWebSocketReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(orphanMitmproxyWebSocketReport.ok, false);
        assert.equal(
            orphanMitmproxyWebSocketReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.mitmproxy_events.websocket_lifecycle" && !check.ok),
            true,
        );
        await writeFile(
            join(featureDir, "mitmproxy.redacted.ndjson"),
            `${events
                .filter((event) => event.kind === "http.request" || event.kind === "http.response" || event.kind === "ws.created" || event.kind === "ws.frame.received")
                .map((event) => JSON.stringify(event))
                .join("\n")}\n`,
            "utf8",
        );

        await writeFile(
            join(featureDir, "mitmproxy.redacted.ndjson"),
            `${mismatchedHttpPairEvents(
                events.filter((event) => event.kind === "http.request" || event.kind === "http.response" || event.kind === "ws.created" || event.kind === "ws.frame.received"),
            )
                .map((event) => JSON.stringify(event))
                .join("\n")}\n`,
            "utf8",
        );
        const mismatchedMitmproxyPairReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(mismatchedMitmproxyPairReport.ok, false);
        assert.equal(
            mismatchedMitmproxyPairReport.runtime.features[0].checks.some(
                (check) => check.id === "runtime.feature.mitmproxy_events.expected_http.POST./channels/{channel_id}/messages" && !check.ok,
            ),
            true,
        );
        await writeFile(
            join(featureDir, "mitmproxy.redacted.ndjson"),
            `${events
                .filter((event) => event.kind === "http.request" || event.kind === "http.response" || event.kind === "ws.created" || event.kind === "ws.frame.received")
                .map((event) => JSON.stringify(event))
                .join("\n")}\n`,
            "utf8",
        );

        await writeFile(join(featureDir, "summary.json"), JSON.stringify({ ...summary, run_id: "stale-run" }), "utf8");
        const wrongSummaryRunIdentityReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(wrongSummaryRunIdentityReport.ok, false);
        assert.equal(
            wrongSummaryRunIdentityReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.summary.identity" && !check.ok),
            true,
        );
        await writeFile(join(featureDir, "summary.json"), JSON.stringify(summary), "utf8");

        await writeFile(join(featureDir, "summary.json"), JSON.stringify([]), "utf8");
        const nonObjectSummaryJsonReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(nonObjectSummaryJsonReport.ok, false);
        assert.equal(
            nonObjectSummaryJsonReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.summary.parse" && check.ok),
            true,
        );
        assert.equal(
            nonObjectSummaryJsonReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.summary.shape" && !check.ok),
            true,
        );
        await writeFile(join(featureDir, "summary.json"), JSON.stringify(summary), "utf8");

        await writeFile(join(featureDir, "summary.json"), "{not json", "utf8");
        const malformedSummaryJsonReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(malformedSummaryJsonReport.ok, false);
        assert.equal(
            malformedSummaryJsonReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.summary.parse" && !check.ok),
            true,
        );
        await writeFile(join(featureDir, "summary.json"), JSON.stringify(summary), "utf8");

        await writeFile(
            join(featureDir, "run-artifacts.json"),
            JSON.stringify({
                status: "passed",
                preflight_path: "preflight.json",
                events_path: "events.ndjson",
                playwright_events_path: "playwright-events.ndjson",
                summary_path: "summary.json",
                markdown_path: "report.md",
                trace_path: "trace.zip",
                screenshots_dir: "screenshots",
                redacted_har_path: "network.redacted.har",
                video_path: "..\\private\\video.webm",
            } satisfies RuntimeRunArtifactManifest),
            "utf8",
        );
        const unsafePassedManifestReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(unsafePassedManifestReport.ok, false);
        assert.equal(
            unsafePassedManifestReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.run_artifacts.video_path.safe_path" && !check.ok),
            true,
        );
        await writeFile(
            join(featureDir, "run-artifacts.json"),
            JSON.stringify({
                status: "passed",
                preflight_path: "preflight.json",
                events_path: "events.ndjson",
                playwright_events_path: "playwright-events.ndjson",
                summary_path: "summary.json",
                markdown_path: "report.md",
                trace_path: "trace.zip",
                screenshots_dir: "screenshots",
                redacted_har_path: "network.redacted.har",
            } satisfies RuntimeRunArtifactManifest),
            "utf8",
        );

        await writeFile(
            join(featureDir, "run-artifacts.json"),
            JSON.stringify({
                status: "passed",
                preflight_path: "preflight.json",
                events_path: "events.ndjson",
                playwright_events_path: "playwright-events.ndjson",
                summary_path: "summary.json",
                markdown_path: "report.md",
                trace_path: "trace.zip",
                screenshots_dir: "screenshots",
                redacted_har_path: "network.redacted.har",
                video_path: "video.webm",
            } satisfies RuntimeRunArtifactManifest),
            "utf8",
        );
        const missingOptionalArtifactReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(missingOptionalArtifactReport.ok, false);
        assert.equal(
            missingOptionalArtifactReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.run_artifacts.video_path.exists" && !check.ok),
            true,
        );
        await writeFile(join(featureDir, "video.webm"), "video", "utf8");
        const referencedOptionalArtifactReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(referencedOptionalArtifactReport.ok, true);
        await rm(join(featureDir, "video.webm"), { force: true });
        await writeFile(
            join(featureDir, "run-artifacts.json"),
            JSON.stringify({
                status: "passed",
                preflight_path: "preflight.json",
                events_path: "events.ndjson",
                playwright_events_path: "playwright-events.ndjson",
                summary_path: "summary.json",
                markdown_path: "report.md",
                trace_path: "trace.zip",
                screenshots_dir: "screenshots",
                redacted_har_path: "network.redacted.har",
            } satisfies RuntimeRunArtifactManifest),
            "utf8",
        );

        await writeFile(
            join(featureDir, "summary.json"),
            JSON.stringify({
                ...summary,
                traffic: summary.traffic.map((item) => (item.type === "http" ? { ...item, attribution: undefined } : item)),
            }),
            "utf8",
        );
        const malformedSummaryReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(malformedSummaryReport.ok, false);
        assert.equal(
            malformedSummaryReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.summary.traffic_shape" && !check.ok),
            true,
        );

        await writeFile(
            join(featureDir, "summary.json"),
            JSON.stringify({
                ...summary,
                feature_id: "message.edit.basic",
                expected: { http: [], gateway: [] },
            }),
            "utf8",
        );
        const wrongSummaryIdentityReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(wrongSummaryIdentityReport.ok, false);
        assert.equal(
            wrongSummaryIdentityReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.summary.identity" && !check.ok),
            true,
        );
        assert.equal(
            wrongSummaryIdentityReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.expected.registry_metadata" && !check.ok),
            true,
        );
        await writeFile(join(featureDir, "summary.json"), JSON.stringify(summary), "utf8");

        await writeFile(
            join(featureDir, "playwright-events.ndjson"),
            `${JSON.stringify({ kind: "playwright.http.request", method: "POST", normalized_route: "/channels/{channel_id}/messages" })}\n`,
            "utf8",
        );
        const malformedEventReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(malformedEventReport.ok, false);
        assert.equal(
            malformedEventReport.runtime.features[0].checks.some(
                (check) => check.id === "runtime.feature.playwright_events.parse" && !check.ok && check.message?.includes("invalid event shape"),
            ),
            true,
        );
        await writeFile(
            join(featureDir, "events.ndjson"),
            `${events.map((event) => JSON.stringify(event.kind === "http.request" ? { ...event, cdp_request_id: undefined } : event)).join("\n")}\n`,
            "utf8",
        );
        const missingCdpRequestIdReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(missingCdpRequestIdReport.ok, false);
        assert.equal(
            missingCdpRequestIdReport.runtime.features[0].checks.some(
                (check) => check.id === "runtime.feature.events.parse" && !check.ok && check.message?.includes("cdp_request_id"),
            ),
            true,
        );
        await writeFile(
            join(featureDir, "events.ndjson"),
            `${events.map((event) => JSON.stringify(event.kind === "http.response" ? { ...event, cdp_request_id: undefined } : event)).join("\n")}\n`,
            "utf8",
        );
        const missingCdpResponseIdReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(missingCdpResponseIdReport.ok, false);
        assert.equal(
            missingCdpResponseIdReport.runtime.features[0].checks.some(
                (check) => check.id === "runtime.feature.events.parse" && !check.ok && check.message?.includes("cdp_request_id"),
            ),
            true,
        );
        await writeFile(
            join(featureDir, "events.ndjson"),
            `${events.map((event) => JSON.stringify(event.kind === "http.response" ? { ...event, kind: "http.failure", cdp_request_id: undefined, error_text: "failed" } : event)).join("\n")}\n`,
            "utf8",
        );
        const missingCdpFailureIdReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(missingCdpFailureIdReport.ok, false);
        assert.equal(
            missingCdpFailureIdReport.runtime.features[0].checks.some(
                (check) => check.id === "runtime.feature.events.parse" && !check.ok && check.message?.includes("cdp_request_id"),
            ),
            true,
        );
        await writeFile(join(featureDir, "events.ndjson"), `${events.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");

        await writeFile(
            join(featureDir, "playwright-events.ndjson"),
            [
                { ...playwrightHttpRequestEvent(messageSendBasic.id, "send-message", "POST", "/channels/{channel_id}/messages"), playwright_request_id: undefined },
                playwrightHttpResponseEvent(messageSendBasic.id, "send-message", "POST", "/channels/{channel_id}/messages", 200),
                playwrightGatewayCreatedEvent(messageSendBasic.id, "send-message"),
                playwrightGatewayFrameEvent(messageSendBasic.id, "send-message", "MESSAGE_CREATE"),
            ]
                .map((event) => JSON.stringify(event))
                .join("\n") + "\n",
            "utf8",
        );
        const missingPlaywrightRequestIdReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(missingPlaywrightRequestIdReport.ok, false);
        assert.equal(
            missingPlaywrightRequestIdReport.runtime.features[0].checks.some(
                (check) => check.id === "runtime.feature.playwright_events.parse" && !check.ok && check.message?.includes("playwright_request_id"),
            ),
            true,
        );
        await writeFile(
            join(featureDir, "playwright-events.ndjson"),
            [
                playwrightHttpRequestEvent(messageSendBasic.id, "send-message", "POST", "/channels/{channel_id}/messages"),
                { ...playwrightHttpResponseEvent(messageSendBasic.id, "send-message", "POST", "/channels/{channel_id}/messages", 200), playwright_request_id: undefined },
                playwrightGatewayCreatedEvent(messageSendBasic.id, "send-message"),
                playwrightGatewayFrameEvent(messageSendBasic.id, "send-message", "MESSAGE_CREATE"),
            ]
                .map((event) => JSON.stringify(event))
                .join("\n") + "\n",
            "utf8",
        );
        const missingPlaywrightResponseIdReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(missingPlaywrightResponseIdReport.ok, false);
        assert.equal(
            missingPlaywrightResponseIdReport.runtime.features[0].checks.some(
                (check) => check.id === "runtime.feature.playwright_events.parse" && !check.ok && check.message?.includes("playwright_request_id"),
            ),
            true,
        );
        await writeFile(
            join(featureDir, "mitmproxy.redacted.ndjson"),
            `${events
                .filter((event) => event.kind === "http.request" || event.kind === "http.response" || event.kind === "ws.created" || event.kind === "ws.frame.received")
                .map((event) => JSON.stringify(event.kind === "http.request" ? { ...event, cdp_request_id: undefined } : event))
                .join("\n")}\n`,
            "utf8",
        );
        const missingMitmproxyRequestIdReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(missingMitmproxyRequestIdReport.ok, false);
        assert.equal(
            missingMitmproxyRequestIdReport.runtime.features[0].checks.some(
                (check) => check.id === "runtime.feature.mitmproxy_events.parse" && !check.ok && check.message?.includes("cdp_request_id"),
            ),
            true,
        );
        await writeFile(
            join(featureDir, "mitmproxy.redacted.ndjson"),
            `${events
                .filter((event) => event.kind === "http.request" || event.kind === "http.response" || event.kind === "ws.created" || event.kind === "ws.frame.received")
                .map((event) => JSON.stringify(event))
                .join("\n")}\n`,
            "utf8",
        );
        await writeFile(
            join(featureDir, "playwright-events.ndjson"),
            [
                playwrightHttpRequestEvent(messageSendBasic.id, "send-message", "POST", "/channels/{channel_id}/messages"),
                playwrightHttpResponseEvent(messageSendBasic.id, "send-message", "POST", "/channels/{channel_id}/messages", 200),
                playwrightGatewayCreatedEvent(messageSendBasic.id, "send-message"),
                playwrightGatewayFrameEvent(messageSendBasic.id, "send-message", "MESSAGE_CREATE"),
            ]
                .map((event) => JSON.stringify(event))
                .join("\n") + "\n",
            "utf8",
        );
        await writeFile(
            join(featureDir, "events.ndjson"),
            `${events.map((event) => JSON.stringify(event.kind === "ui.action" ? { ...event, action: "not-a-real-action" } : event)).join("\n")}\n`,
            "utf8",
        );
        const malformedUiActionReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(malformedUiActionReport.ok, false);
        assert.equal(
            malformedUiActionReport.runtime.features[0].checks.some(
                (check) => check.id === "runtime.feature.events.parse" && !check.ok && check.message?.includes("line 2.action"),
            ),
            true,
        );
        await writeFile(join(featureDir, "events.ndjson"), `${events.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");

        const originalReportMarkdown = await readFile(join(featureDir, "report.md"), "utf8");
        await writeFile(join(featureDir, "report.md"), "", "utf8");
        const emptyReportMarkdown = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(emptyReportMarkdown.ok, false);
        assert.equal(
            emptyReportMarkdown.runtime.features[0].checks.some((check) => check.id === "runtime.feature.report.identity" && !check.ok),
            true,
        );

        await rm(join(featureDir, "report.md"), { force: true });
        await mkdir(join(featureDir, "report.md"));
        const unreadableReportMarkdown = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(unreadableReportMarkdown.ok, false);
        assert.equal(
            unreadableReportMarkdown.runtime.features[0].checks.some((check) => check.id === "runtime.feature.report.readable" && !check.ok),
            true,
        );
        await rm(join(featureDir, "report.md"), { recursive: true, force: true });
        await writeFile(join(featureDir, "report.md"), originalReportMarkdown, "utf8");

        await writeFile(join(featureDir, "report.md"), originalReportMarkdown.replace("Run: run", "Run: run-stale"), "utf8");
        const wrongReportRunId = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(wrongReportRunId.ok, false);
        assert.equal(
            wrongReportRunId.runtime.features[0].checks.some((check) => check.id === "runtime.feature.report.run_id" && !check.ok),
            true,
        );

        await writeFile(join(featureDir, "report.md"), originalReportMarkdown.replace("Scenario: message.send.basic", "Scenario: message.send.basic.stale"), "utf8");
        const wrongReportScenario = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(wrongReportScenario.ok, false);
        assert.equal(
            wrongReportScenario.runtime.features[0].checks.some((check) => check.id === "runtime.feature.report.identity" && !check.ok),
            true,
        );

        await writeFile(
            join(featureDir, "report.md"),
            "# Feature: Send a plain text message\n\nRun: run\nScenario: message.send.basic\n\n## Step: Send plain message (send-message)\n\nActions:\n\n- fill / role:textbox / value redacted\n",
            "utf8",
        );
        const incompleteReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(incompleteReport.ok, false);
        assert.equal(
            incompleteReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.report.http.POST_channels_channel_id_messages" && !check.ok),
            true,
        );
        await writeFile(
            join(featureDir, "report.md"),
            [
                "# Feature: Send a plain text message",
                "",
                "Run: run",
                "Scenario: message.send.basic",
                "",
                "## Step: Send plain message (send-message)",
                "",
                "Actions:",
                "",
                "- fill / role:textbox / value redacted",
                "",
                "## Step: unrelated-step",
                "",
                "HTTP:",
                "",
                "- direct: POST /channels/{channel_id}/messages",
                "",
            ].join("\n"),
            "utf8",
        );
        const wrongStepReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(wrongStepReport.ok, false);
        assert.equal(
            wrongStepReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.report.http.POST_channels_channel_id_messages" && !check.ok),
            true,
        );
        await writeFile(
            join(featureDir, "report.md"),
            [
                "# Feature: Send a plain text message",
                "",
                "Run: run",
                "Scenario: message.send.basic",
                "",
                "## Step: send-message-extra",
                "",
                "Actions:",
                "",
                "- fill / role:textbox / value redacted",
                "",
                "HTTP:",
                "",
                "- direct: POST /channels/{channel_id}/messages",
                "",
                "Gateway:",
                "",
                "- direct received: MESSAGE_CREATE",
                "",
            ].join("\n"),
            "utf8",
        );
        const prefixStepReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(prefixStepReport.ok, false);
        assert.equal(
            prefixStepReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.report.step.send_message" && !check.ok),
            true,
        );
        assert.equal(
            prefixStepReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.report.http.POST_channels_channel_id_messages" && !check.ok),
            true,
        );
        assert.equal(
            prefixStepReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.report.gateway.MESSAGE_CREATE" && !check.ok),
            true,
        );
        await writeFile(
            join(featureDir, "report.md"),
            [
                "# Feature: Send a plain text message",
                "",
                "Run: run",
                "Scenario: message.send.basic",
                "",
                "## Step: send-message-extra",
                "",
                "HTTP:",
                "",
                "- direct: POST /channels/{channel_id}/messages",
                "",
                "Gateway:",
                "",
                "- direct received: MESSAGE_CREATE",
                "",
                "## Step: Send plain message (send-message)",
                "",
                "Actions:",
                "",
                "- fill / role:textbox / value redacted",
                "",
            ].join("\n"),
            "utf8",
        );
        const prefixBeforeExactReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(prefixBeforeExactReport.ok, false);
        assert.equal(
            prefixBeforeExactReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.report.step.send_message" && check.ok),
            true,
        );
        assert.equal(
            prefixBeforeExactReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.report.http.POST_channels_channel_id_messages" && !check.ok),
            true,
        );
        await writeFile(join(featureDir, "report.md"), originalReportMarkdown, "utf8");

        await writeFile(join(featureDir, "summary.json"), JSON.stringify({ ...summary, expected: { http: [], gateway: [] } }), "utf8");
        const weakenedExpectedReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(weakenedExpectedReport.ok, false);
        assert.equal(
            weakenedExpectedReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.expected.registry_metadata" && !check.ok),
            true,
        );

        await writeFile(
            join(featureDir, "summary.json"),
            JSON.stringify({
                ...summary,
                traffic: summary.traffic.map((item) => (item.type === "http" ? { ...item, status_codes: undefined } : item)),
            }),
            "utf8",
        );
        const requestOnlyReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(requestOnlyReport.ok, false);
        assert.equal(
            requestOnlyReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.expected.http.POST./channels/{channel_id}/messages" && !check.ok),
            true,
        );
        await writeFile(join(featureDir, "summary.json"), JSON.stringify(summary), "utf8");

        await writeFile(
            join(featureDir, "events.ndjson"),
            `${events
                .filter((event) => event.kind !== "http.response")
                .map((event) => JSON.stringify(event))
                .join("\n")}\n`,
            "utf8",
        );
        const missingCdpResponseReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(missingCdpResponseReport.ok, false);
        assert.equal(
            missingCdpResponseReport.runtime.features[0].checks.some(
                (check) => check.id === "runtime.feature.events.expected_http.POST./channels/{channel_id}/messages" && !check.ok,
            ),
            true,
        );
        await writeFile(join(featureDir, "events.ndjson"), `${events.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");

        await writeFile(
            join(featureDir, "playwright-events.ndjson"),
            [
                playwrightHttpRequestEvent(messageSendBasic.id, "send-message", "POST", "/wrong"),
                playwrightHttpResponseEvent(messageSendBasic.id, "send-message", "POST", "/wrong", 200),
                playwrightGatewayCreatedEvent(messageSendBasic.id, "send-message"),
                playwrightGatewayFrameEvent(messageSendBasic.id, "send-message", "MESSAGE_CREATE"),
            ]
                .map((event) => JSON.stringify(event))
                .join("\n") + "\n",
            "utf8",
        );
        const mismatchedPlaywrightReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(mismatchedPlaywrightReport.ok, false);
        assert.equal(
            mismatchedPlaywrightReport.runtime.features[0].checks.some(
                (check) => check.id === "runtime.feature.playwright_events.expected_http.POST./channels/{channel_id}/messages" && !check.ok,
            ),
            true,
        );
        const mismatchedPlaywrightRequestIdEvents = [
            playwrightHttpRequestEvent(messageSendBasic.id, "send-message", "POST", "/channels/{channel_id}/messages"),
            {
                ...playwrightHttpResponseEvent(messageSendBasic.id, "send-message", "POST", "/channels/{channel_id}/messages", 200),
                playwright_request_id: "wrong-playwright-request",
            },
            playwrightGatewayCreatedEvent(messageSendBasic.id, "send-message"),
            playwrightGatewayFrameEvent(messageSendBasic.id, "send-message", "MESSAGE_CREATE"),
        ];
        await writeFile(join(featureDir, "playwright-events.ndjson"), `${mismatchedPlaywrightRequestIdEvents.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");
        const mismatchedPlaywrightRequestIdReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(mismatchedPlaywrightRequestIdReport.ok, false);
        assert.equal(
            mismatchedPlaywrightRequestIdReport.runtime.features[0].checks.some(
                (check) => check.id === "runtime.feature.playwright_events.expected_http.POST./channels/{channel_id}/messages" && !check.ok,
            ),
            true,
        );
        await writeFile(
            join(featureDir, "playwright-events.ndjson"),
            [
                playwrightHttpRequestEvent(messageSendBasic.id, "send-message", "POST", "/channels/{channel_id}/messages"),
                playwrightHttpResponseEvent(messageSendBasic.id, "send-message", "POST", "/channels/{channel_id}/messages", 200),
                playwrightGatewayCreatedEvent(messageSendBasic.id, "send-message"),
                playwrightGatewayFrameEvent(messageSendBasic.id, "send-message", "MESSAGE_CREATE"),
            ]
                .map((event) => JSON.stringify(event))
                .join("\n") + "\n",
            "utf8",
        );

        await writeFile(join(featureDir, "trace.zip"), "trace", "utf8");
        const invalidTraceReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(invalidTraceReport.ok, false);
        assert.equal(
            invalidTraceReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.trace_zip" && !check.ok),
            true,
        );
        await writeFile(join(featureDir, "trace.zip"), zipHeader);

        await writeFile(join(featureDir, "screenshots", "001-send-message-start.png"), "png", "utf8");
        const invalidScreenshotReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(invalidScreenshotReport.ok, false);
        assert.equal(
            invalidScreenshotReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.screenshot_png.001_send_message_start_png" && !check.ok),
            true,
        );
        await writeFile(join(featureDir, "screenshots", "001-send-message-start.png"), pngHeader);

        await rm(join(featureDir, "screenshots", "001-send-message-start.png"), { force: true });
        await rm(join(featureDir, "screenshots", "002-send-message-end.png"), { force: true });
        await writeFile(join(featureDir, "screenshots", "001-stale-step-start.png"), pngHeader);
        await writeFile(join(featureDir, "screenshots", "002-stale-step-end.png"), pngHeader);
        const staleScreenshotReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(staleScreenshotReport.ok, false);
        assert.equal(
            staleScreenshotReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.screenshots.step_boundaries" && !check.ok),
            true,
        );
        await rm(join(featureDir, "screenshots", "001-stale-step-start.png"), { force: true });
        await rm(join(featureDir, "screenshots", "002-stale-step-end.png"), { force: true });
        await writeFile(join(featureDir, "screenshots", "001-send-message-start.png"), pngHeader);
        await writeFile(join(featureDir, "screenshots", "002-send-message-end.png"), pngHeader);

        await writeFile(
            join(featureDir, "network.redacted.har"),
            JSON.stringify({
                log: {
                    entries: [
                        {
                            request: { method: "POST", url: "https://{api_host}/api/v9/wrong", headers: [], cookies: [], queryString: [] },
                            response: { status: 200, headers: [], cookies: [], content: {} },
                        },
                    ],
                },
            }),
            "utf8",
        );
        const mismatchedHarReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(mismatchedHarReport.ok, false);
        assert.equal(
            mismatchedHarReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.har.expected_http.POST./channels/{channel_id}/messages" && !check.ok),
            true,
        );

        await writeFile(join(featureDir, "network.redacted.har"), "{not json", "utf8");
        const invalidHarReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(invalidHarReport.ok, false);
        assert.equal(
            invalidHarReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.har.parse" && !check.ok),
            true,
        );
        await writeFile(
            join(featureDir, "network.redacted.har"),
            JSON.stringify({
                log: {
                    entries: [
                        {
                            request: {
                                method: "POST",
                                url: "https://{api_host}/api/v9/channels/{channel_id}/messages",
                                headers: [],
                                cookies: [],
                                queryString: [],
                                postData: { text: "{redacted_body}", params: [] },
                            },
                            response: {
                                status: 200,
                                headers: [],
                                cookies: [],
                                content: { text: "{redacted_body}" },
                            },
                        },
                    ],
                },
            }),
            "utf8",
        );

        await writeFile(join(featureDir, "network.har"), JSON.stringify({ log: { entries: [] } }), "utf8");
        const rawHarReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(rawHarReport.ok, false);
        assert.equal(
            rawHarReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.network_har_absent" && !check.ok),
            true,
        );

        await rm(join(featureDir, "network.har"), { force: true });
        await writeFile(join(featureDir, "debug.har"), JSON.stringify({ log: { entries: [] } }), "utf8");
        const unexpectedHarReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(unexpectedHarReport.ok, false);
        assert.equal(
            unexpectedHarReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.unexpected_har.debug_har" && !check.ok),
            true,
        );

        await rm(join(featureDir, "debug.har"), { force: true });
        await writeFile(
            join(featureDir, "storage-state.json"),
            JSON.stringify({
                cookies: [{ name: "locale", value: "en-US", domain: ".discord.com", expires: 1_800_000_000 }],
                origins: [{ origin: "https://canary.discord.com", localStorage: [{ name: "theme", value: "dark" }] }],
            }),
            "utf8",
        );
        const storageStateReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageSendBasic.id],
        });
        assert.equal(storageStateReport.ok, false);
        assert.equal(storageStateReport.redaction.ok, false);
        assert.equal(
            storageStateReport.redaction.violations.some((violation) => violation.file.endsWith("storage-state.json")),
            true,
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("audits HTTP-only runtime features against declared expectations", async () => {
    const root = await mkdtemp(join(tmpdir(), "are-run-audit-http-only-"));
    try {
        await writeMinimalStaticRun(root);
        const featureDir = join(root, "features", messageAck.id);
        await mkdir(join(featureDir, "screenshots"), { recursive: true });
        const events: CaptureEvent[] = [
            {
                run_id: "run",
                feature_id: messageAck.id,
                step_id: "ack-message",
                ts_monotonic_ms: 1,
                kind: "step.start",
                title: "Mark channel read",
            },
            {
                run_id: "run",
                feature_id: messageAck.id,
                step_id: "ack-message",
                ts_monotonic_ms: 1.5,
                kind: "ui.action",
                action: "click",
                target: "role:menuitem",
                detail: "options:name",
            },
            {
                run_id: "run",
                feature_id: messageAck.id,
                step_id: "ack-message",
                ts_monotonic_ms: 2,
                kind: "http.request",
                cdp_request_id: "message-ack-request",
                method: "POST",
                url: "https://discord.com/api/v9/channels/{channel_id}/messages/{message_id}/ack",
                normalized_route: "/channels/{channel_id}/messages/{message_id}/ack",
                headers_redacted: true,
                request_body_shape_hash: "sha256:request",
            },
            {
                run_id: "run",
                feature_id: messageAck.id,
                step_id: "ack-message",
                ts_monotonic_ms: 3,
                kind: "http.response",
                cdp_request_id: "message-ack-request",
                method: "POST",
                url: "https://discord.com/api/v9/channels/{channel_id}/messages/{message_id}/ack",
                normalized_route: "/channels/{channel_id}/messages/{message_id}/ack",
                status: 204,
                headers_redacted: true,
                response_body_shape_hash: "sha256:response",
            },
            {
                run_id: "run",
                feature_id: messageAck.id,
                step_id: "ack-message",
                ts_monotonic_ms: 4,
                kind: "step.end",
                title: "Mark channel read",
            },
        ];
        const summary: FeatureSummary = {
            run_id: "run",
            feature_id: messageAck.id,
            title: messageAck.title,
            expected: messageAck.expected,
            steps: [
                {
                    step_id: "ack-message",
                    title: "Mark channel read",
                    started_at_ms: 1,
                    ended_at_ms: 4,
                    actions: [
                        {
                            action: "click",
                            target: "role:menuitem",
                            detail: "options:name",
                            occurred_at_ms: 1.5,
                        },
                    ],
                },
            ],
            traffic: [
                {
                    type: "http",
                    step_id: "ack-message",
                    method: "POST",
                    route: "POST /channels/{channel_id}/messages/{message_id}/ack",
                    status_codes: [204],
                    request_shape: "sha256:request",
                    response_shape: "sha256:response",
                    attribution: "direct",
                },
            ],
            unknown_events: 0,
            background_events: 0,
            generated_at: "2026-05-07T00:00:00.000Z",
        };

        await writeFile(join(featureDir, "preflight.json"), JSON.stringify(validRuntimePreflightReport(messageAck.id)), "utf8");
        await writeFile(join(featureDir, "events.ndjson"), `${events.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");
        await writeFile(
            join(featureDir, "playwright-events.ndjson"),
            [
                playwrightHttpRequestEvent(messageAck.id, "ack-message", "POST", "/channels/{channel_id}/messages/{message_id}/ack"),
                playwrightHttpResponseEvent(messageAck.id, "ack-message", "POST", "/channels/{channel_id}/messages/{message_id}/ack", 204),
            ]
                .map((event) => JSON.stringify(event))
                .join("\n") + "\n",
            "utf8",
        );
        await writeFile(join(featureDir, "summary.json"), JSON.stringify(summary), "utf8");
        await writeFile(
            join(featureDir, "report.md"),
            [
                "# Feature: Mark channel read after an unread message boundary",
                "",
                "Run: run",
                `Scenario: ${messageAck.id}`,
                "",
                "## Step: Mark channel read (ack-message)",
                "",
                "Actions:",
                "",
                "- click / role:menuitem / options:name",
                "",
                "HTTP:",
                "",
                "- direct: POST /channels/{channel_id}/messages/{message_id}/ack",
                "",
            ].join("\n"),
            "utf8",
        );
        await writeFile(
            join(featureDir, "run-artifacts.json"),
            JSON.stringify({
                status: "passed",
                preflight_path: "preflight.json",
                events_path: "events.ndjson",
                playwright_events_path: "playwright-events.ndjson",
                summary_path: "summary.json",
                markdown_path: "report.md",
                trace_path: "trace.zip",
                screenshots_dir: "screenshots",
                redacted_har_path: "network.redacted.har",
            }),
            "utf8",
        );
        await writeFile(join(featureDir, "trace.zip"), zipHeader);
        await writeFile(join(featureDir, "screenshots", "001-ack-message-start.png"), pngHeader);
        await writeFile(join(featureDir, "screenshots", "002-ack-message-end.png"), pngHeader);
        await writeFile(
            join(featureDir, "network.redacted.har"),
            JSON.stringify({
                log: {
                    entries: [
                        {
                            request: {
                                method: "POST",
                                url: "https://{api_host}/api/v9/channels/{channel_id}/messages/{message_id}/ack",
                                headers: [],
                                cookies: [],
                                queryString: [],
                                postData: { text: "{redacted_body}", params: [] },
                            },
                            response: {
                                status: 204,
                                headers: [],
                                cookies: [],
                                content: { text: "{redacted_body}" },
                            },
                        },
                    ],
                },
            }),
            "utf8",
        );
        await writeFile(join(root, "redaction-audit.json"), JSON.stringify({ ok: true, violations: [] }), "utf8");

        const report = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [messageAck.id],
        });

        assert.equal(report.ok, true);
        assert.equal(report.runtime.features[0].http_traffic_count, 1);
        assert.equal(report.runtime.features[0].gateway_traffic_count, 0);
        assert.equal(
            report.runtime.features[0].checks.some((check) => check.id === "runtime.feature.summary.gateway" && check.ok),
            true,
        );
        assert.equal(report.violations.length, 0);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("audits custom runtime feature expectations from summary metadata", async () => {
    const root = await mkdtemp(join(tmpdir(), "are-run-audit-custom-summary-"));
    try {
        await writeMinimalStaticRun(root);
        const featureId = "custom.http.only";
        const featureDir = join(root, "features", featureId);
        await mkdir(join(featureDir, "screenshots"), { recursive: true });
        const events: CaptureEvent[] = [
            {
                run_id: "run",
                feature_id: featureId,
                step_id: "custom-step",
                ts_monotonic_ms: 1,
                kind: "step.start",
                title: "Custom step",
            },
            {
                run_id: "run",
                feature_id: featureId,
                step_id: "custom-step",
                ts_monotonic_ms: 1.5,
                kind: "ui.action",
                action: "click",
                target: "role:button",
            },
            {
                run_id: "run",
                feature_id: featureId,
                step_id: "custom-step",
                ts_monotonic_ms: 2,
                kind: "http.request",
                cdp_request_id: "custom-observed-request",
                method: "POST",
                url: "https://discord.com/api/v9/custom/observed",
                normalized_route: "/custom/observed",
                headers_redacted: true,
            },
            {
                run_id: "run",
                feature_id: featureId,
                step_id: "custom-step",
                ts_monotonic_ms: 3,
                kind: "http.response",
                cdp_request_id: "custom-observed-request",
                method: "POST",
                url: "https://discord.com/api/v9/custom/observed",
                normalized_route: "/custom/observed",
                status: 200,
                headers_redacted: true,
            },
            {
                run_id: "run",
                feature_id: featureId,
                step_id: "custom-step",
                ts_monotonic_ms: 4,
                kind: "step.end",
                title: "Custom step",
            },
        ];
        const summary: FeatureSummary = {
            run_id: "run",
            feature_id: featureId,
            title: "Custom HTTP-only feature",
            expected: {
                http: [{ method: "POST", route: "/custom/observed", step_id: "custom-step" }],
            },
            steps: [
                {
                    step_id: "custom-step",
                    title: "Custom step",
                    started_at_ms: 1,
                    ended_at_ms: 4,
                    actions: [{ action: "click", target: "role:button", occurred_at_ms: 1.5 }],
                },
            ],
            traffic: [
                {
                    type: "http",
                    step_id: "custom-step",
                    method: "POST",
                    route: "POST /custom/observed",
                    status_codes: [200],
                    attribution: "direct",
                },
            ],
            unknown_events: 0,
            background_events: 0,
            generated_at: "2026-05-07T00:00:00.000Z",
        };

        await writeFile(join(featureDir, "preflight.json"), JSON.stringify(validRuntimePreflightReport(featureId)), "utf8");
        await writeFile(join(featureDir, "events.ndjson"), `${events.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");
        await writeFile(
            join(featureDir, "playwright-events.ndjson"),
            [
                playwrightHttpRequestEvent(featureId, "custom-step", "POST", "/custom/observed"),
                playwrightHttpResponseEvent(featureId, "custom-step", "POST", "/custom/observed", 200),
            ]
                .map((event) => JSON.stringify(event))
                .join("\n") + "\n",
            "utf8",
        );
        await writeFile(join(featureDir, "summary.json"), JSON.stringify(summary), "utf8");
        await writeFile(
            join(featureDir, "report.md"),
            [
                "# Feature: Custom HTTP-only feature",
                "",
                "Run: run",
                `Scenario: ${featureId}`,
                "",
                "## Step: Custom step (custom-step)",
                "",
                "Actions:",
                "",
                "- click / role:button",
                "",
                "HTTP:",
                "",
                "- direct: POST /custom/observed",
                "",
            ].join("\n"),
            "utf8",
        );
        await writeFile(
            join(featureDir, "run-artifacts.json"),
            JSON.stringify({
                status: "passed",
                preflight_path: "preflight.json",
                events_path: "events.ndjson",
                playwright_events_path: "playwright-events.ndjson",
                summary_path: "summary.json",
                markdown_path: "report.md",
                trace_path: "trace.zip",
                screenshots_dir: "screenshots",
                redacted_har_path: "network.redacted.har",
            }),
            "utf8",
        );
        await writeFile(join(featureDir, "trace.zip"), zipHeader);
        await writeFile(join(featureDir, "screenshots", "001-custom-step-start.png"), pngHeader);
        await writeFile(join(featureDir, "screenshots", "002-custom-step-end.png"), pngHeader);
        await writeFile(
            join(featureDir, "network.redacted.har"),
            JSON.stringify({
                log: {
                    entries: [
                        {
                            request: {
                                method: "POST",
                                url: "https://{api_host}/api/v9/custom/observed",
                                headers: [],
                                cookies: [],
                                queryString: [],
                                postData: { text: "{redacted_body}", params: [] },
                            },
                            response: { status: 200, headers: [], cookies: [], content: { text: "{redacted_body}" } },
                        },
                    ],
                },
            }),
            "utf8",
        );
        await writeFile(join(root, "redaction-audit.json"), JSON.stringify({ ok: true, violations: [] }), "utf8");

        const report = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [featureId],
        });

        assert.equal(report.ok, true);
        assert.equal(
            report.runtime.features[0].checks.some((check) => check.id === "runtime.feature.events.websocket" && check.ok),
            true,
        );

        await writeFile(
            join(featureDir, "summary.json"),
            JSON.stringify({
                ...summary,
                expected: { http: [{ method: "POST", route: "/custom/missing", step_id: "custom-step" }] },
            }),
            "utf8",
        );
        const missingExpectedReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [featureId],
        });
        assert.equal(missingExpectedReport.ok, false);
        assert.equal(
            missingExpectedReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.expected.http.POST./custom/missing" && !check.ok),
            true,
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("audits quarantined failure artifacts as incomplete runtime evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "are-run-audit-failure-"));
    try {
        await writeMinimalStaticRun(root);
        const featureDir = join(root, "features", idleSession.id);
        await mkdir(featureDir, { recursive: true });
        await writeFile(
            join(featureDir, "failure.json"),
            JSON.stringify({
                run_id: "run",
                feature_id: idleSession.id,
                title: idleSession.title,
                stage: "runtime",
                failed_at: "2026-05-07T00:00:00.000Z",
                quarantine: true,
                redacted: true,
                error: {
                    name: "Error",
                    message: "scenario expectation failed",
                },
                artifacts: {
                    failure_path: "failure.json",
                },
            } satisfies RuntimeFailureArtifact),
            "utf8",
        );
        await writeFile(
            join(featureDir, "run-artifacts.json"),
            JSON.stringify({
                status: "failed",
                failure_path: "failure.json",
            } satisfies RuntimeRunArtifactManifest),
            "utf8",
        );
        await writeFile(join(root, "redaction-audit.json"), JSON.stringify({ ok: true, violations: [] }), "utf8");

        const report = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [idleSession.id],
        });

        assert.equal(report.ok, false);
        assert.equal(
            report.violations.some((violation) => violation.includes("runtime.feature.failure_absent")),
            true,
        );
        assert.equal(
            report.runtime.features[0].checks.some((check) => check.id === "runtime.feature.failure.redacted" && check.ok),
            true,
        );
        assert.equal(
            report.runtime.features[0].checks.some((check) => check.id === "runtime.feature.failure.artifacts.failure_path.safe_path" && check.ok),
            true,
        );

        await writeFile(join(featureDir, "failure.json"), "{not json", "utf8");
        const malformedFailureReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [idleSession.id],
        });
        assert.equal(malformedFailureReport.ok, false);
        assert.equal(
            malformedFailureReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.failure.parse" && !check.ok),
            true,
        );

        await writeFile(join(featureDir, "failure.json"), JSON.stringify([]), "utf8");
        const nonObjectFailureReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [idleSession.id],
        });
        assert.equal(nonObjectFailureReport.ok, false);
        assert.equal(
            nonObjectFailureReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.failure.shape" && !check.ok),
            true,
        );

        await writeFile(
            join(featureDir, "failure.json"),
            JSON.stringify({
                run_id: "run",
                feature_id: idleSession.id,
                title: idleSession.title,
                stage: "runtime",
                failed_at: "2026-05-07T00:00:00.000Z",
                quarantine: true,
                redacted: true,
                error: {
                    name: "Error",
                    message: "scenario expectation failed",
                },
                artifacts: {
                    failure_path: "..\\private\\failure.json",
                    events_path: "../private/events.ndjson",
                    raw_har_path: "../network.har",
                },
            }),
            "utf8",
        );
        await writeFile(
            join(featureDir, "run-artifacts.json"),
            JSON.stringify({
                status: "failed",
                failure_path: "C:\\private\\failure.json",
                events_path: "..\\private\\events.ndjson",
                debug_dir: "C:\\private",
            }),
            "utf8",
        );
        const unsafePathReport = await auditDataminingRun({
            runDir: root,
            requireRuntime: true,
            requiredFeatureIds: [idleSession.id],
        });
        assert.equal(
            unsafePathReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.failure.artifacts.failure_path.safe_path" && !check.ok),
            true,
        );
        assert.equal(
            unsafePathReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.failure.artifacts.events_path.safe_path" && !check.ok),
            true,
        );
        assert.equal(
            unsafePathReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.run_artifacts.failure_path.safe_path" && !check.ok),
            true,
        );
        assert.equal(
            unsafePathReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.run_artifacts.events_path.safe_path" && !check.ok),
            true,
        );
        assert.equal(
            unsafePathReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.failure.artifacts.raw_har_path.unknown_key" && !check.ok),
            true,
        );
        assert.equal(
            unsafePathReport.runtime.features[0].checks.some((check) => check.id === "runtime.feature.run_artifacts.debug_dir.unknown_key" && !check.ok),
            true,
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("writes redacted runtime failure artifacts for scenario errors", async () => {
    const root = await mkdtemp(join(tmpdir(), "are-runtime-failure-artifact-"));
    const cdp: CdpSessionLike = {
        on() {},
        async send() {
            return {};
        },
    };
    try {
        await assert.rejects(
            () =>
                runCapturedFeature({
                    runId: "run",
                    outputDir: root,
                    cdp,
                    feature: {
                        ...idleSession,
                        async run(ctx) {
                            await ctx.step("bootstrap", "Bootstrap", async () => {
                                throw new Error("failed for 123456789012345678 with mfa.abcdefghijklmnopqrstuvwxyz");
                            });
                        },
                    },
                }),
            /failed for/,
        );

        const failure = JSON.parse(await readFile(join(root, "features", idleSession.id, "failure.json"), "utf8")) as RuntimeFailureArtifact;
        assert.equal(failure.quarantine, true);
        assert.equal(failure.stage, "runtime");
        assert.equal(failure.artifacts.events_path, "events.ndjson");
        assert.equal(failure.artifacts.failure_path, "failure.json");
        assert.equal(JSON.stringify(failure).includes("123456789012345678"), false);
        assert.equal(JSON.stringify(failure).includes("mfa.abcdefghijklmnopqrstuvwxyz"), false);
        assert.equal(JSON.stringify(failure).includes(root), false);
        assert.equal(scanForSecrets(failure).ok, true);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("writes runtime artifact manifests with feature-local paths", async () => {
    const root = await mkdtemp(join(tmpdir(), "are-runtime-artifact-paths-"));
    try {
        const featureDir = join(root, "private@example.com", "features", idleSession.id);
        await mkdir(featureDir, { recursive: true });
        const failurePath = join(featureDir, "failure.json");
        const runArtifactsPath = join(featureDir, "run-artifacts.json");

        const failure = await writeRuntimeFailureArtifact(failurePath, {
            runId: "run",
            feature: idleSession,
            stage: "runtime",
            error: new Error("scenario failed"),
            artifacts: {
                preflight_path: "screenshots/..",
                events_path: join(featureDir, "events.ndjson"),
                playwright_events_path: "..\\private\\playwright-events.ndjson",
                summary_path: "../..",
                markdown_path: "C:\\private\\report.md",
                trace_path: join(featureDir, "..", "private", "trace.zip"),
                screenshots_dir: "screenshots\\step",
                video_path: join(featureDir, "video.webm"),
                redacted_har_path: join(featureDir, "network.redacted.har"),
                debug_dir: "C:\\private",
            } as RuntimeArtifactPaths & { debug_dir: string },
        });
        await writeRuntimeRunArtifacts(runArtifactsPath, {
            status: "failed",
            preflight_path: "a/..",
            events_path: join(featureDir, "events.ndjson"),
            summary_path: "..\\private\\summary.json",
            markdown_path: "C:\\private\\report.md",
            failure_path: failurePath,
            video_path: join(featureDir, "video.webm"),
            raw_har_path: "../network.har",
        } as RuntimeRunArtifactManifest & { raw_har_path: string });

        const manifest = JSON.parse(await readFile(runArtifactsPath, "utf8")) as RuntimeRunArtifactManifest;
        assert.equal(failure.error.message, "scenario failed");
        assert.equal(failure.error.message_redacted, undefined);
        assert.equal(failure.artifacts.preflight_path, "artifact");
        assert.equal(failure.artifacts.events_path, "events.ndjson");
        assert.equal(failure.artifacts.playwright_events_path, "playwright-events.ndjson");
        assert.equal(failure.artifacts.summary_path, "artifact");
        assert.equal(failure.artifacts.markdown_path, "report.md");
        assert.equal(failure.artifacts.trace_path, "trace.zip");
        assert.equal(failure.artifacts.screenshots_dir, "screenshots/step");
        assert.equal(failure.artifacts.failure_path, "failure.json");
        assert.equal(failure.artifacts.redacted_har_path, "network.redacted.har");
        assert.equal(manifest.preflight_path, "artifact");
        assert.equal(manifest.events_path, "events.ndjson");
        assert.equal(manifest.summary_path, "summary.json");
        assert.equal(manifest.markdown_path, "report.md");
        assert.equal(manifest.failure_path, "failure.json");
        assert.equal(manifest.video_path, "video.webm");
        assert.equal("debug_dir" in failure.artifacts, false);
        assert.equal("raw_har_path" in manifest, false);
        assert.equal(JSON.stringify(failure).includes("\\"), false);
        assert.equal(JSON.stringify(manifest).includes("\\"), false);
        assert.equal(JSON.stringify(failure).includes(root), false);
        assert.equal(JSON.stringify(manifest).includes(root), false);
        assert.equal(JSON.stringify(failure).includes("private@example.com"), false);
        assert.equal(JSON.stringify(manifest).includes("private@example.com"), false);
        assert.equal(scanForSecrets(failure).ok, true);
        assert.equal(scanForSecrets(manifest).ok, true);

        const relativeRunArtifactsPath = relative(process.cwd(), join(featureDir, "relative-run-artifacts.json"));
        await writeRuntimeRunArtifacts(relativeRunArtifactsPath, {
            status: "passed",
            events_path: relative(process.cwd(), join(featureDir, "events.ndjson")),
            summary_path: relative(process.cwd(), join(featureDir, "summary.json")),
        });
        const relativeManifest = JSON.parse(await readFile(join(featureDir, "relative-run-artifacts.json"), "utf8")) as RuntimeRunArtifactManifest;
        assert.equal(relativeManifest.events_path, "events.ndjson");
        assert.equal(relativeManifest.summary_path, "summary.json");
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("refuses destructive scenarios without disposable fixture markers", async () => {
    const root = await mkdtemp(join(tmpdir(), "are-disposable-gate-"));
    const cdp: CdpSessionLike = {
        on() {},
        async send() {
            return {};
        },
    };
    try {
        await assert.rejects(
            () =>
                runCapturedFeature({
                    runId: "run",
                    outputDir: root,
                    feature: messageDeleteBasic,
                    cdp,
                    fixtures: {
                        guild: "123456789012345678",
                        channels: { general: "223456789012345678" },
                        messages: { delete_target: "423456789012345678" },
                    },
                }),
            /fixture_not_disposable:messages\.delete_target/,
        );
        await assert.rejects(readFile(join(root, "features", messageDeleteBasic.id, "events.ndjson"), "utf8"));
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("recorder can fail fast on non-fixture route scope", async () => {
    class FakeCdp implements CdpSessionLike {
        handlers = new Map<string, (payload: Record<string, unknown>) => void>();

        on(event: string, handler: (payload: Record<string, unknown>) => void): void {
            this.handlers.set(event, handler);
        }

        async send(): Promise<unknown> {
            return {};
        }

        emit(event: string, payload: Record<string, unknown>): void {
            this.handlers.get(event)?.(payload);
        }
    }

    const cdp = new FakeCdp();
    const recorder = new CdpNetworkRecorder({
        cdp,
        runId: "run",
        feature: messageSendBasic,
        fixtures: { channels: { general: "123456789012345678" } },
        enforceFixtureScope: true,
        onEvent() {},
    });
    await recorder.start();
    cdp.emit("Network.requestWillBeSent", {
        requestId: "1",
        request: {
            method: "POST",
            url: "https://discord.com/api/v9/channels/999999999999999999/messages",
        },
    });

    await assert.rejects(recorder.flush(), /non-fixture IDs/);
});

test("recorder allows thread channel IDs created from fixture channels", async () => {
    class FakeCdp implements CdpSessionLike {
        handlers = new Map<string, (payload: Record<string, unknown>) => void>();

        on(event: string, handler: (payload: Record<string, unknown>) => void): void {
            this.handlers.set(event, handler);
        }

        async send(): Promise<unknown> {
            return {};
        }

        emit(event: string, payload: Record<string, unknown>): void {
            this.handlers.get(event)?.(payload);
        }
    }

    const cdp = new FakeCdp();
    const recorder = new CdpNetworkRecorder({
        cdp,
        runId: "run",
        feature: messageSendBasic,
        fixtures: { channels: { general: "123456789012345678" } },
        enforceFixtureScope: true,
        onEvent() {},
    });
    await recorder.start();
    cdp.emit("Network.requestWillBeSent", {
        requestId: "1",
        request: {
            method: "POST",
            url: "https://discord.com/api/v9/channels/123456789012345678/messages/923456789012345678/threads",
        },
    });
    cdp.emit("Network.requestWillBeSent", {
        requestId: "2",
        request: {
            method: "POST",
            url: "https://discord.com/api/v9/channels/923456789012345678/messages",
        },
    });

    await recorder.flush();
});

test("imports route catalog entries from OpenAPI", () => {
    const routes = importOpenApiRouteCatalog({
        paths: {
            "/channels/{channel_id}/messages": {
                post: {
                    operationId: "CREATE_MESSAGE",
                    requestBody: {
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/MessageCreate" },
                            },
                        },
                    },
                    responses: {
                        200: {
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/Message" },
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    assert.equal(routes.length, 1);
    assert.equal(routes[0].method, "POST");
    assert.equal(routes[0].route, "/channels/{channel_id}/messages");
    assert.equal(routes[0].route_name, "CREATE_MESSAGE");
    assert.equal(routes[0].request_schema_ref, "#/components/schemas/MessageCreate");
    assert.deepEqual(routes[0].response_schema_refs, ["#/components/schemas/Message"]);
});

test("persists static assets and discovered chunk references", async () => {
    const root = await mkdtemp(join(tmpdir(), "are-static-"));
    const responses = new Map<string, string>([
        ["https://canary.discord.com/login", '<html><script src="/assets/web.abc.js"></script><link rel="stylesheet" href="/assets/app.css"></html>'],
        ["https://canary.discord.com/assets/web.abc.js", '(()=>{const chunk="/assets/chunk.def.js";})();'],
        ["https://canary.discord.com/assets/app.css", "body{}"],
        ["https://canary.discord.com/assets/chunk.def.js", "export {};"],
    ]);
    const fetchImpl: typeof fetch = async (input) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const body = responses.get(url);
        if (typeof body === "undefined") {
            return new Response("missing", { status: 404 });
        }

        return new Response(body, {
            headers: {
                "content-type": url.endsWith(".css") ? "text/css" : "application/javascript",
                "x-build-id": "build-id",
            },
        });
    };

    try {
        const snapshot = await collectDiscordStaticSnapshot({
            runId: "run",
            channel: "canary",
            outputDir: root,
            downloadAssets: true,
            fetchImpl,
        });

        assert.equal(snapshot.build.x_build_id, "build-id");
        assert.equal(
            snapshot.assets.some((asset) => asset.url.endsWith("/chunk.def.js")),
            true,
        );
        assert.equal(
            snapshot.assets.every((asset) => asset.hash && asset.local_path),
            true,
        );
        assert.equal(snapshot.build.asset_hashes.length, 3);
        assert.equal((await readFile(join(root, "static", "login.html"), "utf8")).includes("web.abc.js"), true);
        const assetsJson = JSON.parse(await readFile(join(root, "static", "assets.json"), "utf8")) as typeof snapshot.assets;
        const assetFiles = await readdir(join(root, "static", "assets"));
        assert.equal(assetFiles.length, 3);
        for (const asset of assetsJson) {
            assert.equal(asset.local_path?.includes("\\"), false);
            assert.ok(asset.local_path);
            assert.equal(asset.local_hash, asset.hash);
            assert.equal(asset.local_bytes, asset.bytes);
            assert.equal(asset.local_redacted, false);
            await readFile(join(root, "static", asset.local_path));
        }
        const chunk = assetsJson.find((asset) => asset.url.endsWith("/chunk.def.js"));
        assert.equal(chunk?.discovered_from, "https://canary.discord.com/assets/web.abc.js");
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("persists discovered source maps as redacted durable artifacts", async () => {
    const root = await mkdtemp(join(tmpdir(), "are-static-sourcemap-"));
    const rawSourceMap = JSON.stringify({
        version: 3,
        sourceRoot: "webpack://private@example.com/Users/local-user/discord",
        sources: ["./src/private@example.com/123456789012345678/sendMessage.ts"],
        sourcesContent: ['export function sendMessage() { return "mfa.abcdefghijklmnopqrstuvwxyz private@example.com 123456789012345678"; }'],
        names: ["123456789012345678"],
        mappings: ";AAAAA",
    });
    const responses = new Map<string, string>([
        ["https://canary.discord.com/login", '<html><script src="/assets/web.js"></script></html>'],
        ["https://canary.discord.com/assets/web.js", "export {};\n//# sourceMappingURL=web.js.map"],
        ["https://canary.discord.com/assets/web.js.map", rawSourceMap],
    ]);
    const fetchImpl: typeof fetch = async (input) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const body = responses.get(url);
        if (typeof body === "undefined") {
            return new Response("missing", { status: 404 });
        }

        return new Response(body, {
            headers: { "content-type": url.endsWith(".map") ? "application/json" : "application/javascript" },
        });
    };

    try {
        const snapshot = await collectDiscordStaticSnapshot({
            runId: "run",
            channel: "canary",
            outputDir: root,
            downloadAssets: true,
            fetchImpl,
        });

        const sourceMapAsset = snapshot.assets.find((asset) => asset.url.endsWith("/web.js.map"));
        assert.ok(sourceMapAsset?.local_path);
        assert.equal(sourceMapAsset.bytes, new TextEncoder().encode(rawSourceMap).byteLength);
        assert.notEqual(sourceMapAsset.local_hash, sourceMapAsset.hash);
        assert.notEqual(sourceMapAsset.local_bytes, sourceMapAsset.bytes);
        assert.equal(sourceMapAsset.local_redacted, true);
        const durableMap = await readFile(join(root, "static", sourceMapAsset.local_path), "utf8");
        assert.equal(durableMap.includes("private@example.com"), false);
        assert.equal(durableMap.includes("123456789012345678"), false);
        assert.equal(durableMap.includes("mfa.abcdefghijklmnopqrstuvwxyz"), false);
        assert.equal(durableMap.includes("{email}"), true);
        assert.equal(durableMap.includes("{snowflake}"), true);
        assert.equal((await auditRedactionPaths([join(root, "static")])).ok, true);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("retains failed static asset fetches without local artifacts", async () => {
    const root = await mkdtemp(join(tmpdir(), "are-static-failed-"));
    const fetchImpl: typeof fetch = async (input) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        if (url.endsWith("/login")) {
            return new Response('<script src="/assets/missing.js"></script>');
        }

        return new Response("missing", { status: 404 });
    };

    try {
        const snapshot = await collectDiscordStaticSnapshot({
            runId: "run",
            channel: "canary",
            outputDir: root,
            downloadAssets: true,
            fetchImpl,
        });

        assert.equal(snapshot.assets.length, 1);
        assert.equal(snapshot.assets[0].hash, undefined);
        assert.equal(snapshot.assets[0].local_path, undefined);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("limits static asset traversal with maxAssets", async () => {
    const root = await mkdtemp(join(tmpdir(), "are-static-max-"));
    const fetchImpl: typeof fetch = async (input) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        if (url.endsWith("/login")) {
            return new Response('<script src="/assets/web.js"></script>');
        }
        if (url.endsWith("/assets/web.js")) {
            return new Response('const chunk="/assets/chunk.js";');
        }

        return new Response("export {};");
    };

    try {
        const snapshot = await collectDiscordStaticSnapshot({
            runId: "run",
            channel: "canary",
            outputDir: root,
            downloadAssets: true,
            maxAssets: 1,
            fetchImpl,
        });

        assert.equal(snapshot.assets.length, 1);
        assert.equal(
            snapshot.assets.some((asset) => asset.url.endsWith("/chunk.js")),
            false,
        );
        await assert.rejects(
            collectDiscordStaticSnapshot({
                runId: "run",
                channel: "canary",
                outputDir: root,
                downloadAssets: true,
                maxAssets: 0,
                fetchImpl,
            }),
            /maxAssets must be a positive integer/,
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("discovers quoted JS and CSS references from script text", () => {
    const refs = discoverAssetReferences(
        'const a="/assets/chunk.js";const b="style.css";const c="data:text/css,no";\n//# sourceMappingURL=web.js.map?hash=1',
        "https://canary.discord.com/assets/web.js",
    );

    assert.deepEqual(
        refs.map((ref) => [ref.kind, ref.url]),
        [
            ["script", "https://canary.discord.com/assets/chunk.js"],
            ["stylesheet", "https://canary.discord.com/assets/style.css"],
            ["other", "https://canary.discord.com/assets/web.js.map?hash=1"],
        ],
    );
});

test("decodes Source Map v3 mappings for generated line and column positions", () => {
    const sourceMap = decodeSourceMap({
        version: 3,
        file: "chunk.js",
        sourceRoot: "webpack://discord",
        sources: ["./src/messages/sendMessage.ts?cache=1"],
        sourcesContent: ["export async function sendMessage() {\n  return true;\n}"],
        names: ["sendMessage"],
        mappings: ";AAAAA",
    });

    assert.ok(sourceMap);
    assert.deepEqual(sourceMap.sourcesContent, ["export async function sendMessage() {\n  return true;\n}"]);
    assert.deepEqual(originalPositionFor(sourceMap, 1, 5), {
        source: "webpack://discord/src/messages/sendMessage.ts",
        source_index: 0,
        name: "sendMessage",
        generated_line: 1,
        generated_column: 0,
        original_line: 0,
        original_column: 0,
    });

    const unsafeSourceMap = decodeSourceMap({
        version: 3,
        file: "chunk.js",
        sourceRoot: "webpack://private@example.com/Users/local-user/discord",
        sources: ["./src/private@example.com/123456789012345678/sendMessage.ts?cache=1"],
        names: ["123456789012345678"],
        mappings: ";AAAAA",
    });
    assert.ok(unsafeSourceMap);
    assert.deepEqual(originalPositionFor(unsafeSourceMap, 1, 5), {
        source: "webpack://{email}/.../src/{email}/{snowflake}/sendMessage.ts",
        source_index: 0,
        name: "{snowflake}",
        generated_line: 1,
        generated_column: 0,
        original_line: 0,
        original_column: 0,
    });
});

test("recovers middleware-wrapped source routes missing from OpenAPI", async () => {
    const root = await mkdtemp(join(tmpdir(), "are-routes-"));
    try {
        const routeDir = join(root, "channels", "#channel_id", "messages");
        await mkdir(routeDir, { recursive: true });
        await writeFile(
            join(routeDir, "index.ts"),
            `router.post(
				"/",
				messageUpload.any(),
				route({
					requestBody: "MessageCreateSchema",
					responses: { 200: { body: "Message" } },
				}),
				async () => {},
			);`,
            "utf8",
        );

        const routes = await importExpressSourceRouteCatalog(root);
        assert.equal(routes.length, 1);
        assert.equal(routes[0].method, "POST");
        assert.equal(routes[0].route, "/channels/{channel_id}/messages");
        assert.equal(routes[0].request_schema_ref, "MessageCreateSchema");
        assert.deepEqual(routes[0].response_schema_refs, ["Message"]);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("imports gateway opcode and event catalogs from TypeScript source", () => {
    const catalog = importGatewayCatalogFromSources({
        constants: "export enum OPCODES { Dispatch = 0, Heartbeat = 1, Identify = 2 }",
        opcodeHandlers: "export default { 1: onHeartbeat, 2: onIdentify }",
        events: 'export enum EVENTEnum { MessageCreate = "MESSAGE_CREATE" }',
        schemasIndex: 'export * from "./IdentifySchema";',
    });

    assert.deepEqual(
        catalog.opcodes.map((opcode) => [opcode.opcode, opcode.name, opcode.direction]),
        [
            [0, "Dispatch", "received"],
            [1, "Heartbeat", "sent"],
            [2, "Identify", "sent"],
        ],
    );
    assert.equal(catalog.events[0].event, "MESSAGE_CREATE");
    assert.equal(catalog.events[0].direction, "received");
});

test("exposes built-in scenario registry", () => {
    assert.equal(getBuiltInScenario("bootstrap.idle.session")?.title, "Authenticated app bootstrap and idle baseline");
    assert.equal(getBuiltInScenario("message.send.basic")?.expected?.http?.[0].route, "/channels/{channel_id}/messages");
    assert.equal(getBuiltInScenario("message.edit.basic")?.expected?.gateway?.[0].event, "MESSAGE_UPDATE");
    assert.equal(getBuiltInScenario("voice.join.basic")?.expected?.gateway?.[0].opcode, 4);
    assert.equal(getBuiltInScenario("message.upload.attachment")?.expected?.http?.length, 2);
    assert.equal(getBuiltInScenario("read_state.mark_unread")?.expected?.http?.[0].route, "/channels/{channel_id}/messages/{message_id}/ack");
    assert.equal(getBuiltInScenario("read_state.recent_mentions")?.expected?.http?.[0].route, "/users/@me/mentions");
    assert.equal(
        getBuiltInScenario("voice.disconnect.basic")?.expected?.gateway?.some((item) => item.step_id === "disconnect-voice" && item.opcode === 4),
        true,
    );
    assert.equal(getBuiltInScenario("voice.deafen_toggle")?.expected?.gateway?.[0].opcode, 4);
    assert.equal(getBuiltInScenario("search.member.basic")?.expected?.gateway?.[0].opcode, 8);
    assert.equal(getBuiltInScenario("search.member.basic")?.expected?.gateway?.[1].event, "GUILD_MEMBERS_CHUNK");
    assert.equal(getBuiltInScenario("expressions.picker.basic")?.expected?.http?.[0].route, "/channels/{channel_id}/messages");
    assert.equal(getBuiltInScenario("experiments.visible_context")?.tags?.includes("experiments"), true);
    assert.deepEqual(getBuiltInScenario("message.delete.basic")?.safety?.requiredDisposableFixtures, ["messages.delete_target"]);
    assert.equal(getBuiltInScenario("guild.role.edit.basic")?.safety?.destructive, true);
    assert.equal(
        builtInScenarios.filter((scenario) => scenario.tags?.includes("destructive")).every((scenario) => (scenario.safety?.requiredDisposableFixtures?.length ?? 0) > 0),
        true,
    );
    assert.equal(builtInScenarios.length, 26);
    assert.equal(new Set(builtInScenarios.map((scenario) => scenario.id)).size, builtInScenarios.length);
});

test("built-in scenario registry satisfies plan invariants", () => {
    const failures: string[] = [];
    const ids = new Set<string>();
    const idPattern = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/;

    for (const scenario of builtInScenarios) {
        const tags = new Set(scenario.tags ?? []);
        const requiredFixtures = new Set(scenario.requiredFixtures ?? []);
        const requiredDisposableFixtures = scenario.safety?.requiredDisposableFixtures ?? [];
        const isDestructive = scenario.safety?.destructive === true;
        const isBaseline = tags.has("baseline");
        const stepIds = new Set([...String(scenario.run).matchAll(/ctx\.step\(\s*["'`]([^"'`]+)["'`]/g)].map((match) => match[1]));

        if (ids.has(scenario.id)) {
            failures.push(`${scenario.id}: duplicate scenario id`);
        }
        ids.add(scenario.id);

        if (!idPattern.test(scenario.id)) {
            failures.push(`${scenario.id}: id does not match ${idPattern}`);
        }

        if (tags.has("destructive") !== isDestructive) {
            failures.push(`${scenario.id}: destructive tag must match safety.destructive`);
        }

        for (const fixture of requiredDisposableFixtures) {
            if (!requiredFixtures.has(fixture)) {
                failures.push(`${scenario.id}: disposable fixture ${fixture} is not listed in requiredFixtures`);
            }
        }

        if (!isBaseline && tags.has("http") && (scenario.expected?.http?.length ?? 0) === 0) {
            failures.push(`${scenario.id}: http-tagged scenario must declare expected.http`);
        }

        if (!isBaseline && tags.has("gateway") && (scenario.expected?.gateway?.length ?? 0) === 0) {
            failures.push(`${scenario.id}: gateway-tagged scenario must declare expected.gateway`);
        }

        for (const item of scenario.expected?.http ?? []) {
            if (!item.route.startsWith("/")) {
                failures.push(`${scenario.id}: expected HTTP route must be normalized: ${item.route}`);
            }
            if (!item.step_id) {
                failures.push(`${scenario.id}: expected HTTP ${item.method} ${item.route} is missing step_id`);
            } else if (!stepIds.has(item.step_id)) {
                failures.push(`${scenario.id}: expected HTTP ${item.method} ${item.route} references unknown step ${item.step_id}`);
            }
        }

        for (const item of scenario.expected?.gateway ?? []) {
            const subject = item.event ?? `opcode ${item.opcode}`;
            if (!item.event && item.opcode === undefined) {
                failures.push(`${scenario.id}: expected Gateway entry must declare event or opcode`);
            }
            if (!item.step_id) {
                failures.push(`${scenario.id}: expected Gateway ${subject} is missing step_id`);
            } else if (!stepIds.has(item.step_id)) {
                failures.push(`${scenario.id}: expected Gateway ${subject} references unknown step ${item.step_id}`);
            }
        }
    }

    assert.deepEqual(failures, []);
});

test("non-destructive message-creating scenarios use run-specific content", () => {
    const failures = builtInScenarios
        .filter((scenario) => scenario.safety?.destructive !== true)
        .filter((scenario) => scenario.expected?.http?.some((item) => item.method === "POST" && item.route === "/channels/{channel_id}/messages"))
        .filter((scenario) => !String(scenario.run).includes("ctx.run_id"))
        .map((scenario) => `${scenario.id}: message creation must include ctx.run_id or be explicitly destructive/disposable`);

    assert.deepEqual(failures, []);
});

test("scenario action helpers emit redacted UI action labels", async () => {
    const actions: UiActionDetails[] = [];
    await messageSendBasic.run({
        run_id: "run",
        page: {
            getByRole() {
                return {
                    async fill(value) {
                        assert.equal(value, "dm-test-run");
                    },
                };
            },
            keyboard: {
                async press() {},
            },
        },
        step(_stepId, _title, run) {
            return run();
        },
        fixture(fixturePath) {
            throw new Error(`unexpected fixture lookup ${fixturePath}`);
        },
        async gotoChannel() {},
        async expectReady() {},
        async expectNetwork() {},
        async expectGateway() {},
        recordAction(action) {
            actions.push(action);
        },
    });

    assert.deepEqual(actions, [
        {
            action: "fill",
            target: "role:textbox",
            value_redacted: true,
        },
        {
            action: "press",
            target: "keyboard",
            detail: "Enter",
        },
    ]);
    assert.equal(JSON.stringify(actions).includes("dm-test-run"), false);
});

test("guild switch scenario targets the secondary guild treeitem", async () => {
    const actions: UiActionDetails[] = [];
    const steps: string[] = [];
    const clickedRoles: Array<{ role: string; name: string }> = [];
    const openedChannels: string[] = [];
    const expectedRoutes: string[] = [];
    const expectedGateway: string[] = [];

    await guildSwitch.run({
        run_id: "run",
        page: {
            getByRole(role: string, options?: Record<string, unknown>) {
                clickedRoles.push({ role, name: String(options?.name) });
                return {
                    async click() {},
                };
            },
            keyboard: {
                async press() {},
            },
        },
        async step<T>(stepId: string, _title: string, run: () => Promise<T>) {
            steps.push(stepId);
            return run();
        },
        fixture(fixturePath: string) {
            throw new Error(`unexpected fixture lookup ${fixturePath}`);
        },
        async gotoChannel(channel: string) {
            openedChannels.push(channel);
        },
        async expectReady() {},
        async expectNetwork(expectation) {
            expectedRoutes.push(`${expectation.method} ${expectation.route}`);
        },
        async expectGateway(expectation) {
            expectedGateway.push(`${expectation.direction} ${expectation.event ?? expectation.opcode}`);
        },
        recordAction(action) {
            actions.push(action);
        },
    });

    assert.deepEqual(steps, ["open-primary", "switch-guild"]);
    assert.deepEqual(openedChannels, ["general"]);
    assert.deepEqual(clickedRoles, [{ role: "treeitem", name: "/secondary guild/i" }]);
    assert.deepEqual(expectedRoutes, ["POST /guilds/{guild_id}/migrate-command-scope"]);
    assert.deepEqual(expectedGateway, ["received CHANNEL_INFO"]);
    assert.deepEqual(actions, [
        {
            action: "click",
            target: "role:treeitem",
            detail: "options:name",
        },
    ]);
    assert.equal(JSON.stringify(actions).includes("secondary guild"), false);
});

test("context-click action helpers emit redacted labels and right-click locators", async () => {
    const actions: UiActionDetails[] = [];
    const clickOptions: unknown[] = [];
    const ctx = {
        run_id: "run",
        page: {
            getByRole(role: string) {
                assert.equal(role, "button");
                return {
                    async click(options?: Record<string, unknown>) {
                        clickOptions.push(options);
                    },
                };
            },
            locator(selector: string) {
                assert.equal(selector, "#message-content-123");
                return {
                    async click(options?: Record<string, unknown>) {
                        clickOptions.push(options);
                    },
                };
            },
            getByText(text: string | RegExp) {
                assert.equal(String(text), "/mark as unread/i");
                return {
                    async click(options?: Record<string, unknown>) {
                        clickOptions.push(options);
                    },
                };
            },
            keyboard: {
                async press() {},
            },
        },
        async step<T>(_stepId: string, _title: string, run: () => Promise<T>) {
            return run();
        },
        fixture(fixturePath: string) {
            throw new Error(`unexpected fixture lookup ${fixturePath}`);
        },
        async gotoChannel() {},
        async expectReady() {},
        async expectNetwork() {},
        async expectGateway() {},
        recordAction(action: UiActionDetails) {
            actions.push(action);
        },
    };

    await contextClickRole(ctx, "test.scenario", "button", { name: /more/i });
    await contextClickSelector(ctx, "test.scenario", "#message-content-123");
    await contextClickText(ctx, "test.scenario", /mark as unread/i);

    assert.deepEqual(clickOptions, [{ button: "right" }, { button: "right" }, { button: "right" }]);
    assert.deepEqual(actions, [
        {
            action: "context-click",
            target: "role:button",
            detail: "options:name",
        },
        {
            action: "context-click",
            target: "selector",
            value_redacted: true,
        },
        {
            action: "context-click",
            target: "text",
            value_redacted: true,
        },
    ]);
    assert.equal(JSON.stringify(actions).includes("mark as unread"), false);
    assert.equal(JSON.stringify(actions).includes("message-content-123"), false);
});

test("expression picker scenario records selected emoji as a redacted UI action", async () => {
    const actions: UiActionDetails[] = [];
    await expressionPickerBasic.run({
        run_id: "run",
        page: {
            getByRole() {
                return {
                    async click() {},
                };
            },
            locator(selector) {
                assert.equal(selector, '[data-name="grinning"]');
                return {
                    async click() {},
                };
            },
            keyboard: {
                async press() {},
                async type(text: string) {
                    assert.equal(text, " dm-emoji-run");
                },
            },
        },
        step(_stepId, _title, run) {
            return run();
        },
        fixture(fixturePath) {
            throw new Error(`unexpected fixture lookup ${fixturePath}`);
        },
        async gotoChannel() {},
        async expectReady() {},
        async expectNetwork() {},
        async expectGateway() {},
        recordAction(action) {
            actions.push(action);
        },
    });

    assert.deepEqual(actions, [
        {
            action: "click",
            target: "role:button",
            detail: "options:name",
        },
        {
            action: "click",
            target: "selector",
            value_redacted: true,
        },
        {
            action: "type",
            target: "keyboard",
            value_redacted: true,
        },
        {
            action: "press",
            target: "keyboard",
            detail: "Enter",
        },
    ]);
    assert.equal(JSON.stringify(actions).includes("\u{1F600}"), false);
    assert.equal(JSON.stringify(actions).includes("grinning"), false);
});

test("attachment scenario resolves upload files from fixture manifest", async () => {
    const actions: UiActionDetails[] = [];
    const selectedFiles: unknown[] = [];
    const networkExpectations: string[] = [];
    const expectedFile = "/tmp/spacebar-datamining-small-attachment.bin";

    await messageUploadAttachment.run({
        run_id: "run",
        page: {
            getByRole(role, options) {
                assert.equal(role, "textbox");
                return {
                    async fill(value) {
                        assert.equal(value, "dm-upload-run");
                    },
                };
            },
            locator(selector) {
                assert.equal(selector, "input[type=file]");
                return {
                    async setInputFiles(files) {
                        selectedFiles.push(files);
                    },
                };
            },
            keyboard: {
                async press(key) {
                    assert.equal(key, "Enter");
                },
            },
        },
        step(_stepId, _title, run) {
            return run();
        },
        fixture(fixturePath) {
            assert.equal(fixturePath, "files.small_attachment");
            return expectedFile;
        },
        async gotoChannel(name) {
            assert.equal(name, "general");
        },
        async expectReady() {},
        async expectNetwork(expectation) {
            networkExpectations.push(`${expectation.method} ${expectation.route}`);
        },
        async expectGateway(expectation) {
            assert.equal(expectation.event, "MESSAGE_CREATE");
        },
        recordAction(action) {
            actions.push(action);
        },
    });

    assert.deepEqual(selectedFiles, [expectedFile]);
    assert.deepEqual(networkExpectations, ["POST /channels/{channel_id}/attachments", "POST /channels/{channel_id}/messages"]);
    assert.equal(JSON.stringify(actions).includes(expectedFile), false);
    assert.equal(
        actions.some((action) => action.action === "set-input-files" && action.value_redacted === true),
        true,
    );
});

test("correlates message send traffic with expected endpoint and gateway event", () => {
    const events: CaptureEvent[] = [
        {
            run_id: "run",
            feature_id: messageSendBasic.id,
            step_id: "send-message",
            ts_monotonic_ms: 1,
            kind: "step.start",
            title: "Send plain message",
        },
        {
            run_id: "run",
            feature_id: messageSendBasic.id,
            step_id: "send-message",
            ts_monotonic_ms: 1.5,
            kind: "ui.action",
            action: "fill",
            target: "role:textbox",
            value_redacted: true,
        },
        {
            run_id: "run",
            feature_id: messageSendBasic.id,
            step_id: "send-message",
            ts_monotonic_ms: 2,
            kind: "http.request",
            cdp_request_id: "correlate-message-send-request",
            method: "POST",
            url: "https://discord.com/api/v9/channels/{channel_id}/messages",
            normalized_route: "/channels/{channel_id}/messages",
            headers_redacted: true,
            request_body_shape_hash: shapeResult({ content: "string" }).hash,
            request_body_redacted: {
                content: "{redacted_string}",
                nonce: "{snowflake}",
            },
            initiator: {
                stack_hash: "sha256:stack",
                frames: [
                    {
                        url: "https://canary.discord.com/assets/web.js",
                        file_name: "web.js",
                        line_number: 1,
                        column_number: 2,
                    },
                ],
            },
        },
        {
            run_id: "run",
            feature_id: messageSendBasic.id,
            step_id: "send-message",
            ts_monotonic_ms: 2.5,
            kind: "http.response",
            cdp_request_id: "correlate-message-send-request",
            method: "POST",
            url: "https://discord.com/api/v9/channels/{channel_id}/messages",
            normalized_route: "/channels/{channel_id}/messages",
            status: 200,
            headers_redacted: true,
            response_body_shape_hash: shapeResult({ id: "string", content: "string" }).hash,
            response_body_redacted: {
                content: "{redacted_string}",
                id: "{snowflake}",
            },
        },
        {
            run_id: "run",
            feature_id: messageSendBasic.id,
            step_id: "send-message",
            ts_monotonic_ms: 3,
            kind: "ws.frame.received",
            websocket_id: "gateway-1",
            url: "wss://gateway.discord.gg",
            direction: "received",
            opcode: 0,
            gateway_event: "MESSAGE_CREATE",
            payload_shape_hash: shapeResult({ id: "string" }).hash,
            payload_redacted: {
                id: "{snowflake}",
                t: "MESSAGE_CREATE",
            },
        },
        {
            run_id: "run",
            feature_id: messageSendBasic.id,
            step_id: "send-message",
            ts_monotonic_ms: 4,
            kind: "step.end",
            title: "Send plain message",
        },
    ];

    const summary = correlateFeatureTraffic({ feature: messageSendBasic, events });
    assert.deepEqual(summary.expected, messageSendBasic.expected);
    assert.deepEqual(summary.steps, [
        {
            step_id: "send-message",
            title: "Send plain message",
            started_at_ms: 1,
            ended_at_ms: 4,
            actions: [
                {
                    action: "fill",
                    target: "role:textbox",
                    value_redacted: true,
                    occurred_at_ms: 1.5,
                },
            ],
        },
    ]);
    assert.equal(summary.traffic.length, 2);
    assert.equal(
        summary.traffic.every((item) => item.attribution === "direct"),
        true,
    );
    const http = summary.traffic.find((item) => item.type === "http");
    assert.equal(http?.initiator_stack_hash, "sha256:stack");
    assert.equal(http?.initiator_frames?.[0].file_name, "web.js");
    assert.deepEqual(http?.request_sample_redacted, {
        content: "{redacted_string}",
        nonce: "{snowflake}",
    });
    assert.deepEqual(http?.response_sample_redacted, {
        content: "{redacted_string}",
        id: "{snowflake}",
    });
    const gateway = summary.traffic.find((item) => item.type === "gateway");
    assert.deepEqual(gateway?.payload_sample_redacted, {
        id: "{snowflake}",
        t: "MESSAGE_CREATE",
    });
});

test("keeps repeated same-route HTTP summaries paired by request id", () => {
    const events: CaptureEvent[] = [
        {
            run_id: "run",
            feature_id: messageSendBasic.id,
            step_id: "send-message",
            ts_monotonic_ms: 1,
            kind: "step.start",
            title: "Send plain message",
        },
        {
            run_id: "run",
            feature_id: messageSendBasic.id,
            step_id: "send-message",
            ts_monotonic_ms: 2,
            kind: "http.request",
            cdp_request_id: "first-message-request",
            method: "POST",
            url: "https://discord.com/api/v9/channels/{channel_id}/messages",
            normalized_route: "/channels/{channel_id}/messages",
            headers_redacted: true,
            request_body_shape_hash: "sha256:first-request",
        },
        {
            run_id: "run",
            feature_id: messageSendBasic.id,
            step_id: "send-message",
            ts_monotonic_ms: 3,
            kind: "http.request",
            cdp_request_id: "second-message-request",
            method: "POST",
            url: "https://discord.com/api/v9/channels/{channel_id}/messages",
            normalized_route: "/channels/{channel_id}/messages",
            headers_redacted: true,
            request_body_shape_hash: "sha256:second-request",
        },
        {
            run_id: "run",
            feature_id: messageSendBasic.id,
            step_id: "send-message",
            ts_monotonic_ms: 4,
            kind: "http.response",
            cdp_request_id: "first-message-request",
            method: "POST",
            url: "https://discord.com/api/v9/channels/{channel_id}/messages",
            normalized_route: "/channels/{channel_id}/messages",
            status: 200,
            headers_redacted: true,
            response_body_shape_hash: "sha256:first-response",
        },
        {
            run_id: "run",
            feature_id: messageSendBasic.id,
            step_id: "send-message",
            ts_monotonic_ms: 5,
            kind: "http.response",
            cdp_request_id: "second-message-request",
            method: "POST",
            url: "https://discord.com/api/v9/channels/{channel_id}/messages",
            normalized_route: "/channels/{channel_id}/messages",
            status: 200,
            headers_redacted: true,
            response_body_shape_hash: "sha256:second-response",
        },
    ];

    const summary = correlateFeatureTraffic({ feature: messageSendBasic, events });
    const http = summary.traffic.filter((item) => item.type === "http");
    assert.equal(http.length, 2);
    assert.equal(http.find((item) => item.request_shape === "sha256:first-request")?.response_shape, "sha256:first-response");
    assert.equal(http.find((item) => item.request_shape === "sha256:second-request")?.response_shape, "sha256:second-response");
});

test("correlates Playwright convenience traffic with redacted samples", () => {
    const events: CaptureEvent[] = [
        {
            run_id: "run",
            feature_id: messageSendBasic.id,
            step_id: "send-message",
            ts_monotonic_ms: 1,
            kind: "step.start",
            title: "Send plain message",
        },
        {
            run_id: "run",
            feature_id: messageSendBasic.id,
            step_id: "send-message",
            ts_monotonic_ms: 2,
            kind: "playwright.http.request",
            playwright_request_id: "playwright-correlate-message-send-request",
            method: "POST",
            url: "https://discord.com/api/v9/channels/{channel_id}/messages",
            normalized_route: "/channels/{channel_id}/messages",
            headers_redacted: true,
            request_body_shape_hash: shapeResult({ content: "string" }).hash,
            request_body_redacted: {
                content: "{redacted_string}",
            },
        },
        {
            run_id: "run",
            feature_id: messageSendBasic.id,
            step_id: "send-message",
            ts_monotonic_ms: 3,
            kind: "playwright.ws.frame.received",
            websocket_id: "playwright-ws-1",
            url: "wss://gateway.discord.gg",
            direction: "received",
            opcode: 0,
            gateway_event: "MESSAGE_CREATE",
            payload_shape_hash: shapeResult({ d: { id: "string" } }).hash,
            payload_redacted: {
                d: {
                    id: "{snowflake}",
                },
                op: 0,
                t: "MESSAGE_CREATE",
            },
        },
    ];

    const summary = correlateFeatureTraffic({ feature: messageSendBasic, events });
    assert.equal(summary.traffic.length, 2);
    assert.equal(
        summary.traffic.every((item) => item.attribution === "direct"),
        true,
    );
    assert.deepEqual(summary.traffic.find((item) => item.type === "http")?.request_sample_redacted, {
        content: "{redacted_string}",
    });
    assert.deepEqual(summary.traffic.find((item) => item.type === "gateway")?.payload_sample_redacted, {
        d: {
            id: "{snowflake}",
        },
        op: 0,
        t: "MESSAGE_CREATE",
    });
});

test("does not suppress baseline traffic when payload shape changes", () => {
    const feature = {
        id: "science.inspect",
        title: "Inspect science payload",
    };
    const baselineEvents: CaptureEvent[] = [
        {
            run_id: "baseline",
            feature_id: "bootstrap.idle.session",
            ts_monotonic_ms: 1,
            kind: "http.request",
            cdp_request_id: "baseline-science-request",
            method: "POST",
            url: "https://discord.com/api/v9/science",
            normalized_route: "/science",
            headers_redacted: true,
            request_body_shape_hash: "sha256:old",
        },
        {
            run_id: "baseline",
            feature_id: "bootstrap.idle.session",
            ts_monotonic_ms: 1.5,
            kind: "http.response",
            cdp_request_id: "baseline-science-request",
            method: "POST",
            url: "https://discord.com/api/v9/science",
            normalized_route: "/science",
            status: 200,
            headers_redacted: true,
            response_body_shape_hash: "sha256:old-response",
        },
        {
            run_id: "baseline",
            feature_id: "bootstrap.idle.session",
            ts_monotonic_ms: 2,
            kind: "ws.frame.received",
            websocket_id: "gateway-1",
            url: "wss://gateway.discord.gg",
            direction: "received",
            opcode: 0,
            gateway_event: "BACKGROUND_EVENT",
            payload_shape_hash: "sha256:stable",
        },
    ];
    const events: CaptureEvent[] = [
        {
            run_id: "run",
            feature_id: feature.id,
            step_id: "inspect",
            ts_monotonic_ms: 1,
            kind: "step.start",
            title: "Inspect",
        },
        {
            run_id: "run",
            feature_id: feature.id,
            step_id: "inspect",
            ts_monotonic_ms: 2,
            kind: "http.request",
            cdp_request_id: "inspect-science-request",
            method: "POST",
            url: "https://discord.com/api/v9/science",
            normalized_route: "/science",
            headers_redacted: true,
            request_body_shape_hash: "sha256:new",
        },
        {
            run_id: "run",
            feature_id: feature.id,
            step_id: "inspect",
            ts_monotonic_ms: 2.5,
            kind: "http.response",
            cdp_request_id: "inspect-science-request",
            method: "POST",
            url: "https://discord.com/api/v9/science",
            normalized_route: "/science",
            status: 200,
            headers_redacted: true,
            response_body_shape_hash: "sha256:new-response",
        },
        {
            run_id: "run",
            feature_id: feature.id,
            step_id: "inspect",
            ts_monotonic_ms: 3,
            kind: "ws.frame.received",
            websocket_id: "gateway-1",
            url: "wss://gateway.discord.gg",
            direction: "received",
            opcode: 0,
            gateway_event: "BACKGROUND_EVENT",
            payload_shape_hash: "sha256:stable",
        },
        {
            run_id: "run",
            feature_id: feature.id,
            step_id: "inspect",
            ts_monotonic_ms: 4,
            kind: "step.end",
        },
    ];

    const summary = correlateFeatureTraffic({ feature, events, baselineEvents });
    const science = summary.traffic.find((item) => item.route === "POST /science");
    assert.equal(science?.attribution, "probable");
    assert.equal(science?.response_shape, "sha256:new-response");
    assert.equal(summary.traffic.find((item) => item.event === "BACKGROUND_EVENT")?.attribution, "background");
    assert.equal(summary.background_events, 1);
});

test("does not suppress same-shape baseline traffic immediately after causative UI actions", () => {
    const feature = {
        id: "timing.inspect",
        title: "Inspect action timing",
    };
    const baselineEvents: CaptureEvent[] = [
        {
            run_id: "baseline",
            feature_id: "bootstrap.idle.session",
            ts_monotonic_ms: 1,
            kind: "http.request",
            cdp_request_id: "timing-baseline-science-request",
            method: "POST",
            url: "https://discord.com/api/v9/science",
            normalized_route: "/science",
            headers_redacted: true,
            request_body_shape_hash: "sha256:stable",
        },
        {
            run_id: "baseline",
            feature_id: "bootstrap.idle.session",
            ts_monotonic_ms: 2,
            kind: "http.request",
            cdp_request_id: "timing-baseline-typing-request",
            method: "POST",
            url: "https://discord.com/api/v9/typing",
            normalized_route: "/typing",
            headers_redacted: true,
            request_body_shape_hash: "sha256:stable",
        },
        {
            run_id: "baseline",
            feature_id: "bootstrap.idle.session",
            ts_monotonic_ms: 3,
            kind: "http.request",
            cdp_request_id: "timing-baseline-experiments-request",
            method: "GET",
            url: "https://discord.com/api/v9/experiments",
            normalized_route: "/experiments",
            headers_redacted: true,
            request_body_shape_hash: "sha256:stable",
        },
        {
            run_id: "baseline",
            feature_id: "bootstrap.idle.session",
            ts_monotonic_ms: 4,
            kind: "ws.frame.received",
            websocket_id: "gateway-1",
            url: "wss://gateway.discord.gg",
            direction: "received",
            opcode: 0,
            gateway_event: "BACKGROUND_EVENT",
            payload_shape_hash: "sha256:stable",
        },
    ];
    const events: CaptureEvent[] = [
        {
            run_id: "run",
            feature_id: feature.id,
            step_id: "inspect",
            ts_monotonic_ms: 1,
            kind: "step.start",
            title: "Inspect",
        },
        {
            run_id: "run",
            feature_id: feature.id,
            step_id: "inspect",
            ts_monotonic_ms: 2,
            kind: "http.request",
            cdp_request_id: "timing-inspect-science-request",
            method: "POST",
            url: "https://discord.com/api/v9/science",
            normalized_route: "/science",
            headers_redacted: true,
            request_body_shape_hash: "sha256:stable",
        },
        {
            run_id: "run",
            feature_id: feature.id,
            step_id: "inspect",
            ts_monotonic_ms: 2.5,
            kind: "ui.action",
            action: "expect-network",
            target: "POST /typing",
        },
        {
            run_id: "run",
            feature_id: feature.id,
            step_id: "inspect",
            ts_monotonic_ms: 3,
            kind: "http.request",
            cdp_request_id: "timing-inspect-typing-request",
            method: "POST",
            url: "https://discord.com/api/v9/typing",
            normalized_route: "/typing",
            headers_redacted: true,
            request_body_shape_hash: "sha256:stable",
        },
        {
            run_id: "run",
            feature_id: feature.id,
            step_id: "inspect",
            ts_monotonic_ms: 3.5,
            kind: "ui.action",
            action: "click",
            target: "role:button",
        },
        {
            run_id: "run",
            feature_id: feature.id,
            step_id: "inspect",
            ts_monotonic_ms: 4,
            kind: "http.request",
            cdp_request_id: "timing-inspect-experiments-request",
            method: "GET",
            url: "https://discord.com/api/v9/experiments",
            normalized_route: "/experiments",
            headers_redacted: true,
            request_body_shape_hash: "sha256:stable",
        },
        {
            run_id: "run",
            feature_id: feature.id,
            step_id: "inspect",
            ts_monotonic_ms: 4.5,
            kind: "ws.frame.received",
            websocket_id: "gateway-1",
            url: "wss://gateway.discord.gg",
            direction: "received",
            opcode: 0,
            gateway_event: "BACKGROUND_EVENT",
            payload_shape_hash: "sha256:stable",
        },
        {
            run_id: "run",
            feature_id: feature.id,
            step_id: "inspect",
            ts_monotonic_ms: 5,
            kind: "ws.frame.sent",
            websocket_id: "gateway-1",
            url: "wss://gateway.discord.gg",
            direction: "sent",
            opcode: 1,
            payload_shape_hash: "sha256:heartbeat",
        },
        {
            run_id: "run",
            feature_id: feature.id,
            step_id: "inspect",
            ts_monotonic_ms: 6,
            kind: "step.end",
        },
    ];

    const summary = correlateFeatureTraffic({ feature, events, baselineEvents });
    assert.equal(summary.traffic.find((item) => item.route === "POST /science")?.attribution, "background");
    assert.equal(summary.traffic.find((item) => item.route === "POST /typing")?.attribution, "background");
    assert.equal(summary.traffic.find((item) => item.route === "GET /experiments")?.attribution, "probable");
    assert.equal(summary.traffic.find((item) => item.event === "BACKGROUND_EVENT")?.attribution, "probable");
    assert.equal(summary.traffic.find((item) => item.opcode === 1)?.attribution, "background");
    assert.equal(summary.background_events, 3);
});

test("builds coverage and feature diffs from summaries", () => {
    const base: FeatureSummary = {
        run_id: "base",
        feature_id: "message.send.basic",
        traffic: [
            {
                type: "http",
                step_id: "send-message",
                method: "POST",
                route: "POST /channels/{channel_id}/messages",
                request_shape: "sha256:old",
                response_shape: "sha256:response",
                attribution: "direct",
            },
            {
                type: "gateway",
                step_id: "send-message",
                direction: "received",
                event: "MESSAGE_CREATE",
                payload_shape: "sha256:payload",
                attribution: "direct",
            },
            {
                type: "http",
                method: "POST",
                route: "POST /science",
                request_shape: "sha256:telemetry-old",
                attribution: "background",
            },
        ],
        unknown_events: 0,
        background_events: 0,
        generated_at: "2026-05-07T00:00:00.000Z",
    };
    const head: FeatureSummary = {
        ...base,
        run_id: "head",
        generated_at: "2026-05-07T01:00:00.000Z",
        traffic: [
            {
                ...base.traffic[0],
                request_shape: "sha256:new",
            },
            base.traffic[1],
            {
                ...base.traffic[2],
                request_shape: "sha256:telemetry-new",
            },
        ],
    };
    const builds = [
        {
            run_id: "base",
            x_build_id: "build-base",
            collected_at: "2026-05-07T00:00:00.000Z",
        },
        {
            run_id: "head",
            x_build_id: "build-head",
            collected_at: "2026-05-07T01:00:00.000Z",
        },
    ];
    const routeCatalog = [
        {
            method: "POST" as const,
            route: "/channels/{channel_id}/messages",
            route_name: "CREATE_MESSAGE",
            source: "test",
            summary: "Create message",
        },
    ];
    const gatewayCatalog = {
        events: [{ event: "MESSAGE_CREATE", name: "Message Create", direction: "received" as const, source: "test" }],
        opcodes: [],
    };

    const routeCoverage = buildRouteCoverage([base, head], { builds, routeCatalog });
    const gatewayCoverage = buildGatewayCoverage([base, head], { builds, gatewayCatalog });
    const backgroundCoverage = buildRouteCoverage([base, head], { includeBackground: true });
    assert.equal(
        routeCoverage.some((entry) => entry.route === "POST /science"),
        false,
    );
    assert.equal(
        backgroundCoverage.some((entry) => entry.route === "POST /science"),
        true,
    );
    assert.deepEqual(routeCoverage[0].feature_ids, ["message.send.basic"]);
    assert.deepEqual(routeCoverage[0].observed_run_ids, ["base", "head"]);
    assert.equal(routeCoverage[0].first_observed_build, "build-base");
    assert.equal(routeCoverage[0].last_observed_build, "build-head");
    assert.equal(routeCoverage[0].catalog?.route_name, "CREATE_MESSAGE");
    assert.deepEqual(
        routeCoverage[0].request_shape_history.map((entry) => entry.shape_hash),
        ["sha256:new", "sha256:old"],
    );
    assert.equal(gatewayCoverage[0].event, "MESSAGE_CREATE");
    assert.equal(gatewayCoverage[0].first_observed_run_id, "base");
    assert.equal(gatewayCoverage[0].last_observed_run_id, "head");
    assert.equal(gatewayCoverage[0].catalog?.name, "Message Create");
    assert.equal(renderRouteCoverageMarkdown(routeCoverage).includes("build-base -> build-head"), true);
    assert.equal(renderGatewayCoverageMarkdown(gatewayCoverage).includes("Message Create (test)"), true);
    const diff = diffFeatureSummary(base, head);
    assert.equal(diff.changed.length, 1);
    assert.deepEqual(diff.changed[0].changes, ["request_shape"]);
    assert.equal(
        diff.changed.some((item) => item.key.includes("/science")),
        false,
    );
    assert.equal(diffFeatureSummary(base, head, { includeBackground: true }).changed.length, 2);
    const markdown = renderFeatureDiffMarkdown(diff);
    assert.equal(markdown.includes("# Feature Diff: message.send.basic"), true);
    assert.equal(markdown.includes("changed fields: request_shape"), true);
    assert.equal(markdown.includes("before: attribution=direct, request=sha256:old"), true);
});

test("exports a SQLite-compatible local query index", async () => {
    const summary: FeatureSummary = {
        run_id: "run",
        feature_id: "message.send.basic",
        title: "Send a plain text message",
        steps: [
            {
                step_id: "send-message",
                title: "Send plain message",
                started_at_ms: 1,
                ended_at_ms: 2,
                actions: [
                    {
                        action: "fill",
                        target: "role:textbox",
                        value_redacted: true,
                        occurred_at_ms: 1.5,
                    },
                ],
            },
        ],
        traffic: [
            {
                type: "http",
                step_id: "send-message",
                method: "POST",
                route: "POST /channels/{channel_id}/messages",
                status_codes: [200],
                request_shape: "sha256:request",
                response_shape: "sha256:response",
                request_sample_redacted: {
                    content: "{redacted_string}",
                    nonce: "{snowflake}",
                },
                response_sample_redacted: {
                    id: "{snowflake}",
                },
                initiator_stack_hash: "sha256:stack",
                attribution: "direct",
                static_candidates: [
                    {
                        chunk: "web.js",
                        module_id: "123456",
                        stack_hash: "sha256:stack",
                        source_context: "function sendMessage",
                        source_context_hash: "sha256:source-context",
                        source_context_truncated: false,
                        confidence: "high",
                    },
                ],
            },
            {
                type: "gateway",
                step_id: "send-message",
                direction: "received",
                event: "MESSAGE_CREATE",
                opcode: 0,
                payload_shape: "sha256:payload",
                payload_sample_redacted: {
                    d: {
                        id: "{snowflake}",
                    },
                },
                attribution: "direct",
            },
        ],
        unknown_events: 0,
        background_events: 0,
        generated_at: "2026-05-07T00:00:00.000Z",
    };
    const build: BuildSnapshot = {
        run_id: "run",
        channel: "canary",
        base_url: "https://canary.discord.com",
        api_base_url: "https://discord.com/api",
        x_build_id: "build-id",
        asset_hashes: ["sha256:asset"],
        source_refs: { xhyrom_routes_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
        collected_at: "2026-05-07T00:00:00.000Z",
    };

    const sql = buildSqliteIndexSql({
        summaries: [summary],
        builds: [build],
        routeCatalog: [
            {
                method: "POST",
                route: "/channels/{channel_id}/messages",
                route_name: "CREATE_MESSAGE",
                source: "catalog",
            },
        ],
        gatewayCatalog: {
            opcodes: [{ opcode: 0, name: "Dispatch", direction: "received", source: "gateway" }],
            events: [{ event: "MESSAGE_CREATE", direction: "received", source: "gateway" }],
        },
        includeSamples: true,
    });

    assert.equal(sql.includes("CREATE TABLE IF NOT EXISTS runs"), true);
    assert.equal(sql.includes("CREATE TABLE IF NOT EXISTS sql_index_meta"), true);
    assert.equal(sql.includes("CREATE TABLE IF NOT EXISTS http_events"), true);
    assert.equal(sql.includes("CREATE TABLE IF NOT EXISTS ws_events"), true);
    assert.equal(sql.includes("CREATE TABLE IF NOT EXISTS payload_shapes"), true);
    assert.equal(sql.includes("message.send.basic|send-message|http|POST /channels/{channel_id}/messages"), true);
    assert.equal(sql.includes("INSERT INTO runs VALUES ('run', 'canary'"), true);
    assert.equal(sql.includes("POST /channels/{channel_id}/messages"), true);
    assert.equal(sql.includes("MESSAGE_CREATE"), true);
    assert.equal(sql.includes("function sendMessage"), true);
    assert.equal(sql.includes("sha256:source-context"), true);
    assert.equal(sql.includes("{redacted_string}"), true);
    assert.equal(sql.includes("dm-test-run"), false);
    assert.equal(buildSqliteIndexSql({ summaries: [summary] }).includes("{redacted_string}"), false);

    const root = await mkdtemp(join(tmpdir(), "are-sqlite-index-"));
    try {
        const summaryPath = join(root, "summary.json");
        const buildPath = join(root, "build.json");
        const routesPath = join(root, "routes.json");
        const gatewayPath = join(root, "gateway.json");
        const outPath = join(root, "datamine.sqlite.sql");
        await writeFile(summaryPath, JSON.stringify(summary), "utf8");
        await writeFile(buildPath, JSON.stringify(build), "utf8");
        await writeFile(routesPath, JSON.stringify([{ method: "POST", route: "/channels/{channel_id}/messages", route_name: "CREATE_MESSAGE", source: "catalog" }]), "utf8");
        await writeFile(gatewayPath, JSON.stringify({ opcodes: [], events: [{ event: "MESSAGE_CREATE", direction: "received", source: "gateway" }] }), "utf8");
        await execFileAsync(process.execPath, [
            fileURLToPath(new URL("./cli.js", import.meta.url)),
            "export-sqlite-index",
            "--summaries",
            summaryPath,
            "--builds",
            buildPath,
            "--routes",
            routesPath,
            "--gateway",
            gatewayPath,
            "--out",
            outPath,
        ]);

        const output = await readFile(outPath, "utf8");
        assert.equal(output.includes("INSERT INTO route_catalog"), true);
        assert.equal(output.includes("INSERT INTO gateway_catalog"), true);
        assert.equal(output.includes("{redacted_string}"), false);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("coverage CLI attaches build and catalog context", async () => {
    const root = await mkdtemp(join(tmpdir(), "are-coverage-cli-"));
    try {
        const summaryPath = join(root, "summary.json");
        const buildPath = join(root, "build.json");
        const routesPath = join(root, "routes.json");
        const gatewayPath = join(root, "gateway.json");
        const output = join(root, "coverage");
        await writeFile(
            summaryPath,
            JSON.stringify({
                run_id: "run",
                feature_id: "message.send.basic",
                traffic: [
                    {
                        type: "http",
                        step_id: "send-message",
                        method: "POST",
                        route: "POST /channels/{channel_id}/messages",
                        request_shape: "sha256:request",
                        response_shape: "sha256:response",
                        attribution: "direct",
                    },
                    {
                        type: "gateway",
                        step_id: "send-message",
                        direction: "received",
                        event: "MESSAGE_CREATE",
                        payload_shape: "sha256:payload",
                        attribution: "direct",
                    },
                ],
                unknown_events: 0,
                background_events: 0,
                generated_at: "2026-05-07T00:00:00.000Z",
            } satisfies FeatureSummary),
            "utf8",
        );
        await writeFile(
            buildPath,
            JSON.stringify({
                run_id: "run",
                channel: "canary",
                base_url: "https://canary.discord.com",
                api_base_url: "https://discord.com/api",
                x_build_id: "build-run",
                asset_hashes: [],
                source_refs: {},
                collected_at: "2026-05-07T00:00:00.000Z",
            }),
            "utf8",
        );
        await writeFile(
            routesPath,
            JSON.stringify([
                {
                    method: "POST",
                    route: "/channels/{channel_id}/messages",
                    route_name: "CREATE_MESSAGE",
                    source: "test",
                },
            ]),
            "utf8",
        );
        await writeFile(
            gatewayPath,
            JSON.stringify({
                events: [{ event: "MESSAGE_CREATE", name: "Message Create", direction: "received", source: "test" }],
                opcodes: [],
            }),
            "utf8",
        );

        await execFileAsync(process.execPath, [
            fileURLToPath(new URL("./cli.js", import.meta.url)),
            "coverage",
            "--summaries",
            summaryPath,
            "--builds",
            buildPath,
            "--routes",
            routesPath,
            "--gateway",
            gatewayPath,
            "--out",
            output,
        ]);

        const routeCoverage = JSON.parse(await readFile(join(output, "routes.coverage.json"), "utf8")) as Array<{
            first_observed_build?: string;
            catalog?: { route_name?: string };
        }>;
        const gatewayMarkdown = await readFile(join(output, "gateway.coverage.md"), "utf8");
        assert.equal(routeCoverage[0].first_observed_build, "build-run");
        assert.equal(routeCoverage[0].catalog?.route_name, "CREATE_MESSAGE");
        assert.equal(gatewayMarkdown.includes("Message Create (test)"), true);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("builds aggregate build diffs from static and runtime changes", async () => {
    const baseBuild: BuildSnapshot = {
        run_id: "base",
        channel: "canary",
        base_url: "https://canary.discord.com",
        api_base_url: "https://discord.com/api",
        x_build_id: "build-base",
        asset_hashes: ["sha256:asset-a"],
        source_refs: { xhyrom_routes_commit: "base-ref" },
        collected_at: "2026-05-07T00:00:00.000Z",
    };
    const headBuild: BuildSnapshot = {
        ...baseBuild,
        run_id: "head",
        x_build_id: "build-head",
        asset_hashes: ["sha256:asset-b"],
        source_refs: { xhyrom_routes_commit: "head-ref" },
        collected_at: "2026-05-07T01:00:00.000Z",
    };
    const baseSummary: FeatureSummary = {
        run_id: "base",
        feature_id: "message.send.basic",
        traffic: [
            {
                type: "http",
                step_id: "send-message",
                method: "POST",
                route: "POST /channels/{channel_id}/messages",
                request_shape: "sha256:old",
                response_shape: "sha256:response",
                attribution: "direct",
            },
        ],
        unknown_events: 0,
        background_events: 0,
        generated_at: "2026-05-07T00:00:00.000Z",
    };
    const headSummary: FeatureSummary = {
        ...baseSummary,
        run_id: "head",
        traffic: [
            { ...baseSummary.traffic[0], request_shape: "sha256:new" },
            {
                type: "gateway",
                step_id: "send-message",
                direction: "received",
                event: "MESSAGE_CREATE",
                payload_shape: "sha256:payload",
                attribution: "direct",
            },
        ],
        generated_at: "2026-05-07T01:00:00.000Z",
    };
    const featureDiffs = diffFeatureSummarySets([baseSummary], [headSummary]);
    const buildDiff = diffBuildSnapshots(baseBuild, headBuild, {
        featureDiffs,
        reviewQueue: [
            {
                feature_id: "message.send.basic",
                reason: "changed_signature",
                severity: "high",
                subject: "POST /channels/{channel_id}/messages",
            },
        ],
    });

    assert.equal(buildDiff.static_build_changed, true);
    assert.equal(buildDiff.runtime_feature_signature_changed, true);
    assert.equal(buildDiff.summary.features_changed, 1);
    assert.equal(buildDiff.summary.http_changed, 1);
    assert.equal(buildDiff.summary.gateway_added, 1);
    assert.deepEqual(buildDiff.added_asset_hashes, ["sha256:asset-b"]);
    assert.deepEqual(buildDiff.removed_asset_hashes, ["sha256:asset-a"]);
    assert.equal(buildDiff.source_ref_changes[0].key, "xhyrom_routes_commit");
    assert.equal(buildDiff.confidence, "high");
    const markdown = renderBuildDiffMarkdown(buildDiff);
    assert.equal(markdown.includes("# Build Diff: base -> head"), true);
    assert.equal(markdown.includes("runtime feature signature changed: true"), true);

    const root = await mkdtemp(join(tmpdir(), "are-build-diff-cli-"));
    try {
        const baseBuildPath = join(root, "base-build.json");
        const headBuildPath = join(root, "head-build.json");
        const baseSummaryPath = join(root, "base-summary.json");
        const headSummaryPath = join(root, "head-summary.json");
        const outPath = join(root, "build-diff.json");
        const markdownPath = join(root, "build-diff.md");
        await writeFile(baseBuildPath, JSON.stringify(baseBuild), "utf8");
        await writeFile(headBuildPath, JSON.stringify(headBuild), "utf8");
        await writeFile(baseSummaryPath, JSON.stringify(baseSummary), "utf8");
        await writeFile(headSummaryPath, JSON.stringify(headSummary), "utf8");
        await execFileAsync(process.execPath, [
            fileURLToPath(new URL("./cli.js", import.meta.url)),
            "diff-build",
            "--base-build",
            baseBuildPath,
            "--head-build",
            headBuildPath,
            "--base-summaries",
            baseSummaryPath,
            "--head-summaries",
            headSummaryPath,
            "--out",
            outPath,
            "--markdown-out",
            markdownPath,
        ]);

        const cliDiff = JSON.parse(await readFile(outPath, "utf8")) as { runtime_feature_signature_changed?: boolean };
        assert.equal(cliDiff.runtime_feature_signature_changed, true);
        assert.equal((await readFile(markdownPath, "utf8")).includes("Gateway added/removed/changed: 1/0/0"), true);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("renders feature reports with build, fixture, and static candidate context", () => {
    const summary: FeatureSummary = {
        run_id: "run",
        feature_id: "message.send.basic",
        title: "Send a plain text message",
        steps: [
            {
                step_id: "open-channel",
                title: "Open general channel",
                started_at_ms: 1,
                ended_at_ms: 2,
                actions: [
                    {
                        action: "goto-channel",
                        target: "fixture-channel:general",
                        occurred_at_ms: 1.5,
                    },
                ],
            },
            {
                step_id: "send-message",
                title: "Send plain message",
                started_at_ms: 3,
                ended_at_ms: 4,
                actions: [
                    {
                        action: "fill",
                        target: "role:textbox",
                        detail: "options:name",
                        value_redacted: true,
                        occurred_at_ms: 3.2,
                    },
                    {
                        action: "press",
                        target: "keyboard",
                        detail: "Enter",
                        occurred_at_ms: 3.3,
                    },
                ],
            },
        ],
        traffic: [
            {
                type: "http",
                step_id: "send-message",
                method: "POST",
                route: "POST /channels/{channel_id}/messages",
                request_shape: "sha256:request",
                response_shape: "sha256:response",
                request_sample_redacted: {
                    content: "{redacted_string}",
                    flags: 0,
                    nonce: "{snowflake}",
                },
                response_sample_redacted: {
                    author: {
                        id: "{snowflake}",
                        username: "{redacted_string}",
                    },
                    id: "{snowflake}",
                },
                attribution: "direct",
                static_candidates: [
                    {
                        chunk: "chunk.js",
                        module_id: "555555",
                        source_file: "webpack://discord/src/messages/sendMessage.ts",
                        source_name: "sendMessage",
                        source_line_number: 4,
                        source_context: "function sendMessage",
                        source_context_hash: "sha256:source-context",
                        confidence: "high",
                    },
                ],
                experiment_candidates: [
                    {
                        source: "chunk.js",
                        context_hash: "sha256:experiment",
                        confidence: "medium",
                        key: "experimentId",
                        value: "send_message_test",
                    },
                ],
            },
            {
                type: "gateway",
                step_id: "send-message",
                direction: "received",
                event: "MESSAGE_CREATE",
                payload_shape: "sha256:payload",
                payload_sample_redacted: {
                    d: {
                        id: "{snowflake}",
                    },
                    op: 0,
                    t: "MESSAGE_CREATE",
                },
                attribution: "direct",
            },
        ],
        unknown_events: 0,
        background_events: 0,
        generated_at: "2026-05-07T00:00:00.000Z",
    };

    const markdown = renderFeatureMarkdownReport({
        summary,
        staticSnapshot: {
            build: {
                run_id: "run",
                channel: "canary",
                base_url: "https://canary.discord.com",
                api_base_url: "https://discord.com/api",
                x_build_id: "build-id",
                asset_hashes: ["sha256:asset"],
                source_refs: { xhyrom_routes_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
                collected_at: "2026-05-07T00:00:00.000Z",
            },
        },
        fixtures: {
            guild: "123456789012345678",
            channels: { general: "223456789012345678" },
            notes: { private: "do-not-share" },
        },
        docsIndex: [
            {
                kind: "route",
                key: "POST /channels/{channel_id}/messages",
                refs: {
                    official_api_reference: "https://docs.discord.com/developers/reference",
                    userdoccers_reference: "https://docs.discord.food/reference",
                },
            },
            {
                kind: "gateway_event",
                key: "MESSAGE_CREATE",
                refs: {
                    official_gateway_reference: "https://docs.discord.com/developers/events/gateway",
                    userdoccers_gateway_events: "https://docs.discord.food/gateway/gateway-events",
                },
            },
        ],
    });

    assert.equal(markdown.includes("Build: canary"), true);
    assert.equal(markdown.includes("Fixtures:"), true);
    assert.equal(markdown.includes("## Step: Open general channel (open-channel)"), true);
    assert.equal(markdown.includes("- goto-channel / fixture-channel:general"), true);
    assert.equal(markdown.includes("No captured traffic."), true);
    assert.equal(markdown.includes("## Step: Send plain message (send-message)"), true);
    assert.equal(markdown.includes("- fill / role:textbox / options:name / value redacted"), true);
    assert.equal(markdown.includes("- press / keyboard / Enter"), true);
    assert.equal(markdown.includes('request sample redacted: {"content":"{redacted_string}","flags":0,"nonce":"{snowflake}"}'), true);
    assert.equal(markdown.includes('response sample redacted: {"author":{"id":"{snowflake}","username":"{redacted_string}"},"id":"{snowflake}"}'), true);
    assert.equal(markdown.includes('payload sample redacted: {"d":{"id":"{snowflake}"},"op":0,"t":"MESSAGE_CREATE"}'), true);
    assert.equal(markdown.includes("{guild_id}"), true);
    assert.equal(markdown.includes("webpack://discord/src/messages/sendMessage.ts"), true);
    assert.equal(markdown.includes("module 555555"), true);
    assert.equal(markdown.includes("context function sendMessage"), true);
    assert.equal(markdown.includes("context sha256:source-context"), true);
    assert.equal(markdown.includes("experimentId=send_message_test"), true);
    assert.equal(markdown.includes("official_api_reference: https://docs.discord.com/developers/reference"), true);
    assert.equal(markdown.includes("userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events"), true);
    assert.equal(markdown.includes("123456789012345678"), false);
    assert.equal(markdown.includes("do-not-share"), false);
});

test("builds review queue for unknown, new, sensitive, and changed traffic", () => {
    const summary: FeatureSummary = {
        run_id: "run",
        feature_id: "message.send.basic",
        traffic: [
            {
                type: "http",
                step_id: "send-message",
                method: "POST",
                route: "POST /channels/{channel_id}/messages",
                attribution: "direct",
            },
            {
                type: "http",
                step_id: "auth-touch",
                method: "POST",
                route: "POST /auth/mfa/totp",
                attribution: "probable",
            },
            {
                type: "gateway",
                step_id: "unknown-event",
                direction: "received",
                event: "NEW_GATEWAY_EVENT",
                attribution: "unknown",
            },
            {
                type: "http",
                method: "POST",
                route: "POST /science",
                request_shape: "sha256:telemetry",
                attribution: "background",
            },
            {
                type: "gateway",
                direction: "sent",
                event: "BACKGROUND_EVENT",
                payload_shape: "sha256:background",
                attribution: "background",
            },
        ],
        unknown_events: 1,
        background_events: 0,
        generated_at: "2026-05-07T00:00:00.000Z",
    };
    const changed = diffFeatureSummary(
        { ...summary, traffic: [summary.traffic[0]], unknown_events: 0 },
        { ...summary, traffic: [{ ...summary.traffic[0], request_shape: "sha256:new" }], unknown_events: 0 },
    );
    const backgroundChanged = diffFeatureSummary(
        { ...summary, traffic: [summary.traffic[3]], unknown_events: 0 },
        { ...summary, traffic: [{ ...summary.traffic[3], request_shape: "sha256:telemetry-new" }], unknown_events: 0 },
        { includeBackground: true },
    );
    const queue = buildReviewQueue({
        summaries: [summary],
        routeCatalog: [
            {
                method: "POST",
                route: "/channels/{channel_id}/messages",
                route_name: "CREATE_MESSAGE",
                source: "test",
            },
        ],
        gatewayCatalog: {
            events: [{ event: "MESSAGE_CREATE", direction: "received", source: "test" }],
            opcodes: [],
        },
        diffs: [changed, backgroundChanged],
        failures: [
            {
                run_id: "run",
                feature_id: "message.send.basic",
                stage: "runtime",
                failed_at: "2026-05-07T00:00:00.000Z",
                quarantine: true,
                redacted: true,
                error: {
                    name: "CaptureAbortError",
                    message: "rate limited",
                    abort_reason: "rate_limited",
                },
                artifacts: {},
            },
            {
                run_id: "run",
                feature_id: "message.edit.basic",
                stage: "runtime",
                failed_at: "2026-05-07T00:00:00.000Z",
                quarantine: true,
                redacted: true,
                error: {
                    name: "Error",
                    message: "scenario expectation failed",
                },
                artifacts: {},
            },
        ],
    });
    const backgroundQueue = buildReviewQueue({
        summaries: [summary],
        diffs: [backgroundChanged],
        includeBackground: true,
    });
    const customQueue = buildReviewQueue({
        summaries: [
            {
                run_id: "run",
                feature_id: "custom.feature",
                expected: {
                    http: [{ method: "POST", route: "/custom/{resource_id}", step_id: "custom-step" }],
                    gateway: [{ direction: "received", event: "CUSTOM_EVENT", step_id: "custom-step" }],
                },
                traffic: [],
                unknown_events: 0,
                background_events: 0,
                generated_at: "2026-05-07T00:00:00.000Z",
            },
        ],
    });

    assert.equal(
        queue.some((item) => item.reason === "new_route" && item.subject === "POST /auth/mfa/totp"),
        true,
    );
    assert.equal(
        queue.some((item) => item.reason === "new_route" && item.subject === "POST /science"),
        false,
    );
    assert.equal(
        queue.some((item) => item.reason === "new_gateway_event" && item.subject === "BACKGROUND_EVENT"),
        false,
    );
    assert.equal(
        queue.some((item) => item.reason === "sensitive_route"),
        true,
    );
    assert.equal(
        queue.some((item) => item.reason === "new_gateway_event"),
        true,
    );
    assert.equal(
        queue.some((item) => item.reason === "unknown_attribution"),
        true,
    );
    assert.equal(
        queue.some((item) => item.reason === "changed_signature"),
        true,
    );
    assert.equal(
        queue.some((item) => item.reason === "scenario_expectation_failed" && item.subject === "Gateway received MESSAGE_CREATE"),
        true,
    );
    assert.equal(
        queue.some((item) => item.reason === "runtime_abort"),
        true,
    );
    assert.equal(
        queue.some((item) => item.reason === "runtime_failure"),
        true,
    );
    assert.equal(
        backgroundQueue.some((item) => item.subject === "POST /science"),
        true,
    );
    assert.equal(
        backgroundQueue.some((item) => item.subject === "BACKGROUND_EVENT"),
        true,
    );
    assert.equal(
        customQueue.some((item) => item.reason === "scenario_expectation_failed" && item.subject === "POST /custom/{resource_id}"),
        true,
    );
    assert.equal(
        customQueue.some((item) => item.reason === "scenario_expectation_failed" && item.subject === "Gateway received CUSTOM_EVENT"),
        true,
    );
});

test("attaches static candidates from downloaded scripts", async () => {
    const root = await mkdtemp(join(tmpdir(), "are-static-candidates-"));
    try {
        await mkdir(join(root, "assets"), { recursive: true });
        const webSource =
            'webpackChunkdiscord_app.push([[1],{123456:(module)=>{const cfg={experimentId:"send_message_test"};api.post("/channels/"+channelId+"/messages");},789012:(module)=>{dispatch("MESSAGE_CREATE");}}]);';
        await writeFile(join(root, "assets", "web.js"), webSource, "utf8");
        await writeFile(join(root, "assets", "chunk.js"), "webpackChunkdiscord_app.push([[2],{555555:(module)=>{\nfetch(dynamicRoute);\n}}]);", "utf8");
        await writeFile(
            join(root, "assets", "chunk.js.map"),
            JSON.stringify({
                version: 3,
                file: "chunk.js",
                sourceRoot: "webpack://private@example.com/Users/local-user/discord",
                sources: ["./src/private@example.com/123456789012345678/sendMessage.ts"],
                sourcesContent: [
                    'export async function sendMessage() {\n  const token = "mfa.do-not-emit";\n  return fetch("https://discord.com/api/v9/channels/123456789012345678/messages?email=private@example.com");\n}',
                ],
                names: ["sendMessage"],
                mappings: ";AAAAA",
            }),
            "utf8",
        );
        const summary: FeatureSummary = {
            run_id: "run",
            feature_id: "message.send.basic",
            traffic: [
                {
                    type: "http",
                    step_id: "send-message",
                    method: "POST",
                    route: "POST /channels/{channel_id}/messages",
                    attribution: "direct",
                },
                {
                    type: "gateway",
                    step_id: "send-message",
                    direction: "received",
                    event: "MESSAGE_CREATE",
                    attribution: "direct",
                },
                {
                    type: "http",
                    step_id: "send-message",
                    method: "POST",
                    route: "POST /dynamic/{snowflake}/route",
                    initiator_stack_hash: "sha256:stack",
                    initiator_frames: [
                        {
                            url: "https://canary.discord.com/assets/chunk.js",
                            file_name: "chunk.js",
                            line_number: 1,
                            column_number: 1,
                        },
                    ],
                    attribution: "direct",
                },
            ],
            unknown_events: 0,
            background_events: 0,
            generated_at: "2026-05-07T00:00:00.000Z",
        };

        const annotated = await attachStaticCandidates(summary, {
            staticDir: root,
            assets: [
                {
                    url: "https://canary.discord.com/assets/web.js",
                    kind: "script",
                    file_name: "web.js",
                    local_path: "assets/web.js",
                },
                {
                    url: "https://canary.discord.com/assets/chunk.js",
                    kind: "script",
                    file_name: "chunk.js",
                    local_path: "assets/chunk.js",
                },
                {
                    url: "https://canary.discord.com/assets/chunk.js.map",
                    kind: "other",
                    file_name: "chunk.js.map",
                    local_path: "assets/chunk.js.map",
                    discovered_from: "https://canary.discord.com/assets/chunk.js",
                },
            ],
            experiments: [
                {
                    key: "experimentId",
                    value: "send_message_test",
                    source: "web.js",
                    context_hash: "sha256:experiment",
                    module_id: "123456",
                    source_offset: webSource.indexOf("experimentId"),
                },
                {
                    key: "experimentId",
                    value: "unrelated_test",
                    source: "web.js",
                    context_hash: "sha256:unrelated",
                    module_id: "999999",
                    source_offset: webSource.length - 5,
                },
            ],
        });

        assert.equal(annotated.traffic[0].static_candidates?.[0].chunk, "web.js");
        assert.equal(annotated.traffic[0].static_candidates?.[0].module_id, "123456");
        assert.equal(typeof annotated.traffic[0].static_candidates?.[0].generated_offset, "number");
        assert.equal(annotated.traffic[0].experiment_candidates?.[0].value, "send_message_test");
        assert.equal(annotated.traffic[0].experiment_candidates?.[0].confidence, "medium");
        assert.equal(annotated.traffic[0].experiment_candidates?.[0].module_id, "123456");
        assert.equal(
            annotated.traffic[0].experiment_candidates?.some((candidate) => candidate.value === "unrelated_test"),
            false,
        );
        assert.equal(annotated.traffic[1].experiment_candidates?.some((candidate) => candidate.value === "unrelated_test") ?? false, false);
        assert.equal(annotated.traffic[1].static_candidates?.[0].module_id, "789012");
        assert.equal(annotated.traffic[1].static_candidates?.[0].confidence, "high");
        assert.equal(annotated.traffic[2].static_candidates?.[0].chunk, "chunk.js");
        assert.equal(annotated.traffic[2].static_candidates?.[0].module_id, "555555");
        assert.equal(annotated.traffic[2].static_candidates?.[0].stack_hash, "sha256:stack");
        assert.equal(annotated.traffic[2].static_candidates?.[0].source_file, "webpack://{email}/.../src/{email}/{snowflake}/sendMessage.ts");
        assert.equal(annotated.traffic[2].static_candidates?.[0].source_name, "sendMessage");
        assert.equal(annotated.traffic[2].static_candidates?.[0].source_line_number, 0);
        assert.equal(annotated.traffic[2].static_candidates?.[0].source_context, "function sendMessage");
        assert.equal(annotated.traffic[2].static_candidates?.[0].source_context_hash?.startsWith("sha256:"), true);
        assert.equal(JSON.stringify(annotated).includes("mfa.do-not-emit"), false);
        assert.equal(JSON.stringify(annotated).includes("private@example.com"), false);
        assert.equal(JSON.stringify(annotated).includes("123456789012345678"), false);
        const annotatedSql = buildSqliteIndexSql({ summaries: [annotated] });
        assert.equal(annotatedSql.includes("private@example.com"), false);
        assert.equal(annotatedSql.includes("123456789012345678"), false);
        assert.equal(scanForSecrets(annotatedSql).ok, true);

        const summaryPath = join(root, "summary.json");
        const assetsPath = join(root, "assets.json");
        const experimentsPath = join(root, "experiments.catalog.json");
        const annotatedPath = join(root, "summary.static.json");
        const markdownPath = join(root, "summary.static.md");
        await writeFile(summaryPath, JSON.stringify(summary), "utf8");
        await writeFile(
            assetsPath,
            JSON.stringify([
                {
                    url: "https://canary.discord.com/assets/web.js",
                    kind: "script",
                    file_name: "web.js",
                    local_path: "assets/web.js",
                },
                {
                    url: "https://canary.discord.com/assets/chunk.js",
                    kind: "script",
                    file_name: "chunk.js",
                    local_path: "assets/chunk.js",
                },
                {
                    url: "https://canary.discord.com/assets/chunk.js.map",
                    kind: "other",
                    file_name: "chunk.js.map",
                    local_path: "assets/chunk.js.map",
                    discovered_from: "https://canary.discord.com/assets/chunk.js",
                },
            ]),
            "utf8",
        );
        await writeFile(
            experimentsPath,
            JSON.stringify([
                {
                    key: "experimentId",
                    value: "send_message_test",
                    source: "web.js",
                    context_hash: "sha256:experiment",
                    module_id: "123456",
                    source_offset: webSource.indexOf("experimentId"),
                },
            ]),
            "utf8",
        );
        await execFileAsync(process.execPath, [
            fileURLToPath(new URL("./cli.js", import.meta.url)),
            "annotate-static",
            "--summary",
            summaryPath,
            "--assets",
            assetsPath,
            "--static-dir",
            root,
            "--experiments",
            experimentsPath,
            "--out",
            annotatedPath,
            "--markdown-out",
            markdownPath,
        ]);
        const staticSummary = await readFile(annotatedPath, "utf8");
        const staticMarkdown = await readFile(markdownPath, "utf8");
        assert.equal(staticMarkdown.includes("experimentId=send_message_test"), true);
        assert.equal(staticMarkdown.includes("module 123456"), true);
        assert.equal(staticMarkdown.includes("context function sendMessage"), true);
        assert.equal(staticMarkdown.includes("mfa.do-not-emit"), false);
        assert.equal(staticMarkdown.includes("private@example.com"), false);
        assert.equal(staticMarkdown.includes("123456789012345678"), false);
        assert.equal(staticSummary.includes("mfa.do-not-emit"), false);
        assert.equal(staticSummary.includes("private@example.com"), false);
        assert.equal(staticSummary.includes("123456789012345678"), false);
        assert.equal((await auditRedactionPaths([annotatedPath, markdownPath])).ok, true);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("extracts experiment candidates and builds docs index", async () => {
    const root = await mkdtemp(join(tmpdir(), "are-experiments-"));
    try {
        await mkdir(join(root, "assets"), { recursive: true });
        await writeFile(
            join(root, "assets", "web.js"),
            'webpackChunkdiscord_app.push([[1],{777:(module)=>{const cfg={experimentId:"guild_home_test",rolloutHash:"abc123"};}}]);',
            "utf8",
        );

        const experiments = await extractExperimentCatalogFromAssets(root, [
            {
                url: "https://canary.discord.com/assets/web.js",
                kind: "script",
                file_name: "web.js",
                local_path: "assets/web.js",
            },
        ]);
        const docs = buildDocsIndex({
            routes: [
                {
                    method: "POST",
                    route: "/channels/{channel_id}/messages",
                    route_name: "CREATE_MESSAGE",
                    source: "test",
                },
            ],
            gateway: {
                events: [{ event: "MESSAGE_CREATE", direction: "received", source: "test" }],
                opcodes: [{ opcode: 0, name: "Dispatch", direction: "received", source: "test" }],
            },
        });

        assert.deepEqual(experiments.map((entry) => entry.key).sort(), ["experimentId", "rolloutHash"]);
        assert.equal(experiments[0].module_id, "777");
        assert.equal(typeof experiments[0].source_offset, "number");
        assert.equal(
            docs.some((entry) => entry.kind === "route" && entry.key === "POST /channels/{channel_id}/messages"),
            true,
        );
        assert.equal(
            docs.some((entry) => entry.kind === "gateway_event" && entry.key === "MESSAGE_CREATE"),
            true,
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("resolves GitHub source refs for third-party catalog provenance", async () => {
    const refs = await resolveGithubSourceRefs({
        refs: [
            {
                key: "xhyrom_routes_commit",
                repository: "xHyroM/discord-datamining",
                ref: "main",
            },
            {
                key: "userdoccers_commit",
                repository: "discord-userdoccers/discord-userdoccers",
                ref: "main",
            },
        ],
        fetchImpl: (async (input: string | URL | Request) => {
            const url = String(input);
            return {
                ok: true,
                status: 200,
                statusText: "OK",
                async json() {
                    return {
                        sha: url.includes("xHyroM") ? "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" : "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                    };
                },
            } as Response;
        }) as typeof fetch,
    });

    assert.deepEqual(refs, {
        xhyrom_routes_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        userdoccers_commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });
});

test("imports xHyroM route and experiment snapshots without raw override IDs", () => {
    const routes = importXhyromRouteCatalog({
        CREATE_MESSAGE: {
            url: "/channels/:param/messages",
            allowed_methods: ["OPTIONS", "POST"],
        },
        GUILD_PROFILE: {
            url: "/guilds/:param/profile/:param",
            allowed_methods: null,
        },
    });
    const experiments = importXhyromExperimentCatalog([
        {
            data: {
                kind: "guild",
                id: "2026-05_test_experiment",
                label: "Test Experiment",
                hash: 1234,
                buckets: [-1, 0, 1],
                config_keys: ["enabled"],
                description: ["Control", "Treatment"],
            },
            rollout: {
                revision: 7,
                populations: [{ buckets: {} }],
                overrides: {
                    "1": ["123456789012345678", "223456789012345678"],
                },
                overrides_formatted: [{ filters: [] }],
            },
        },
    ]);

    assert.equal(
        routes.some((entry) => entry.method === "POST" && entry.route === "/channels/{channel_id}/messages"),
        true,
    );
    assert.equal(
        routes.some((entry) => entry.route_name === "GUILD_PROFILE"),
        false,
    );
    assert.equal(experiments[0].rollout?.override_id_count, 2);
    assert.equal(experiments[0].context_hash.startsWith("sha256:"), true);
    assert.equal(JSON.stringify(experiments).includes("123456789012345678"), false);
});

test("imports Userdoccers route and Gateway MDX snapshots", () => {
    const routes = importUserdoccersRouteCatalog([
        {
            path: "resources/message.mdx",
            content: `
<RouteHeader method="GET" url="/channels/{channel.id}/messages" supportsBot>
  Get Channel Messages
</RouteHeader>
<RouteHeader
  method="POST"
  url="/channels/{channel.id}/messages"
>
  Create Message
</RouteHeader>
`,
        },
    ]);
    const gateway = importUserdoccersGatewayCatalog({
        opcodes: `
###### Gateway Opcodes

| Code | Name | Action | Description |
| ---- | ---- | ------ | ----------- |
| 0 | Dispatch | Receive | An event was dispatched |
| 1 | Heartbeat | Send/Receive | Keep alive |
| 2 | Identify | Send | Start a session |

###### Gateway Close Event Codes
`,
        gatewayEvents: `
## Dispatch Events

| Name | Description |
| ---- | ----------- |
| [Ready](#ready) | Initial state information |
| [Message Create](#message-create) | Message was created |

#### Ready
`,
    });

    assert.equal(routes.length, 2);
    assert.equal(routes[0].route, "/channels/{channel_id}/messages");
    assert.equal(routes[1].route_name, "POST_CHANNELS_CHANNEL_ID_MESSAGES");
    assert.deepEqual(
        gateway.opcodes.map((entry) => `${entry.opcode}:${entry.direction}`),
        ["0:received", "1:both", "2:sent"],
    );
    assert.equal(
        gateway.events.some((entry) => entry.event === "MESSAGE_CREATE" && entry.direction === "received"),
        true,
    );
});

test("bundles static catalogs and source refs into a run static context", async () => {
    const root = await mkdtemp(join(tmpdir(), "are-static-context-"));
    try {
        const staticDir = join(root, "run", "static");
        const catalogDir = join(root, "catalogs");
        await mkdir(staticDir, { recursive: true });
        await mkdir(catalogDir, { recursive: true });
        await writeFile(
            join(staticDir, "build.json"),
            JSON.stringify({
                run_id: "run",
                channel: "canary",
                base_url: "https://canary.discord.com",
                api_base_url: "https://discord.com/api",
                asset_hashes: [],
                source_refs: { existing: "keep" },
                collected_at: "2026-05-07T00:00:00.000Z",
            }),
            "utf8",
        );
        await writeFile(
            join(catalogDir, "routes.source.catalog.json"),
            JSON.stringify([{ method: "POST", route: "/channels/{channel_id}/messages", route_name: "CREATE_MESSAGE", source: "test" }]),
            "utf8",
        );
        await writeFile(
            join(catalogDir, "gateway.catalog.json"),
            JSON.stringify({ opcodes: [], events: [{ event: "MESSAGE_CREATE", direction: "received", source: "test" }] }),
            "utf8",
        );
        await writeFile(
            join(catalogDir, "routes.xhyrom.catalog.json"),
            JSON.stringify([{ method: "POST", route: "/channels/{channel_id}/messages", route_name: "CREATE_MESSAGE", source: "xhyrom" }]),
            "utf8",
        );
        await writeFile(join(catalogDir, "docs.index.json"), JSON.stringify([]), "utf8");

        const manifest = await bundleStaticContext({
            staticDir,
            catalogs: {
                source_routes: join(catalogDir, "routes.source.catalog.json"),
                gateway: join(catalogDir, "gateway.catalog.json"),
                xhyrom_routes: join(catalogDir, "routes.xhyrom.catalog.json"),
                docs_index: join(catalogDir, "docs.index.json"),
            },
            sourceRefs: {
                xhyrom_routes_commit: "abc123",
                userdoccers_commit: "def456",
            },
        });
        const build = JSON.parse(await readFile(join(staticDir, "build.json"), "utf8")) as {
            source_refs: Record<string, string>;
        };
        const sourceRefs = JSON.parse(await readFile(join(staticDir, "source_refs.json"), "utf8")) as Record<string, string>;

        assert.deepEqual(manifest.files.map((entry) => entry.path).sort(), ["docs.index.json", "gateway.catalog.json", "routes.source.catalog.json", "routes.xhyrom.catalog.json"]);
        assert.equal(
            manifest.files.every((entry) => entry.hash.startsWith("sha256:") && entry.bytes > 0),
            true,
        );
        assert.equal(
            manifest.files.every((entry) => !entry.source_path.startsWith("/")),
            true,
        );
        assert.equal(JSON.stringify(manifest).includes(root), false);
        assert.equal(build.source_refs.existing, "keep");
        assert.equal(build.source_refs.xhyrom_routes_commit, "abc123");
        assert.equal(sourceRefs.userdoccers_commit, "def456");
        assert.equal((await readFile(join(staticDir, "context.manifest.json"), "utf8")).includes("routes.source.catalog.json"), true);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("requires build snapshot before merging static source refs", async () => {
    const root = await mkdtemp(join(tmpdir(), "are-static-context-missing-build-"));
    try {
        const staticDir = join(root, "run", "static");
        const catalog = join(root, "routes.catalog.json");
        await mkdir(staticDir, { recursive: true });
        await writeFile(catalog, "[]", "utf8");

        await assert.rejects(
            () =>
                bundleStaticContext({
                    staticDir,
                    catalogs: { routes: catalog },
                    sourceRefs: { xhyrom_routes_commit: "abc123" },
                }),
            /build snapshot is missing/,
        );

        const manifest = await bundleStaticContext({
            staticDir,
            catalogs: { routes: catalog },
            sourceRefs: { xhyrom_routes_commit: "abc123" },
            updateBuild: false,
        });

        assert.equal(manifest.files[0].path, "routes.catalog.json");
        assert.equal((await readFile(join(staticDir, "source_refs.json"), "utf8")).includes("abc123"), true);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("keeps request step attribution for delayed HTTP responses", async () => {
    class FakeCdp implements CdpSessionLike {
        handlers = new Map<string, (payload: Record<string, unknown>) => void>();

        on(event: string, handler: (payload: Record<string, unknown>) => void): void {
            this.handlers.set(event, handler);
        }

        async send(method: string): Promise<unknown> {
            if (method === "Network.getResponseBody") {
                return { body: "{}" };
            }
            return {};
        }

        emit(event: string, payload: Record<string, unknown>): void {
            this.handlers.get(event)?.(payload);
        }
    }

    const cdp = new FakeCdp();
    const events: CaptureEvent[] = [];
    const recorder = new CdpNetworkRecorder({
        cdp,
        runId: "run",
        feature: messageSendBasic,
        onEvent(event) {
            events.push(event);
        },
    });
    await recorder.start();
    await recorder.step("send-message", "Send", async () => {
        cdp.emit("Network.requestWillBeSent", {
            requestId: "1",
            timestamp: 1,
            request: {
                method: "POST",
                url: "https://discord.com/api/v9/channels/123456789012345678/messages",
                postData: "{}",
            },
        });
    });
    cdp.emit("Network.responseReceived", {
        requestId: "1",
        response: {
            status: 200,
            url: "https://discord.com/api/v9/channels/123456789012345678/messages",
        },
    });
    cdp.emit("Network.loadingFinished", { requestId: "1", timestamp: 2 });
    await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
    });

    const response = events.find((event) => event.kind === "http.response");
    assert.equal(response?.step_id, "send-message");
});

test("drops orphan CDP loading failures without tracked API request context", async () => {
    class FakeCdp implements CdpSessionLike {
        handlers = new Map<string, (payload: Record<string, unknown>) => void>();

        on(event: string, handler: (payload: Record<string, unknown>) => void): void {
            this.handlers.set(event, handler);
        }

        async send(): Promise<unknown> {
            return {};
        }

        emit(event: string, payload: Record<string, unknown>): void {
            this.handlers.get(event)?.(payload);
        }
    }

    const cdp = new FakeCdp();
    const events: CaptureEvent[] = [];
    const recorder = new CdpNetworkRecorder({
        cdp,
        runId: "run",
        feature: messageSendBasic,
        onEvent(event) {
            events.push(event);
        },
    });
    await recorder.start();

    cdp.emit("Network.loadingFailed", {
        requestId: "orphan",
        timestamp: 1,
        errorText: "net::ERR_ABORTED",
    });
    cdp.emit("Network.requestWillBeSent", {
        requestId: "tracked",
        timestamp: 2,
        request: {
            method: "GET",
            url: "https://discord.com/api/v9/channels/123456789012345678/messages",
        },
    });
    cdp.emit("Network.loadingFailed", {
        requestId: "tracked",
        timestamp: 3,
        errorText: "net::ERR_ABORTED",
    });
    await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
    });

    const failures = events.filter((event) => event.kind === "http.failure");
    assert.equal(failures.length, 1);
    assert.equal(failures[0]?.cdp_request_id, "tracked");
    assert.equal(failures[0]?.normalized_route, "/channels/{channel_id}/messages");
});

test("enables CDP network capture with service worker bypass by default", async () => {
    class FakeCdp implements CdpSessionLike {
        commands: Array<{ method: string; params?: Record<string, unknown> }> = [];

        on(): void {}

        async send(method: string, params?: Record<string, unknown>): Promise<unknown> {
            this.commands.push({ method, params });
            return {};
        }
    }

    const cdp = new FakeCdp();
    await new CdpNetworkRecorder({
        cdp,
        runId: "run",
        feature: messageSendBasic,
        onEvent() {},
    }).start();
    assert.deepEqual(cdp.commands.slice(0, 2), [
        { method: "Network.enable", params: undefined },
        { method: "Network.setBypassServiceWorker", params: { bypass: true } },
    ]);

    const cdpWithoutBypass = new FakeCdp();
    await new CdpNetworkRecorder({
        cdp: cdpWithoutBypass,
        runId: "run",
        feature: messageSendBasic,
        bypassServiceWorker: false,
        onEvent() {},
    }).start();
    assert.deepEqual(cdpWithoutBypass.commands, [{ method: "Network.enable", params: undefined }]);
});

test("captures redacted CDP extra headers and WebSocket handshakes", async () => {
    class FakeCdp implements CdpSessionLike {
        handlers = new Map<string, (payload: Record<string, unknown>) => void>();

        on(event: string, handler: (payload: Record<string, unknown>) => void): void {
            this.handlers.set(event, handler);
        }

        async send(method: string): Promise<unknown> {
            if (method === "Network.getResponseBody") {
                return { body: "{}" };
            }
            return {};
        }

        emit(event: string, payload: Record<string, unknown>): void {
            this.handlers.get(event)?.(payload);
        }
    }

    const cdp = new FakeCdp();
    const events: CaptureEvent[] = [];
    const recorder = new CdpNetworkRecorder({
        cdp,
        runId: "run",
        feature: messageSendBasic,
        onEvent(event) {
            events.push(event);
        },
    });
    await recorder.start();
    cdp.emit("Network.requestWillBeSent", {
        requestId: "1",
        request: {
            method: "GET",
            url: "https://discord.com/api/v9/users/@me",
            headers: {
                Authorization: "Bearer secret",
                "Content-Type": "application/json",
            },
        },
        initiator: {
            type: "script",
            stack: {
                callFrames: [
                    {
                        functionName: "loadCurrentUser123456789012345678",
                        url: "https://canary.discord.com/assets/123456789012345678/web.js?token=mfa.abcdefghijklmnopqrstuvwxyz&signature=raw#frag",
                        lineNumber: 10,
                        columnNumber: 20,
                    },
                ],
            },
        },
    });
    cdp.emit("Network.requestWillBeSentExtraInfo", {
        requestId: "1",
        headers: {
            Authorization: "Bearer secret",
            Accept: "application/json",
        },
    });
    cdp.emit("Network.responseReceived", {
        requestId: "1",
        response: {
            status: 200,
            url: "https://discord.com/api/v9/users/@me",
            headers: {
                "Set-Cookie": "secret",
                "Content-Type": "application/json",
            },
        },
    });
    cdp.emit("Network.responseReceivedExtraInfo", {
        requestId: "1",
        statusCode: 200,
        headers: {
            "Set-Cookie": "secret",
            "Content-Type": "application/json",
        },
    });
    cdp.emit("Network.loadingFinished", { requestId: "1" });
    cdp.emit("Network.webSocketCreated", {
        requestId: "gateway",
        url: "wss://gateway.discord.gg/?v=9&encoding=json",
    });
    cdp.emit("Network.webSocketWillSendHandshakeRequest", {
        requestId: "gateway",
        request: {
            headers: {
                Cookie: "secret",
                Origin: "https://discord.com",
            },
        },
    });
    cdp.emit("Network.webSocketHandshakeResponseReceived", {
        requestId: "gateway",
        response: {
            status: 101,
            statusText: "Switching Protocols",
            headers: {
                "Set-Cookie": "secret",
                Upgrade: "websocket",
            },
        },
    });
    await recorder.flush();

    const request = events.find((event) => event.kind === "http.request") as Extract<CaptureEvent, { kind: "http.request" }> | undefined;
    const requestExtra = events.find((event) => event.kind === "http.request.extra_info") as { request_headers_redacted?: Record<string, string | string[]> } | undefined;
    const response = events.find((event) => event.kind === "http.response") as Extract<CaptureEvent, { kind: "http.response" }> | undefined;
    const responseExtra = events.find((event) => event.kind === "http.response.extra_info") as { status?: number } | undefined;
    const handshakeRequest = events.find((event) => event.kind === "ws.handshake.request") as { request_headers_redacted?: Record<string, string | string[]> } | undefined;
    const handshakeResponse = events.find((event) => event.kind === "ws.handshake.response") as { status?: number } | undefined;

    assert.equal(request?.request_headers_redacted?.Authorization, "{redacted}");
    assert.equal(request?.initiator?.type, "script");
    assert.equal(request?.initiator?.stack_hash?.startsWith("sha256:"), true);
    assert.equal(request?.initiator?.frames?.[0].url, "https://canary.discord.com/assets/{snowflake}/web.js");
    assert.equal(request?.initiator?.frames?.[0].file_name, "web.js");
    assert.equal(request?.initiator?.frames?.[0].function_name, "loadCurrentUser{snowflake}");
    assert.equal(JSON.stringify(request?.initiator).includes("mfa."), false);
    assert.equal(JSON.stringify(request?.initiator).includes("123456789012345678"), false);
    assert.equal(requestExtra?.request_headers_redacted?.Accept, "application/json");
    assert.equal(response?.response_headers_redacted?.["Set-Cookie"], "{redacted}");
    assert.equal(responseExtra?.status, 200);
    assert.equal(handshakeRequest?.request_headers_redacted?.Cookie, "{redacted}");
    assert.equal(handshakeResponse?.status, 101);
});

test("quarantines runtime captures on rate limits and challenge responses", async () => {
    class FakeCdp implements CdpSessionLike {
        handlers = new Map<string, (payload: Record<string, unknown>) => void>();
        bodies = new Map<string, string>();

        on(event: string, handler: (payload: Record<string, unknown>) => void): void {
            this.handlers.set(event, handler);
        }

        async send(method: string, params?: Record<string, unknown>): Promise<unknown> {
            if (method === "Network.getResponseBody") {
                return { body: this.bodies.get(String(params?.requestId)) ?? "{}" };
            }
            return {};
        }

        emit(event: string, payload: Record<string, unknown>): void {
            this.handlers.get(event)?.(payload);
        }
    }

    const root = await mkdtemp(join(tmpdir(), "are-runtime-abort-"));
    try {
        const rateLimitCdp = new FakeCdp();
        rateLimitCdp.bodies.set("rate-limit", '{"retry_after":1.25}');
        await assert.rejects(
            () =>
                runCapturedFeature({
                    runId: "run",
                    outputDir: root,
                    cdp: rateLimitCdp,
                    feature: {
                        ...messageSendBasic,
                        async run(ctx) {
                            await ctx.step("send-message", "Send", async () => {
                                rateLimitCdp.emit("Network.requestWillBeSent", {
                                    requestId: "rate-limit",
                                    request: {
                                        method: "POST",
                                        url: "https://discord.com/api/v9/channels/123456789012345678/messages",
                                    },
                                });
                                rateLimitCdp.emit("Network.responseReceived", {
                                    requestId: "rate-limit",
                                    response: {
                                        status: 429,
                                        url: "https://discord.com/api/v9/channels/123456789012345678/messages",
                                    },
                                });
                                rateLimitCdp.emit("Network.loadingFinished", { requestId: "rate-limit" });
                            });
                        },
                    },
                    fixtures: { channels: { general: "123456789012345678" } },
                }),
            (error: unknown) => error instanceof CaptureAbortError && error.reason === "rate_limited",
        );
        const rateLimitEvents = await readFile(join(root, "features", messageSendBasic.id, "events.ndjson"), "utf8");
        assert.equal(rateLimitEvents.includes('"kind":"runtime.abort"'), true);
        assert.equal(rateLimitEvents.includes('"retry_after_ms":1250'), true);
        const rateLimitFailure = JSON.parse(await readFile(join(root, "features", messageSendBasic.id, "failure.json"), "utf8")) as RuntimeFailureArtifact;
        assert.equal(rateLimitFailure.error.abort_reason, "rate_limited");
        assert.equal(rateLimitFailure.quarantine, true);

        const backgroundRateLimitCdp = new FakeCdp();
        backgroundRateLimitCdp.bodies.set("background-rate-limit", '{"retry_after":2}');
        const backgroundResult = await runCapturedFeature({
            runId: "run",
            outputDir: join(root, "background-rate-limit"),
            cdp: backgroundRateLimitCdp,
            feature: {
                ...messageSendBasic,
                async run(ctx) {
                    await ctx.step("open-channel", "Open", async () => {
                        backgroundRateLimitCdp.emit("Network.requestWillBeSent", {
                            requestId: "background-rate-limit",
                            request: {
                                method: "GET",
                                url: "https://discord.com/api/v9/users/@me/survey",
                            },
                        });
                        backgroundRateLimitCdp.emit("Network.responseReceived", {
                            requestId: "background-rate-limit",
                            response: {
                                status: 429,
                                url: "https://discord.com/api/v9/users/@me/survey",
                            },
                        });
                        backgroundRateLimitCdp.emit("Network.loadingFinished", { requestId: "background-rate-limit" });
                    });
                },
            },
            fixtures: { channels: { general: "123456789012345678" } },
        });
        const backgroundEvents = await readFile(backgroundResult.eventsPath, "utf8");
        assert.equal(backgroundEvents.includes('"status":429'), true);
        assert.equal(backgroundEvents.includes('"kind":"runtime.abort"'), false);

        const captchaCdp = new FakeCdp();
        captchaCdp.bodies.set("captcha", '{"captcha_key":["required"],"captcha_sitekey":"site"}');
        const events: CaptureEvent[] = [];
        const recorder = new CdpNetworkRecorder({
            cdp: captchaCdp,
            runId: "run",
            feature: messageSendBasic,
            onEvent(event) {
                events.push(event);
            },
        });
        await recorder.start();
        captchaCdp.emit("Network.requestWillBeSent", {
            requestId: "captcha",
            request: {
                method: "POST",
                url: "https://discord.com/api/v9/auth/login",
            },
        });
        captchaCdp.emit("Network.responseReceived", {
            requestId: "captcha",
            response: {
                status: 400,
                url: "https://discord.com/api/v9/auth/login",
            },
        });
        captchaCdp.emit("Network.loadingFinished", { requestId: "captcha" });
        await assert.rejects(
            () => recorder.flush(),
            (error: unknown) => error instanceof CaptureAbortError && error.reason === "captcha",
        );
        const abort = events.find((event): event is Extract<CaptureEvent, { kind: "runtime.abort" }> => event.kind === "runtime.abort");
        assert.equal(abort?.reason, "captcha");
        assert.equal(abort?.quarantine, true);
        assert.equal(scanForSecrets(events).ok, true);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("runs a captured feature into the planned feature artifact layout", async () => {
    class FakeCdp implements CdpSessionLike {
        handlers = new Map<string, (payload: Record<string, unknown>) => void>();

        on(event: string, handler: (payload: Record<string, unknown>) => void): void {
            this.handlers.set(event, handler);
        }

        async send(method: string): Promise<unknown> {
            if (method === "Network.getResponseBody") {
                return { body: "{}" };
            }
            return {};
        }

        emit(event: string, payload: Record<string, unknown>): void {
            this.handlers.get(event)?.(payload);
        }
    }

    const root = await mkdtemp(join(tmpdir(), "are-run-"));
    const cdp = new FakeCdp();
    try {
        const result = await runCapturedFeature({
            runId: "run",
            outputDir: root,
            feature: {
                ...messageSendBasic,
                async run(ctx) {
                    await ctx.step("send-message", "Send", async () => {
                        cdp.emit("Network.requestWillBeSent", {
                            requestId: "1",
                            timestamp: 1,
                            request: {
                                method: "POST",
                                url: "https://discord.com/api/v9/channels/123456789012345678/messages",
                                postData: "{}",
                            },
                        });
                        cdp.emit("Network.responseReceived", {
                            requestId: "1",
                            response: {
                                status: 200,
                                url: "https://discord.com/api/v9/channels/123456789012345678/messages",
                            },
                        });
                        cdp.emit("Network.loadingFinished", { requestId: "1", timestamp: 2 });
                        await ctx.expectNetwork({
                            method: "POST",
                            route: "/channels/{channel_id}/messages",
                        });
                    });
                },
            },
            cdp,
            staticSnapshot: {
                build: {
                    run_id: "run",
                    channel: "canary",
                    base_url: "https://canary.discord.com",
                    api_base_url: "https://discord.com/api",
                    x_build_id: "build-id",
                    asset_hashes: ["sha256:asset"],
                    source_refs: {},
                    collected_at: "2026-05-07T00:00:00.000Z",
                },
            },
            context: {
                async gotoChannel() {},
                async expectReady() {},
                async expectNetwork() {},
                async expectGateway() {},
            },
            fixtures: { channels: { general: "123456789012345678" } },
        });

        assert.equal(
            result.summary.traffic.some((item) => item.type === "http"),
            true,
        );
        assert.equal(result.summary.steps?.[0]?.title, "Send");
        assert.equal(result.summary.steps?.[0]?.actions?.[0]?.action, "expect-network");
        const eventsText = await readFile(result.eventsPath, "utf8");
        assert.equal(eventsText.includes('"kind":"http.request"'), true);
        assert.equal(eventsText.includes('"kind":"ui.action"'), true);
        const reportMarkdown = await readFile(result.markdownPath, "utf8");
        assert.equal(reportMarkdown.includes("# Feature:"), true);
        assert.equal(reportMarkdown.includes("## Step: Send (send-message)"), true);
        assert.equal(reportMarkdown.includes("- expect-network / POST /channels/{channel_id}/messages"), true);
        assert.equal(reportMarkdown.includes("Build: canary"), true);
        assert.equal(reportMarkdown.includes("Fixtures:"), true);
        assert.equal(reportMarkdown.includes("{channel_id}"), true);
        assert.equal(reportMarkdown.includes("123456789012345678"), false);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("provides built-in network and gateway expectation waits", async () => {
    class FakeCdp implements CdpSessionLike {
        handlers = new Map<string, (payload: Record<string, unknown>) => void>();

        on(event: string, handler: (payload: Record<string, unknown>) => void): void {
            this.handlers.set(event, handler);
        }

        async send(): Promise<unknown> {
            return {};
        }

        emit(event: string, payload: Record<string, unknown>): void {
            this.handlers.get(event)?.(payload);
        }
    }

    const root = await mkdtemp(join(tmpdir(), "are-expectations-"));
    const cdp = new FakeCdp();
    try {
        const result = await runCapturedFeature({
            runId: "run",
            outputDir: root,
            cdp,
            feature: {
                ...messageSendBasic,
                async run(ctx) {
                    await ctx.step("send-message", "Send", async () => {
                        cdp.emit("Network.requestWillBeSent", {
                            requestId: "1",
                            request: {
                                method: "POST",
                                url: "https://discord.com/api/v9/channels/123456789012345678/messages",
                                postData: "{}",
                            },
                        });
                        cdp.emit("Network.responseReceived", {
                            requestId: "1",
                            response: {
                                status: 200,
                                url: "https://discord.com/api/v9/channels/123456789012345678/messages",
                            },
                        });
                        cdp.emit("Network.loadingFinished", { requestId: "1" });
                        await ctx.expectNetwork({
                            method: "POST",
                            route: "/channels/{channel_id}/messages",
                            timeoutMs: 500,
                        });
                        cdp.emit("Network.webSocketFrameReceived", {
                            requestId: "gateway",
                            response: {
                                payloadData: '{"op":0,"t":"MESSAGE_CREATE","s":1,"d":{}}',
                            },
                        });
                        await ctx.expectGateway({
                            direction: "received",
                            event: "MESSAGE_CREATE",
                            timeoutMs: 500,
                        });
                    });
                },
            },
            fixtures: { channels: { general: "123456789012345678" } },
        });

        assert.equal(
            result.summary.traffic.some((item) => item.event === "MESSAGE_CREATE"),
            true,
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("built-in expectation waits ignore matching traffic from earlier steps", async () => {
    class FakeCdp implements CdpSessionLike {
        handlers = new Map<string, (payload: Record<string, unknown>) => void>();

        on(event: string, handler: (payload: Record<string, unknown>) => void): void {
            this.handlers.set(event, handler);
        }

        async send(method: string): Promise<unknown> {
            if (method === "Network.getResponseBody") {
                return { body: "{}" };
            }
            return {};
        }

        emit(event: string, payload: Record<string, unknown>): void {
            this.handlers.get(event)?.(payload);
        }
    }

    const root = await mkdtemp(join(tmpdir(), "are-step-expectations-"));
    const cdp = new FakeCdp();
    let settledBeforeSecondStepTraffic = false;
    try {
        await runCapturedFeature({
            runId: "run",
            outputDir: root,
            cdp,
            feature: {
                ...messageSendBasic,
                async run(ctx) {
                    await ctx.step("first-step", "First", async () => {
                        cdp.emit("Network.requestWillBeSent", {
                            requestId: "first",
                            request: {
                                method: "GET",
                                url: "https://discord.com/api/v9/channels/123456789012345678/messages",
                            },
                        });
                        cdp.emit("Network.responseReceived", {
                            requestId: "first",
                            response: {
                                status: 200,
                                url: "https://discord.com/api/v9/channels/123456789012345678/messages",
                            },
                        });
                        cdp.emit("Network.loadingFinished", { requestId: "first" });
                    });
                    await ctx.step("second-step", "Second", async () => {
                        let settled = false;
                        const wait = ctx
                            .expectNetwork({
                                method: "GET",
                                route: "/channels/{channel_id}/messages",
                                timeoutMs: 500,
                            })
                            .then(() => {
                                settled = true;
                            });
                        await new Promise<void>((resolve) => {
                            setTimeout(resolve, 0);
                        });
                        settledBeforeSecondStepTraffic = settled;
                        cdp.emit("Network.requestWillBeSent", {
                            requestId: "second",
                            request: {
                                method: "GET",
                                url: "https://discord.com/api/v9/channels/123456789012345678/messages",
                            },
                        });
                        cdp.emit("Network.responseReceived", {
                            requestId: "second",
                            response: {
                                status: 200,
                                url: "https://discord.com/api/v9/channels/123456789012345678/messages",
                            },
                        });
                        cdp.emit("Network.loadingFinished", { requestId: "second" });
                        await wait;
                    });
                },
            },
            fixtures: { channels: { general: "123456789012345678" } },
        });

        assert.equal(settledBeforeSecondStepTraffic, false);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("decodes zlib-stream Gateway frames before redaction and expectation matching", async () => {
    class FakeCdp implements CdpSessionLike {
        handlers = new Map<string, (payload: Record<string, unknown>) => void>();

        on(event: string, handler: (payload: Record<string, unknown>) => void): void {
            this.handlers.set(event, handler);
        }

        async send(): Promise<unknown> {
            return {};
        }

        emit(event: string, payload: Record<string, unknown>): void {
            this.handlers.get(event)?.(payload);
        }
    }

    const root = await mkdtemp(join(tmpdir(), "are-gateway-zlib-"));
    const cdp = new FakeCdp();
    const deflate = createDeflate({
        flush: zlibConstants.Z_SYNC_FLUSH,
        finishFlush: zlibConstants.Z_SYNC_FLUSH,
    });
    try {
        const helloFrame = await writeGatewayZlibFrame(deflate, {
            op: 10,
            t: null,
            s: null,
            d: { heartbeat_interval: 45000 },
        });
        const messageFrame = await writeGatewayZlibFrame(deflate, {
            op: 0,
            t: "MESSAGE_CREATE",
            s: 2,
            d: {
                id: "123456789012345678",
                content: "hello",
            },
        });

        const result = await runCapturedFeature({
            runId: "run",
            outputDir: root,
            cdp,
            feature: {
                ...messageSendBasic,
                async run(ctx) {
                    await ctx.step("send-message", "Send", async () => {
                        cdp.emit("Network.webSocketCreated", {
                            requestId: "gateway",
                            url: "wss://gateway.discord.gg/?compress=zlib-stream&encoding=json",
                        });
                        cdp.emit("Network.webSocketFrameReceived", {
                            requestId: "gateway",
                            response: {
                                opcode: 2,
                                payloadData: helloFrame,
                            },
                        });
                        cdp.emit("Network.webSocketFrameReceived", {
                            requestId: "gateway",
                            response: {
                                opcode: 2,
                                payloadData: messageFrame,
                            },
                        });
                        await ctx.expectGateway({
                            direction: "received",
                            event: "MESSAGE_CREATE",
                            timeoutMs: 500,
                        });
                    });
                },
            },
            fixtures: { channels: { general: "123456789012345678" } },
        });

        const eventsText = await readFile(result.eventsPath, "utf8");
        assert.equal(
            result.summary.traffic.some((item) => item.event === "MESSAGE_CREATE"),
            true,
        );
        assert.equal(eventsText.includes("MESSAGE_CREATE"), true);
        assert.equal(eventsText.includes("123456789012345678"), false);
        assert.equal(scanForSecrets(eventsText).ok, true);
    } finally {
        deflate.close();
        await rm(root, { recursive: true, force: true });
    }
});

test("runs a Playwright-shaped feature with trace, screenshots, and video artifacts", async () => {
    class FakeCdp implements CdpSessionLike {
        handlers = new Map<string, (payload: Record<string, unknown>) => void>();

        on(event: string, handler: (payload: Record<string, unknown>) => void): void {
            this.handlers.set(event, handler);
        }

        async send(method: string): Promise<unknown> {
            if (method === "Network.getResponseBody") {
                return { body: "{}" };
            }
            return {};
        }

        emit(event: string, payload: Record<string, unknown>): void {
            this.handlers.get(event)?.(payload);
        }
    }
    class FakeEmitter {
        handlers = new Map<string, Array<(...args: unknown[]) => void>>();

        on(event: string, handler: (...args: unknown[]) => void): void {
            this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
        }

        off(event: string, handler: (...args: unknown[]) => void): void {
            this.handlers.set(
                event,
                (this.handlers.get(event) ?? []).filter((entry) => entry !== handler),
            );
        }

        emit(event: string, ...args: unknown[]): void {
            for (const handler of this.handlers.get(event) ?? []) {
                handler(...args);
            }
        }
    }

    const root = await mkdtemp(join(tmpdir(), "are-playwright-run-"));
    const cdp = new FakeCdp();
    const pageEvents = new FakeEmitter();
    const page: PlaywrightPageLike = {
        on: pageEvents.on.bind(pageEvents),
        off: pageEvents.off.bind(pageEvents),
        getByRole() {
            return {
                async fill() {},
            };
        },
        keyboard: {
            async press() {},
        },
        async screenshot(options) {
            await writeFile(options.path, "png");
        },
        video() {
            return {
                async saveAs(filePath) {
                    await writeFile(filePath, "video");
                },
            };
        },
    };
    const browserContext: PlaywrightBrowserContextLike = {
        async newCDPSession() {
            return cdp;
        },
        tracing: {
            async start() {},
            async stop(options) {
                await writeFile(options.path, "trace");
            },
        },
    };

    try {
        const staticDir = join(root, "static");
        const staticSource = 'webpackChunkdiscord_app.push([[1],{123456:(module)=>{const cfg={experimentId:"send_message_test"};api.post("/channels/{channel_id}/messages");}}]);';
        await mkdir(join(staticDir, "assets"), { recursive: true });
        await writeFile(join(staticDir, "assets", "web.js"), staticSource, "utf8");

        const result = await runPlaywrightCapturedFeature({
            runId: "run",
            outputDir: root,
            feature: {
                ...messageSendBasic,
                async run(ctx) {
                    await ctx.step("send-message", "Send", async () => {
                        cdp.emit("Network.requestWillBeSent", {
                            requestId: "1",
                            timestamp: 1,
                            request: {
                                method: "POST",
                                url: "https://discord.com/api/v9/channels/123456789012345678/messages",
                                postData: "{}",
                            },
                        });
                        cdp.emit("Network.responseReceived", {
                            requestId: "1",
                            response: {
                                status: 200,
                                url: "https://discord.com/api/v9/channels/123456789012345678/messages",
                            },
                        });
                        cdp.emit("Network.loadingFinished", { requestId: "1", timestamp: 2 });
                        const playwrightRequest = {
                            url: () => "https://discord.com/api/v9/channels/123456789012345678/messages",
                            method: () => "POST",
                            headers: () => ({ Authorization: "Bearer raw-token", Accept: "application/json" }),
                            postData: () => '{"content":"hello"}',
                        };
                        pageEvents.emit("request", playwrightRequest);
                        pageEvents.emit("response", {
                            url: () => "https://discord.com/api/v9/channels/123456789012345678/messages",
                            status: () => 200,
                            headers: () => ({ "content-type": "application/json" }),
                            request: () => playwrightRequest,
                        });
                        const socket = new FakeEmitter() as FakeEmitter & { url(): string };
                        socket.url = () => "wss://gateway.discord.gg/?v=9&encoding=json";
                        pageEvents.emit("websocket", socket);
                        socket.emit("framesent", '{"op":1,"d":1}');
                        const deflate = createDeflate({
                            flush: zlibConstants.Z_SYNC_FLUSH,
                            finishFlush: zlibConstants.Z_SYNC_FLUSH,
                        });
                        try {
                            const helloFrame = await writeGatewayZlibFrame(deflate, { op: 10, t: null, s: null, d: {} });
                            const messageFrame = await writeGatewayZlibFrame(deflate, { op: 0, t: "MESSAGE_CREATE", s: 1, d: { content: "hello" } });
                            socket.emit("framereceived", Buffer.from(helloFrame, "base64"));
                            socket.emit("framereceived", Buffer.from(messageFrame, "base64"));
                        } finally {
                            deflate.close();
                        }
                        socket.emit("close");
                    });
                },
            },
            page,
            browserContext,
            captureTrace: true,
            staticCandidates: {
                staticDir,
                assets: [
                    {
                        url: "https://canary.discord.com/assets/web.js",
                        kind: "script",
                        file_name: "web.js",
                        local_path: "assets/web.js",
                    },
                ],
                experiments: [
                    {
                        key: "experimentId",
                        value: "send_message_test",
                        source: "web.js",
                        context_hash: "sha256:experiment",
                        module_id: "123456",
                        source_offset: staticSource.indexOf("experimentId"),
                    },
                ],
            },
            saveVideo: true,
            scenarioContext: {
                async gotoChannel() {},
                async expectReady() {},
                async expectNetwork() {},
                async expectGateway() {},
            },
        });

        assert.equal((await readdir(result.screenshotsDir ?? "")).length, 2);
        assert.equal(await readFile(result.tracePath ?? "", "utf8"), "trace");
        assert.equal(await readFile(result.videoPath ?? "", "utf8"), "video");
        const playwrightEvents = await readFile(result.playwrightEventsPath ?? "", "utf8");
        assert.equal(playwrightEvents.includes('"kind":"playwright.http.request"'), true);
        assert.equal(playwrightEvents.includes('"kind":"playwright.ws.frame.received"'), true);
        assert.equal(playwrightEvents.includes('"gateway_event":"MESSAGE_CREATE"'), true);
        assert.equal(playwrightEvents.includes('"Authorization":"{redacted}"'), true);
        assert.equal(playwrightEvents.includes("hello"), false);
        const playwrightHttpEvents = playwrightEvents
            .trim()
            .split("\n")
            .map((line) => JSON.parse(line) as CaptureEvent)
            .filter((event) => event.kind === "playwright.http.request" || event.kind === "playwright.http.response");
        const playwrightRequestId = playwrightHttpEvents.find((event) => event.kind === "playwright.http.request")?.playwright_request_id;
        const playwrightResponseId = playwrightHttpEvents.find((event) => event.kind === "playwright.http.response")?.playwright_request_id;
        assert.equal(playwrightRequestId, playwrightResponseId);
        assert.equal(
            result.summary.traffic.some((item) => item.type === "http"),
            true,
        );
        assert.equal(
            result.summary.traffic.some((item) => item.static_candidates?.[0]?.module_id === "123456"),
            true,
        );
        assert.equal((await readFile(result.markdownPath, "utf8")).includes("experimentId=send_message_test"), true);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("runs a Playwright runtime feature with injected browser and sanitized HAR", async () => {
    class FakeCdp implements CdpSessionLike {
        on(): void {}

        async send(): Promise<unknown> {
            return {};
        }
    }

    let navigatedUrl = "";
    let contextOptions: Record<string, unknown> = {};
    let rawHarPath = "";
    const root = await mkdtemp(join(tmpdir(), "are-playwright-runtime-"));
    const page: PlaywrightPageLike & {
        goto(url: string): Promise<void>;
        waitForLoadState(): Promise<void>;
        locator(): { first(): { waitFor(): Promise<void> } };
    } = {
        getByRole() {
            return {};
        },
        keyboard: {
            async press() {},
        },
        async screenshot(options) {
            await writeFile(options.path, "png");
        },
        async goto(url) {
            navigatedUrl = url;
        },
        async waitForLoadState() {},
        locator() {
            return {
                first() {
                    return {
                        async waitFor() {},
                    };
                },
            };
        },
    };
    const playwright = {
        chromium: {
            async launch() {
                return {
                    async newContext(options: Record<string, unknown>) {
                        contextOptions = options;
                        return {
                            async newCDPSession() {
                                return new FakeCdp();
                            },
                            async newPage() {
                                return page;
                            },
                            tracing: {
                                async start() {},
                                async stop(options: { path: string }) {
                                    await writeFile(options.path, "trace");
                                },
                            },
                            async close() {
                                const recordHar = contextOptions.recordHar;
                                if (typeof recordHar === "object" && recordHar !== null && "path" in recordHar && typeof recordHar.path === "string") {
                                    rawHarPath = recordHar.path;
                                    await writeFile(
                                        recordHar.path,
                                        JSON.stringify({
                                            log: {
                                                entries: [
                                                    {
                                                        request: {
                                                            url: "https://discord.com/api/v9/users/@me",
                                                            headers: [{ name: "Authorization", value: "Bearer raw-token" }],
                                                            cookies: [],
                                                            queryString: [],
                                                        },
                                                        response: {
                                                            headers: [],
                                                            cookies: [],
                                                            content: {},
                                                        },
                                                    },
                                                ],
                                            },
                                        }),
                                        "utf8",
                                    );
                                }
                            },
                        };
                    },
                    async close() {},
                };
            },
        },
    };

    try {
        const result = await runPlaywrightRuntimeFeature({
            runId: "run",
            outputDir: root,
            feature: idleSession,
            storageStatePath: join(root, "storage-state.json"),
            fixtures: {
                guild: "123456789012345678",
                channels: { general: "223456789012345678" },
            },
            recordHar: true,
            capturePlaywrightEvents: false,
            playwright,
        });

        assert.equal(navigatedUrl, "https://canary.discord.com/channels/123456789012345678/223456789012345678");
        assert.equal(contextOptions.storageState, join(root, "storage-state.json"));
        assert.equal(typeof contextOptions.recordVideo, "object");
        assert.equal(result.videoPath, undefined);
        assert.equal(result.tracePath, undefined);
        await assert.rejects(readFile(join(root, "features", idleSession.id, "trace.zip"), "utf8"));
        assert.equal(rawHarPath.startsWith(root), false);
        assert.equal(await readFile(result.redactedHarPath ?? "", "utf8").then((text) => text.includes("raw-token")), false);
        await assert.rejects(readFile(join(root, "features", idleSession.id, "network.raw.har"), "utf8"));
        await assert.rejects(readFile(rawHarPath, "utf8"));
        await assert.rejects(readdir(dirname(rawHarPath)));
        await assert.rejects(readFile(join(root, "features", idleSession.id, "video.webm"), "utf8"));
        assert.equal((await readFile(result.eventsPath, "utf8")).includes('"kind":"step.start"'), true);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("writes failure artifacts when Playwright runtime cleanup fails", async () => {
    class FakeCdp implements CdpSessionLike {
        on(): void {}

        async send(): Promise<unknown> {
            return {};
        }
    }

    let browserClosed = false;
    let rawHarPath = "";
    const root = await mkdtemp(join(tmpdir(), "are-playwright-runtime-cleanup-failure-"));
    const page: PlaywrightPageLike & {
        goto(url: string): Promise<void>;
        waitForLoadState(): Promise<void>;
        locator(): { first(): { waitFor(): Promise<void> } };
    } = {
        getByRole() {
            return {};
        },
        keyboard: {
            async press() {},
        },
        async screenshot(options) {
            await writeFile(options.path, "png");
        },
        async goto() {},
        async waitForLoadState() {},
        locator() {
            return {
                first() {
                    return {
                        async waitFor() {},
                    };
                },
            };
        },
    };
    const playwright = {
        chromium: {
            async launch() {
                return {
                    async newContext(options: Record<string, unknown>) {
                        const recordHar = options.recordHar;
                        if (typeof recordHar === "object" && recordHar !== null && "path" in recordHar && typeof recordHar.path === "string") {
                            rawHarPath = recordHar.path;
                        }
                        return {
                            async newCDPSession() {
                                return new FakeCdp();
                            },
                            async newPage() {
                                return page;
                            },
                            tracing: {
                                async start() {},
                                async stop(options: { path: string }) {
                                    await writeFile(options.path, "trace");
                                },
                            },
                            async close() {
                                await writeFile(
                                    rawHarPath,
                                    JSON.stringify({
                                        log: {
                                            entries: [
                                                {
                                                    request: {
                                                        url: "https://discord.com/api/v9/users/@me",
                                                        headers: [{ name: "Authorization", value: "Bearer raw-token" }],
                                                        cookies: [],
                                                        queryString: [],
                                                    },
                                                    response: { status: 200, headers: [], cookies: [], content: {} },
                                                },
                                            ],
                                        },
                                    }),
                                    "utf8",
                                );
                                throw new Error("context cleanup failed");
                            },
                        };
                    },
                    async close() {
                        browserClosed = true;
                    },
                };
            },
        },
    };

    try {
        await assert.rejects(
            () =>
                runPlaywrightRuntimeFeature({
                    runId: "run",
                    outputDir: root,
                    feature: idleSession,
                    storageStatePath: join(root, "storage-state.json"),
                    fixtures: {
                        guild: "123456789012345678",
                        channels: { general: "223456789012345678" },
                    },
                    recordHar: true,
                    capturePlaywrightEvents: false,
                    playwright,
                }),
            /context cleanup failed/,
        );

        assert.equal(browserClosed, true);
        assert.equal(rawHarPath.startsWith(root), false);
        await assert.rejects(readFile(rawHarPath, "utf8"));
        await assert.rejects(readFile(join(root, "features", idleSession.id, "network.raw.har"), "utf8"));
        await assert.rejects(readdir(join(root, "features", idleSession.id, ".video")));
        const redactedHar = await readFile(join(root, "features", idleSession.id, "network.redacted.har"), "utf8");
        assert.equal(redactedHar.includes("raw-token"), false);
        const failure = JSON.parse(await readFile(join(root, "features", idleSession.id, "failure.json"), "utf8")) as RuntimeFailureArtifact;
        assert.equal(failure.error.message, "context cleanup failed");
        assert.equal(failure.artifacts.redacted_har_path, "network.redacted.har");
        const artifacts = JSON.parse(await readFile(join(root, "features", idleSession.id, "run-artifacts.json"), "utf8")) as RuntimeRunArtifactManifest;
        assert.equal(artifacts.status, "failed");
        assert.equal(artifacts.redacted_har_path, "network.redacted.har");
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("saves Playwright runtime video only when a scenario fails by default", async () => {
    class FakeCdp implements CdpSessionLike {
        on(): void {}

        async send(): Promise<unknown> {
            return {};
        }
    }

    let contextClosed = false;
    let contextOptions: Record<string, unknown> = {};
    const root = await mkdtemp(join(tmpdir(), "are-playwright-runtime-failure-"));
    const page: PlaywrightPageLike & {
        goto(url: string): Promise<void>;
        waitForLoadState(): Promise<void>;
        locator(): { first(): { waitFor(): Promise<void> } };
    } = {
        getByRole() {
            return {};
        },
        keyboard: {
            async press() {},
        },
        async screenshot(options) {
            await writeFile(options.path, "png");
        },
        video() {
            return {
                async saveAs(filePath) {
                    assert.equal(contextClosed, true);
                    await writeFile(filePath, "failure-video");
                },
            };
        },
        async goto() {},
        async waitForLoadState() {},
        locator() {
            return {
                first() {
                    return {
                        async waitFor() {},
                    };
                },
            };
        },
    };
    const playwright = {
        chromium: {
            async launch() {
                return {
                    async newContext(options: Record<string, unknown>) {
                        contextOptions = options;
                        return {
                            async newCDPSession() {
                                return new FakeCdp();
                            },
                            async newPage() {
                                return page;
                            },
                            tracing: {
                                async start() {},
                                async stop(options: { path: string }) {
                                    await writeFile(options.path, "trace");
                                },
                            },
                            async close() {
                                contextClosed = true;
                            },
                        };
                    },
                    async close() {},
                };
            },
        },
    };

    try {
        await assert.rejects(
            () =>
                runPlaywrightRuntimeFeature({
                    runId: "run",
                    outputDir: root,
                    feature: {
                        ...idleSession,
                        async run() {
                            throw new Error("scenario failed");
                        },
                    },
                    storageStatePath: join(root, "storage-state.json"),
                    fixtures: {
                        guild: "123456789012345678",
                        channels: { general: "223456789012345678" },
                    },
                    recordHar: false,
                    capturePlaywrightEvents: false,
                    playwright,
                }),
            /scenario failed/,
        );

        assert.equal(typeof contextOptions.recordVideo, "object");
        assert.equal(await readFile(join(root, "features", idleSession.id, "video.webm"), "utf8"), "failure-video");
        const failure = JSON.parse(await readFile(join(root, "features", idleSession.id, "failure.json"), "utf8")) as RuntimeFailureArtifact;
        assert.equal(failure.quarantine, true);
        assert.equal(failure.error.message, "scenario failed");
        assert.equal(failure.artifacts.video_path, "video.webm");
        assert.equal(failure.artifacts.failure_path, "failure.json");
        assert.equal(JSON.stringify(failure).includes(root), false);
        const artifacts = JSON.parse(await readFile(join(root, "features", idleSession.id, "run-artifacts.json"), "utf8")) as RuntimeRunArtifactManifest;
        assert.equal(artifacts.status, "failed");
        assert.equal(artifacts.failure_path, "failure.json");
        assert.equal(artifacts.video_path, "video.webm");
        assert.equal(JSON.stringify(artifacts).includes(root), false);
        await assert.rejects(readdir(join(root, "features", idleSession.id, ".video")));
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
