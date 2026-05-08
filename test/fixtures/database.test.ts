import assert from "node:assert/strict";
import { test } from "node:test";
import { createDisposablePostgresDatabase, hasPostgresAdminUrl } from "./database";

type PgResult = { rows: { name?: string }[]; rowCount: number | null };
type PgClient = {
    connect(): Promise<void>;
    query(sql: string, values?: unknown[]): Promise<PgResult>;
    end(): Promise<void>;
};
type PgClientConstructor = new (options: { connectionString: string }) => PgClient;

const { Client } = require("pg") as { Client: PgClientConstructor };

test("createDisposablePostgresDatabase creates and drops an isolated database", { skip: !hasPostgresAdminUrl() }, async () => {
    const database = await createDisposablePostgresDatabase();
    const client = new Client({ connectionString: database.url });

    try {
        await client.connect();
        const result = await client.query("select current_database() as name");
        assert.equal(result.rows[0].name, database.name);
    } finally {
        await client.end();
        await database.close();
    }

    const admin = new Client({ connectionString: database.adminUrl });
    try {
        await admin.connect();
        const result = await admin.query("select 1 from pg_database where datname = $1", [database.name]);
        assert.equal(result.rowCount, 0);
    } finally {
        await admin.end();
    }
});
