#!/usr/bin/env node
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const basePath = "/_spacebar/admin";
const apiPath = `${basePath}/api`;
const operatorToken = "operator-token";
const artifactDir = process.env.ADMIN_DASHBOARD_E2E_ARTIFACT_DIR ?? path.join("tmp", "admin-dashboard-e2e");
const chromePath = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const timeoutMs = Number(process.env.ADMIN_DASHBOARD_E2E_TIMEOUT_MS ?? 20_000);

function pageResult(items, { limit = 50, offset = 0, total = items.length } = {}) {
    return {
        items,
        pagination: { limit, offset, total },
    };
}

function json(res, status, body) {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
}

async function readJson(req) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    if (chunks.length === 0) return {};
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function requireOperator(req, res) {
    const authorization = req.headers.authorization;
    if (!authorization) {
        json(res, 401, { message: "Missing admin token" });
        return false;
    }
    if (authorization !== `Bearer ${operatorToken}`) {
        json(res, 403, { message: "OPERATOR rights are required" });
        return false;
    }
    return true;
}

function adminUser() {
    return {
        id: "100",
        username: "operator",
        discriminator: "0001",
        avatar: null,
        pronouns: null,
        premium: false,
        premiumType: 0,
        bot: false,
        system: false,
        createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
        disabled: false,
        deleted: false,
        rights: "OPERATOR",
        email: "operator@example.invalid",
        phone: null,
        desktop: false,
        mobile: false,
        nsfwAllowed: true,
        mfaEnabled: true,
        webauthnEnabled: false,
        verified: true,
        counts: {},
    };
}

function createMockAdminApi() {
    const jobs = [
        {
            id: "job-existing",
            type: "cdn.attachments.fsck",
            status: "succeeded",
            input: { dryRun: true },
            result: { checked: 2, missing: 0 },
            progress: { current: 2, total: 2, label: "Complete" },
            errors: [],
            cancelRequested: false,
            idempotencyKey: "existing",
            createdBy: "100",
            createdAt: new Date("2026-01-02T00:00:00.000Z").toISOString(),
            updatedAt: new Date("2026-01-02T00:01:00.000Z").toISOString(),
            startedAt: new Date("2026-01-02T00:00:00.000Z").toISOString(),
            completedAt: new Date("2026-01-02T00:01:00.000Z").toISOString(),
        },
    ];
    const activity = [];
    const dryRunMigrations = [];

    const server = http.createServer(async (req, res) => {
        try {
            const url = new URL(req.url ?? "/", "http://127.0.0.1");
            const route = url.pathname;

            if (!route.startsWith(apiPath)) {
                json(res, 404, { message: "not found" });
                return;
            }

            if (route === `${apiPath}/ping`) {
                json(res, 200, { ping: "pong!" });
                return;
            }

            if (!requireOperator(req, res)) return;

            if (route === `${apiPath}/whoami`) {
                json(res, 200, { user: adminUser(), sessionId: "session-e2e", operator: true });
                return;
            }

            if (route === `${apiPath}/users`) {
                json(
                    res,
                    200,
                    pageResult([
                        {
                            id: "200",
                            username: "Ada Lovelace",
                            discriminator: "0001",
                            avatar: null,
                            pronouns: null,
                            premium: false,
                            premiumType: 0,
                            bot: false,
                            system: false,
                            createdAt: new Date("2026-02-01T00:00:00.000Z").toISOString(),
                            disabled: false,
                            deleted: false,
                            rights: "0",
                        },
                    ]),
                );
                return;
            }

            if (route === `${apiPath}/guilds`) {
                json(
                    res,
                    200,
                    pageResult([
                        {
                            id: "300",
                            name: "E2E Guild",
                            icon: null,
                            description: "Mock guild",
                            ownerId: "200",
                            features: [],
                            memberCount: 1,
                            presenceCount: 1,
                            preferredLocale: "en-US",
                            premiumTier: 0,
                            discoveryWeight: 0,
                            discoveryExcluded: false,
                        },
                    ]),
                );
                return;
            }

            if (route === `${apiPath}/media/stickers`) {
                json(
                    res,
                    200,
                    pageResult([
                        {
                            id: "sticker-1",
                            name: "Ship It",
                            description: "mock sticker",
                            available: true,
                            tags: "ship",
                            packId: null,
                            guildId: "300",
                            userId: "200",
                            type: 1,
                            formatType: 1,
                        },
                    ]),
                );
                return;
            }

            if (route === `${apiPath}/configuration`) {
                json(res, 200, { source: "database", path: null, readonly: false, values: { e2e: true } });
                return;
            }

            if (route === `${apiPath}/jobs`) {
                json(res, 200, pageResult(jobs, { total: jobs.length }));
                return;
            }

            if (route === `${apiPath}/activity`) {
                json(res, 200, pageResult(activity, { total: activity.length }));
                return;
            }

            if (route === `${apiPath}/media/attachments/migrate` && req.method === "POST") {
                const body = await readJson(req);
                if (body.dryRun !== true || body.force === true) {
                    json(res, 400, { message: "E2E migration must remain a dry run" });
                    return;
                }

                const id = `job-${randomUUID()}`;
                const job = {
                    id,
                    type: "cdn.attachments.migrate",
                    status: "queued",
                    input: body,
                    result: null,
                    progress: { current: 0, total: null, label: "Queued" },
                    errors: [],
                    cancelRequested: false,
                    idempotencyKey: req.headers["idempotency-key"] ?? null,
                    createdBy: "100",
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    startedAt: null,
                    completedAt: null,
                };
                jobs.unshift(job);
                dryRunMigrations.push({ body, authorization: req.headers.authorization });
                activity.unshift({
                    id: `audit-${randomUUID()}`,
                    action: "cdn.attachments.migrate",
                    actorId: "100",
                    targetType: "cdn",
                    targetId: "attachments",
                    status: "accepted",
                    severity: "info",
                    metadata: { dryRun: true, reason: body.reason },
                    reason: body.reason,
                    jobId: id,
                    createdAt: new Date().toISOString(),
                });
                json(res, 202, job);
                return;
            }

            json(res, 404, { message: `Unhandled mock route ${req.method} ${route}` });
        } catch (error) {
            json(res, 500, { message: error instanceof Error ? error.message : String(error) });
        }
    });

    return { server, dryRunMigrations };
}

async function freePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.on("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            server.close(() => {
                if (address && typeof address === "object") resolve(address.port);
                else reject(new Error("Could not allocate a port"));
            });
        });
    });
}

async function waitFor(condition, label) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        const value = await condition();
        if (value) return value;
        await new Promise((resolve) => {
            setTimeout(resolve, 100);
        });
    }
    throw new Error(`Timed out waiting for ${label}`);
}

async function waitForHttpOk(url) {
    await waitFor(async () => {
        try {
            const response = await fetch(url);
            return response.ok;
        } catch {
            return false;
        }
    }, url);
}

async function stopProcess(child) {
    if (child.exitCode !== null || child.signalCode) return;

    await new Promise((resolve) => {
        const killTimer = setTimeout(() => {
            child.kill("SIGKILL");
        }, 2000);
        killTimer.unref?.();
        child.once("exit", () => {
            clearTimeout(killTimer);
            resolve();
        });
        child.kill("SIGTERM");
    });
}

class CdpClient {
    constructor(wsUrl) {
        this.id = 0;
        this.pending = new Map();
        this.listeners = new Map();
        this.ws = new WebSocket(wsUrl);
        this.ws.addEventListener("message", (event) => this.handleMessage(event.data));
    }

    async open() {
        if (this.ws.readyState === WebSocket.OPEN) return;
        await new Promise((resolve, reject) => {
            this.ws.addEventListener("open", resolve, { once: true });
            this.ws.addEventListener("error", reject, { once: true });
        });
    }

    handleMessage(data) {
        const message = JSON.parse(String(data));
        if (message.id && this.pending.has(message.id)) {
            const { resolve, reject } = this.pending.get(message.id);
            this.pending.delete(message.id);
            if (message.error) reject(new Error(message.error.message));
            else resolve(message.result);
            return;
        }

        const waiters = this.listeners.get(message.method) ?? [];
        this.listeners.set(
            message.method,
            waiters.filter((waiter) => {
                if (!waiter.sessionId || waiter.sessionId === message.sessionId) {
                    waiter.resolve(message);
                    return false;
                }
                return true;
            }),
        );
    }

    send(method, params = {}, sessionId) {
        const id = ++this.id;
        const payload = { id, method, params };
        if (sessionId) payload.sessionId = sessionId;

        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            this.ws.send(JSON.stringify(payload));
        });
    }

    waitForEvent(method, sessionId) {
        return new Promise((resolve) => {
            const waiters = this.listeners.get(method) ?? [];
            waiters.push({ sessionId, resolve });
            this.listeners.set(method, waiters);
        });
    }

    close() {
        this.ws.close();
    }
}

async function connectChrome(debugPort) {
    const version = await waitFor(async () => {
        try {
            const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
            return response.ok ? response.json() : false;
        } catch {
            return false;
        }
    }, "Chrome DevTools endpoint");

    const cdp = new CdpClient(version.webSocketDebuggerUrl);
    await cdp.open();
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send("Runtime.enable", {}, sessionId);
    await cdp.send("Network.enable", {}, sessionId);
    await cdp.send(
        "Emulation.setDeviceMetricsOverride",
        {
            width: 1440,
            height: 1000,
            deviceScaleFactor: 1,
            mobile: false,
        },
        sessionId,
    );

    return { cdp, sessionId };
}

async function navigate(cdp, sessionId, url) {
    const loaded = cdp.waitForEvent("Page.loadEventFired", sessionId);
    await cdp.send("Page.navigate", { url }, sessionId);
    await loaded;
}

async function evaluate(cdp, sessionId, expression) {
    const result = await cdp.send(
        "Runtime.evaluate",
        {
            expression,
            awaitPromise: true,
            returnByValue: true,
        },
        sessionId,
    );
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
}

async function waitForText(cdp, sessionId, text) {
    try {
        await waitFor(() => evaluate(cdp, sessionId, `document.body && document.body.innerText.includes(${JSON.stringify(text)})`), `text ${text}`);
    } catch (error) {
        const diagnostic = await evaluate(
            cdp,
            sessionId,
            `({ href: location.href, text: document.body ? document.body.innerText.slice(0, 800) : "" })`,
        );
        throw new Error(`${error instanceof Error ? error.message : String(error)} at ${diagnostic.href}\n${diagnostic.text}`);
    }
}

async function screenshot(cdp, sessionId, name) {
    const result = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }, sessionId);
    const file = path.join(artifactDir, `${name}.png`);
    await writeFile(file, Buffer.from(result.data, "base64"));
    return file;
}

async function main() {
    const apiPort = await freePort();
    const dashboardPort = await freePort();
    const debugPort = await freePort();
    const chromeProfile = await mkdtemp(path.join(os.tmpdir(), "spacebar-admin-e2e-chrome-"));
    await mkdir(artifactDir, { recursive: true });

    const mockApi = createMockAdminApi();
    await new Promise((resolve) => mockApi.server.listen(apiPort, "127.0.0.1", resolve));

    const dashboardUrl = `http://127.0.0.1:${dashboardPort}${basePath}`;
    const dashboard = spawn("npm", ["run", "start", "--workspace", "apps/admin-dashboard"], {
        env: {
            ...process.env,
            HOSTNAME: "127.0.0.1",
            PORT: String(dashboardPort),
            SPACEBAR_ADMIN_API_URL: `http://127.0.0.1:${apiPort}${apiPath}`,
            SPACEBAR_ADMIN_COOKIE_SECURE: "false",
            SPACEBAR_ADMIN_API_TIMEOUT_MS: "5000",
        },
        stdio: ["ignore", "pipe", "pipe"],
    });

    const chrome = spawn(
        chromePath,
        [
            "--headless=new",
            `--remote-debugging-port=${debugPort}`,
            `--user-data-dir=${chromeProfile}`,
            "--disable-gpu",
            "--no-first-run",
            "--no-default-browser-check",
            "about:blank",
        ],
        { stdio: ["ignore", "ignore", "ignore"] },
    );

    let cdp;
    try {
        await waitForHttpOk(`${dashboardUrl}/health`);
        const connected = await connectChrome(debugPort);
        cdp = connected.cdp;
        const { sessionId } = connected;

        await navigate(cdp, sessionId, `${dashboardUrl}/login`);
        await waitForText(cdp, sessionId, "Spacebar Admin");
        await screenshot(cdp, sessionId, "01-login");

        await evaluate(
            cdp,
            sessionId,
            `(() => {
                const token = document.querySelector('textarea[name="token"]');
                token.value = ${JSON.stringify(operatorToken)};
                token.dispatchEvent(new Event("input", { bubbles: true }));
                document.querySelector("form").requestSubmit();
                return true;
            })()`,
        );
        await waitForText(cdp, sessionId, "Overview");
        await screenshot(cdp, sessionId, "02-overview");

        await navigate(cdp, sessionId, `${dashboardUrl}/users`);
        await waitForText(cdp, sessionId, "Ada Lovelace");
        await screenshot(cdp, sessionId, "03-users");

        await navigate(cdp, sessionId, `${dashboardUrl}/jobs`);
        await waitForText(cdp, sessionId, "Job Queue");
        await screenshot(cdp, sessionId, "04-jobs-before");

        await navigate(cdp, sessionId, `${dashboardUrl}/media`);
        await waitForText(cdp, sessionId, "Attachment Jobs");
        await evaluate(
            cdp,
            sessionId,
            `(() => {
                const forms = Array.from(document.querySelectorAll("form"));
                const form = forms.find((candidate) => candidate.innerText.includes("Start Migration"));
                if (!form) throw new Error("Migration form not found");
                form.querySelector('input[name="dryRun"]').checked = true;
                form.querySelector('input[name="force"]').checked = false;
                form.querySelector('input[name="reason"]').value = "E2E dry-run smoke";
                form.querySelector('input[name="confirmation"]').value = "MIGRATE ATTACHMENTS";
                form.requestSubmit();
                return true;
            })()`,
        );
        await waitFor(() => mockApi.dryRunMigrations.length === 1, "dry-run migration submission");
        if (mockApi.dryRunMigrations[0].authorization !== `Bearer ${operatorToken}`) {
            throw new Error("Dashboard server action did not forward the admin authorization header");
        }
        await screenshot(cdp, sessionId, "05-media");

        await navigate(cdp, sessionId, `${dashboardUrl}/jobs`);
        await waitForText(cdp, sessionId, "cdn.attachments.migrate");
        await screenshot(cdp, sessionId, "06-jobs-after");

        console.log(`admin dashboard e2e ok: ${dashboardUrl}`);
        console.log(`screenshots: ${artifactDir}`);
    } finally {
        cdp?.close();
        await Promise.all([
            stopProcess(chrome),
            stopProcess(dashboard),
            new Promise((resolve) => {
                mockApi.server.close(resolve);
            }),
        ]);
        await rm(chromeProfile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
}

main().catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : error);
    process.exit(1);
});
