import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { test } from "node:test";
import { promisify } from "node:util";
import { createDisposablePostgresDatabase, hasPostgresAdminUrl } from "../fixtures/database";

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

async function runDatabaseBoot(databaseUrl: string) {
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
        APPLY_DB_MIGRATIONS: "true",
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

function childProcessErrorDetails(error: unknown) {
    if (!error || typeof error !== "object") return String(error);
    const maybeOutput = error as { message?: string; stdout?: string; stderr?: string };
    return [maybeOutput.message, maybeOutput.stdout, maybeOutput.stderr].filter(Boolean).join("\n");
}
