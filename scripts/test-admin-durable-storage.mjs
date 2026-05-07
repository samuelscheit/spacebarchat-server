#!/usr/bin/env node
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import process from "node:process";
import pg from "pg";

const { Client } = pg;

function quoteIdentifier(identifier) {
    return `"${identifier.replaceAll('"', '""')}"`;
}

function testDatabaseName() {
    return `spacebar_admin_durable_${process.pid}_${randomUUID().replaceAll("-", "")}`.slice(0, 63);
}

function databaseUrlForName(baseUrl, name) {
    const url = new URL(baseUrl);
    url.pathname = `/${name}`;
    return url.toString();
}

async function run(command, args, env) {
    return new Promise((resolve) => {
        const child = spawn(command, args, {
            env,
            stdio: "inherit",
        });
        child.on("exit", (code, signal) => {
            resolve(signal ? 1 : (code ?? 1));
        });
    });
}

const adminDatabaseUrl = process.env.ADMIN_DURABLE_TEST_ADMIN_DATABASE_URL ?? "postgres://user:password@127.0.0.1:5432/postgres";
const dbName = testDatabaseName();
const testDatabaseUrl = databaseUrlForName(adminDatabaseUrl, dbName);
const client = new Client({ connectionString: adminDatabaseUrl });

let exitCode = 1;
try {
    await client.connect();
    await client.query(`CREATE DATABASE ${quoteIdentifier(dbName)}`);
    exitCode = await run(process.execPath, ["-r", "dotenv/config", "-r", "module-alias/register", "--enable-source-maps", "--test", "dist/admin/durableStorage.test.js"], {
        ...process.env,
        ADMIN_DURABLE_TEST_DATABASE: testDatabaseUrl,
    });
} finally {
    try {
        await client.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`, [dbName]);
        await client.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(dbName)}`);
    } finally {
        await client.end().catch(() => {});
    }
}

process.exit(exitCode);
