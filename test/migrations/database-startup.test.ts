import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { closeDatabase, initDatabase } from "@spacebar/util";
import { createDisposablePostgresDatabase, hasPostgresAdminUrl } from "../fixtures/database";
import { startApi } from "../server/startApi";

const execFileAsync = promisify(execFile);

test(
    "fresh database boot creates schema and migration rerun is idempotent",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 180_000,
    },
    async () => {
        const database = await createDisposablePostgresDatabase({ prefix: "spacebar_migration" });

        try {
            await runDatabaseBoot(database.url);
            await runDatabaseBoot(database.url);
        } finally {
            await database.close();
        }
    },
);

test(
    "APPLY_DB_MIGRATIONS=false boots against an initialized schema",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 180_000,
    },
    async () => {
        const database = await createDisposablePostgresDatabase({ prefix: "spacebar_migration_toggle" });

        try {
            await runDatabaseBoot(database.url);
            await runDatabaseBoot(database.url, { applyMigrations: false });
        } finally {
            await database.close();
        }
    },
);

test(
    "API startup reaches readiness after database initialization",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 180_000,
    },
    async () => {
        const database = await createDisposablePostgresDatabase({ prefix: "spacebar_api_startup" });
        const previous = snapshotProcessState();
        let api: Awaited<ReturnType<typeof startApi>> | undefined;

        try {
            process.env.DATABASE = database.url;
            process.env.APPLY_DB_MIGRATIONS = "true";
            process.env.LOG_ROUTES = "false";
            delete process.env.CONFIG_PATH;
            delete process.env.DB_SYNC;

            await initDatabase();
            api = await startApi();

            for (const path of ["/readyz", "/healthz", "/api/v9/-/readyz", "/api/v9/-/healthz"]) {
                const response = await fetch(`${api.baseUrl}${path}`);
                assert.equal(response.status, 200, `${path} should be ready after database initialization`);
                await response.text();
            }
        } finally {
            if (api) await api.stop();
            await closeDatabase();
            await database.close();
            restoreProcessState(previous);
        }
    },
);

test("CDN startup initializes isolated file storage", { timeout: 60_000 }, async () => {
    const storageRoot = await mkdtemp(path.join(tmpdir(), "spacebar-cdn-startup-"));

    try {
        await runCdnStorageStartup(storageRoot);
    } finally {
        await rm(storageRoot, { recursive: true, force: true });
    }
});

test(
    "Gateway startup initializes event transport and accepts websocket connections",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 180_000,
    },
    async () => {
        const database = await createDisposablePostgresDatabase({ prefix: "spacebar_gateway_startup" });
        const config = await createStartupConfig();

        try {
            await runGatewayStartup(database.url, config.path);
        } finally {
            await config.close();
            await database.close();
        }
    },
);

test(
    "WebRTC startup degrades cleanly when native media library is unavailable",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 180_000,
    },
    async () => {
        const database = await createDisposablePostgresDatabase({ prefix: "spacebar_webrtc_startup" });
        const config = await createStartupConfig();

        try {
            await runWebRtcNativeMediaStartup(database.url, config.path);
        } finally {
            await config.close();
            await database.close();
        }
    },
);

async function runDatabaseBoot(databaseUrl: string, options: { applyMigrations?: boolean } = {}) {
    const script = `
const assert = require("node:assert/strict");
const { initDatabase, closeDatabase } = require("./dist/util/util/Database.js");

const applicationCommandColumnTypeQuery = "select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = 'application_commands' and column_name in ('name_localizations', 'description_localizations') order by column_name";

(async () => {
    const database = await initDatabase();
    const [tables] = await database.query("select to_regclass('public.config') as config, to_regclass('public.migrations') as migrations, to_regclass('public.users') as users");
    assert.equal(tables.config, "config");
    assert.equal(tables.migrations, "migrations");
    assert.equal(tables.users, "users");
    assert.deepEqual(await database.query(applicationCommandColumnTypeQuery), [
        { column_name: "description_localizations", data_type: "jsonb" },
        { column_name: "name_localizations", data_type: "jsonb" },
    ]);
    await closeDatabase();
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
`;

    const env: NodeJS.ProcessEnv = {
        ...process.env,
        APPLY_DB_MIGRATIONS: options.applyMigrations === false ? "false" : "true",
        DATABASE: databaseUrl,
    };
    delete env.CONFIG_PATH;
    delete env.DB_SYNC;

    try {
        await execFileAsync(process.execPath, ["-r", "dotenv/config", "-r", "module-alias/register", "--enable-source-maps", "-e", script], {
            cwd: process.cwd(),
            env,
            maxBuffer: 10 * 1024 * 1024,
            timeout: 120_000,
        });
    } catch (error) {
        const details = childProcessErrorDetails(error);
        assert.fail(`Database boot child process failed\n${details}`);
    }
}

async function runCdnStorageStartup(storageRoot: string) {
    const script = `
const assert = require("node:assert/strict");
const path = require("node:path");
const { CDNServer, storage } = require("./dist/cdn");

(async () => {
    assert.equal(process.env.STORAGE_LOCATION, path.resolve(${JSON.stringify(storageRoot)}));
    assert.equal(await storage.exists("."), true);

    const server = new CDNServer({ serverInitLogging: false });
    await server.configureApp();
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
`;

    const env: NodeJS.ProcessEnv = {
        ...process.env,
        LOG_ROUTES: "false",
        STORAGE_LOCATION: storageRoot,
        STORAGE_PROVIDER: "file",
    };

    try {
        await execFileAsync(process.execPath, ["-r", "dotenv/config", "-r", "module-alias/register", "--enable-source-maps", "-e", script], {
            cwd: process.cwd(),
            env,
            maxBuffer: 10 * 1024 * 1024,
            timeout: 60_000,
        });
    } catch (error) {
        const details = childProcessErrorDetails(error);
        assert.fail(`CDN storage startup child process failed\n${details}`);
    }
}

async function createStartupConfig() {
    const directory = await mkdtemp(path.join(tmpdir(), "spacebar-startup-config-"));
    const configPath = path.join(directory, "config.json");
    await writeFile(
        configPath,
        JSON.stringify(
            {
                general: { serverName: "localhost" },
                api: { endpointPublic: "http://localhost:3001/api/v9" },
                cdn: {
                    endpointPublic: "http://localhost:3003",
                    endpointPrivate: "http://localhost:3003",
                },
                gateway: { endpointPublic: "ws://localhost:3002" },
            },
            null,
            2,
        ),
    );

    return {
        path: configPath,
        close: () => rm(directory, { recursive: true, force: true }),
    };
}

async function runGatewayStartup(databaseUrl: string, configPath: string) {
    const script = `
const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const WebSocket = require("ws");
const { Server } = require("./dist/gateway/Server.js");
const { closeDatabase, events } = require("./dist/util");

async function readJsonMessage(client) {
    const raw = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error("Timed out waiting for Gateway startup message"));
        }, 10000);
        const cleanup = () => {
            clearTimeout(timeout);
            client.off("message", onMessage);
            client.off("error", onError);
            client.off("close", onClose);
        };
        const onMessage = (message) => {
            cleanup();
            resolve(message);
        };
        const onError = (error) => {
            cleanup();
            reject(error);
        };
        const onClose = (code) => {
            cleanup();
            reject(new Error("Gateway closed before startup message: " + code));
        };
        client.once("message", onMessage);
        client.once("error", onError);
        client.once("close", onClose);
    });
    return JSON.parse(raw.toString());
}

async function closeClient(client) {
    if (client.readyState === WebSocket.CLOSED) return;
    await new Promise((resolve) => {
        client.once("close", () => resolve());
        client.close();
    });
}

async function closeGateway(server) {
    for (const client of server.ws.clients) client.close();
    await new Promise((resolve) => server.ws.close(() => resolve()));
    await new Promise((resolve, reject) => server.server.close((error) => error ? reject(error) : resolve()));
}

(async () => {
    const http = createServer();
    const server = new Server({ port: 0, server: http });
    await server.start();

    assert.equal(events.listenerCount("spacebar") > 0, true, "Gateway startup should initialize the event transport listener");
    assert.equal(server.server.listening, true, "Gateway HTTP server should be listening after startup");
    const address = server.server.address();
    assert(address && typeof address === "object");

    const client = new WebSocket("ws://127.0.0.1:" + address.port + "/?version=8&encoding=json", {
        headers: { "User-Agent": "spacebar-test" },
    });
    const hello = await readJsonMessage(client);
    assert.equal(hello.op, 10);

    await closeClient(client);
    await closeGateway(server);
    await closeDatabase();
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
`;

    await runStartupChild("Gateway startup child process failed", script, {
        APPLY_DB_MIGRATIONS: "true",
        CONFIG_PATH: configPath,
        CONFIG_READONLY: "true",
        DATABASE: databaseUrl,
    });
}

async function runWebRtcNativeMediaStartup(databaseUrl: string, configPath: string) {
    const script = `
const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { Server } = require("./dist/webrtc/Server.js");
const { closeDatabase, events } = require("./dist/util");

(async () => {
    const http = createServer();
    const server = new Server({ port: 0, server: http });
    await server.start();

    assert.equal(events.listenerCount("spacebar") > 0, true, "WebRTC startup should initialize the event transport before media startup");
    assert.equal(server.ws, undefined, "WebRTC websocket server should not start without a native media library");
    assert.equal(server.server.listening, false, "WebRTC HTTP server should remain stopped when media startup is disabled");

    await closeDatabase();
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
`;

    await runStartupChild("WebRTC native media startup child process failed", script, {
        APPLY_DB_MIGRATIONS: "true",
        CONFIG_PATH: configPath,
        CONFIG_READONLY: "true",
        DATABASE: databaseUrl,
        WRTC_LIBRARY: "",
    });
}

async function runStartupChild(message: string, script: string, envOverrides: Record<string, string | undefined>) {
    const env: NodeJS.ProcessEnv = {
        ...process.env,
        DB_SYNC: "",
        EVENT_SOCKET_PATH: "",
        EVENT_TRANSMISSION: "",
        LOG_ROUTES: "false",
        RABBITMQ_HOST: "",
        RABBITMQ_HOST_PATH: "",
        WRTC_LIBRARY: "",
    };
    delete env.CONFIG_PATH;
    delete env.CONFIG_READONLY;
    for (const [key, value] of Object.entries(envOverrides)) {
        if (value === undefined) delete env[key];
        else env[key] = value;
    }

    try {
        await execFileAsync(process.execPath, ["-r", "dotenv/config", "-r", "module-alias/register", "--enable-source-maps", "-e", script], {
            cwd: process.cwd(),
            env,
            maxBuffer: 10 * 1024 * 1024,
            timeout: 120_000,
        });
    } catch (error) {
        const details = childProcessErrorDetails(error);
        assert.fail(`${message}\n${details}`);
    }
}

function childProcessErrorDetails(error: unknown) {
    if (!error || typeof error !== "object") return String(error);
    const maybeOutput = error as { message?: string; stdout?: string; stderr?: string };
    return [maybeOutput.message, maybeOutput.stdout, maybeOutput.stderr].filter(Boolean).join("\n");
}

function snapshotProcessState() {
    return {
        DATABASE: process.env.DATABASE,
        APPLY_DB_MIGRATIONS: process.env.APPLY_DB_MIGRATIONS,
        CONFIG_PATH: process.env.CONFIG_PATH,
        DB_SYNC: process.env.DB_SYNC,
        LOG_ROUTES: process.env.LOG_ROUTES,
    };
}

function restoreProcessState(state: ReturnType<typeof snapshotProcessState>) {
    restoreEnv("DATABASE", state.DATABASE);
    restoreEnv("APPLY_DB_MIGRATIONS", state.APPLY_DB_MIGRATIONS);
    restoreEnv("CONFIG_PATH", state.CONFIG_PATH);
    restoreEnv("DB_SYNC", state.DB_SYNC);
    restoreEnv("LOG_ROUTES", state.LOG_ROUTES);
}

function restoreEnv(name: string, value: string | undefined) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
}
