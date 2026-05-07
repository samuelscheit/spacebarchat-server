import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { closeDatabase, generateToken, initDatabase, User } from "@spacebar/util";
import ws from "ws";
import { createDisposablePostgresDatabase, hasPostgresAdminUrl } from "../fixtures/database";
import { startGateway } from "../server/startGateway";

const coveredManifestIds = ["gateway:opcode:2:Identify"];
type GatewayPayload = { op: number; t?: string; d?: Record<string, unknown> };

test(
    "Gateway IDENTIFY accepts a persisted user token and sends READY",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 180_000,
    },
    async () => {
        assert.deepEqual(coveredManifestIds, ["gateway:opcode:2:Identify"]);

        const database = await createDisposablePostgresDatabase({ prefix: "spacebar_gateway_identify" });
        const tempCwd = await mkdtemp(path.join(tmpdir(), "spacebar-gateway-identify-"));
        const previous = snapshotProcessState();
        let gateway: Awaited<ReturnType<typeof startGateway>> | undefined;
        let client: ws | undefined;

        try {
            process.chdir(tempCwd);
            process.env.DATABASE = database.url;
            process.env.APPLY_DB_MIGRATIONS = "true";
            delete process.env.CONFIG_PATH;
            delete process.env.DB_SYNC;
            delete process.env.EVENT_TRANSMISSION;
            delete process.env.EVENT_SOCKET_PATH;
            delete process.env.RABBITMQ_HOST;

            await initDatabase();
            const suffix = `${process.pid}${Date.now()}`;
            const user = await User.register({
                username: `gateway${suffix.slice(-8)}`,
                email: `gateway-${suffix}@example.com`,
                password: "gateway-password-fixture",
            });
            const token = await generateToken(user.id);
            assert.equal(typeof token, "string");

            gateway = await startGateway();
            client = new ws(`${gateway.url}/?version=8&encoding=json`, { headers: { "User-Agent": "spacebar-test" } });
            const hello = await readJsonMessage(client);
            assert.equal(hello.op, 10);

            client.send(
                JSON.stringify({
                    op: 2,
                    d: {
                        token,
                        intents: 0,
                        properties: {
                            os: "test",
                            browser: "spacebar-test",
                            device: "spacebar-test",
                        },
                    },
                }),
            );

            const ready = await readUntil(client, (payload) => payload.op === 0 && payload.t === "READY");
            const readyData = ready.d as { user: { id: string }; session_id: string };
            assert.equal(readyData.user.id, user.id);
            assert.equal(typeof readyData.session_id, "string");
            assert.equal(readyData.session_id.length > 0, true);
        } finally {
            if (client) {
                await closeClient(client);
                await waitForCloseHandlers();
            }
            if (gateway) await gateway.stop();
            await closeDatabase();
            await database.close();
            restoreProcessState(previous);
            await rm(tempCwd, { recursive: true, force: true });
        }
    },
);

test("Gateway IDENTIFY closes invalid tokens with authentication failure", { timeout: 30_000 }, async () => {
    const gateway = await startGateway();
    let client: ws | undefined;

    try {
        client = new ws(`${gateway.url}/?version=8&encoding=json`, { headers: { "User-Agent": "spacebar-test" } });
        const hello = await readJsonMessage(client);
        assert.equal(hello.op, 10);

        client.send(
            JSON.stringify({
                op: 2,
                d: {
                    token: "not-a-valid-jwt",
                    intents: 0,
                    properties: {
                        os: "test",
                        browser: "spacebar-test",
                        device: "spacebar-test",
                    },
                },
            }),
        );

        const close = await readClose(client);
        assert.equal(close.code, 4004);
    } finally {
        if (client) {
            await closeClient(client);
            await waitForCloseHandlers();
        }
        await gateway.stop();
    }
});

async function readUntil(client: ws, predicate: (payload: GatewayPayload) => boolean) {
    for (let i = 0; i < 5; i++) {
        const payload = await readJsonMessage(client);
        if (predicate(payload)) return payload;
    }

    assert.fail("Timed out waiting for matching gateway payload");
}

async function readJsonMessage(client: ws) {
    const raw = await new Promise<ws.RawData>((resolve, reject) => {
        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error("Timed out waiting for gateway message"));
        }, 10_000);
        const cleanup = () => {
            clearTimeout(timeout);
            client.off("message", onMessage);
            client.off("error", onError);
            client.off("close", onClose);
        };
        const onMessage = (message: ws.RawData) => {
            cleanup();
            resolve(message);
        };
        const onError = (error: Error) => {
            cleanup();
            reject(error);
        };
        const onClose = (code: number) => {
            cleanup();
            reject(new Error(`Gateway closed before message: ${code}`));
        };
        client.once("message", onMessage);
        client.once("error", onError);
        client.once("close", onClose);
    });

    return JSON.parse(raw.toString()) as GatewayPayload;
}

async function readClose(client: ws) {
    return await new Promise<{ code: number; reason: Buffer }>((resolve, reject) => {
        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error("Timed out waiting for gateway close"));
        }, 10_000);
        const cleanup = () => {
            clearTimeout(timeout);
            client.off("close", onClose);
            client.off("error", onError);
        };
        const onClose = (code: number, reason: Buffer) => {
            cleanup();
            resolve({ code, reason });
        };
        const onError = (error: Error) => {
            cleanup();
            reject(error);
        };
        client.once("close", onClose);
        client.once("error", onError);
    });
}

async function closeClient(client: ws) {
    if (client.readyState === ws.CLOSED) return;
    await new Promise<void>((resolve) => {
        client.once("close", () => resolve());
        if (client.readyState === ws.OPEN || client.readyState === ws.CONNECTING) client.close();
    });
}

async function waitForCloseHandlers() {
    await new Promise<void>((resolve) => {
        setTimeout(resolve, 100);
    });
}

function snapshotProcessState() {
    return {
        cwd: process.cwd(),
        DATABASE: process.env.DATABASE,
        APPLY_DB_MIGRATIONS: process.env.APPLY_DB_MIGRATIONS,
        CONFIG_PATH: process.env.CONFIG_PATH,
        DB_SYNC: process.env.DB_SYNC,
        EVENT_TRANSMISSION: process.env.EVENT_TRANSMISSION,
        EVENT_SOCKET_PATH: process.env.EVENT_SOCKET_PATH,
        RABBITMQ_HOST: process.env.RABBITMQ_HOST,
    };
}

function restoreProcessState(state: ReturnType<typeof snapshotProcessState>) {
    process.chdir(state.cwd);
    restoreEnv("DATABASE", state.DATABASE);
    restoreEnv("APPLY_DB_MIGRATIONS", state.APPLY_DB_MIGRATIONS);
    restoreEnv("CONFIG_PATH", state.CONFIG_PATH);
    restoreEnv("DB_SYNC", state.DB_SYNC);
    restoreEnv("EVENT_TRANSMISSION", state.EVENT_TRANSMISSION);
    restoreEnv("EVENT_SOCKET_PATH", state.EVENT_SOCKET_PATH);
    restoreEnv("RABBITMQ_HOST", state.RABBITMQ_HOST);
}

function restoreEnv(name: string, value: string | undefined) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
}
