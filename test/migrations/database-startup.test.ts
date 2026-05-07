import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
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

async function runDatabaseBoot(databaseUrl: string, options: { applyMigrations?: boolean } = {}) {
    const script = `
const assert = require("node:assert/strict");
const { initDatabase, closeDatabase } = require("./dist/util/util/Database.js");

(async () => {
    const database = await initDatabase();
    const [tables] = await database.query("select to_regclass('public.config') as config, to_regclass('public.migrations') as migrations, to_regclass('public.users') as users");
    assert.equal(tables.config, "config");
    assert.equal(tables.migrations, "migrations");
    assert.equal(tables.users, "users");
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
