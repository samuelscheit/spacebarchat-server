import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { QueryRunner } from "typeorm";
import { ApplicationTypeInteger1778207100000 } from "../../src/util/migration/postgres/1778207100000-ApplicationTypeInteger";
import { createDisposablePostgresDatabase, hasPostgresAdminUrl } from "../fixtures/database";

type PgQueryResult<T> = {
    rows: T[];
};

type PgClient = {
    connect(): Promise<void>;
    query<T>(sql: string): Promise<PgQueryResult<T>>;
    end(): Promise<void>;
};

type PgClientConstructor = new (options: { connectionString: string }) => PgClient;

const { Client } = require("pg") as { Client: PgClientConstructor };

function createQueryRunner() {
    const queries: string[] = [];
    const queryRunner = {
        query(sql: string) {
            queries.push(sql);
            return Promise.resolve();
        },
    } as unknown as QueryRunner;

    return { queries, queryRunner };
}

describe("ApplicationTypeInteger1778207100000", () => {
    test("converts only valid legacy jsonb application type values to nullable integers", async () => {
        const { queries, queryRunner } = createQueryRunner();

        await new ApplicationTypeInteger1778207100000().up(queryRunner);

        assert.equal(queries.length, 1);
        assert.match(queries[0], /ALTER TABLE applications ALTER COLUMN "type" TYPE integer/);
        assert.match(queries[0], /jsonb_typeof\("type"\) IN \('number', 'string'\)/);
        assert.match(queries[0], /\("type" #>> '\{\}'\) IN \('1', '2', '3', '4'\)/);
        assert.match(queries[0], /ELSE NULL/);
    });

    test("rolls back to jsonb scalar values", async () => {
        const { queries, queryRunner } = createQueryRunner();

        await new ApplicationTypeInteger1778207100000().down(queryRunner);

        assert.deepEqual(queries, [`ALTER TABLE applications ALTER COLUMN "type" TYPE jsonb USING to_jsonb("type");`]);
    });

    test(
        "normalizes representative jsonb values in Postgres",
        {
            skip: !hasPostgresAdminUrl(),
            timeout: 60_000,
        },
        async () => {
            const database = await createDisposablePostgresDatabase({ prefix: "spacebar_application_type" });
            const client = new Client({ connectionString: database.url });

            try {
                await client.connect();
                await client.query(`CREATE TABLE applications (id text PRIMARY KEY, "type" jsonb);`);
                await client.query(`INSERT INTO applications (id, "type") VALUES
                    ('decimal-number', '1.5'::jsonb),
                    ('invalid-number', '999'::jsonb),
                    ('json-object', '{"value":1}'::jsonb),
                    ('null-value', NULL),
                    ('number-game', '1'::jsonb),
                    ('number-ticketed-events', '3'::jsonb),
                    ('string-guild-role-subscriptions', '"4"'::jsonb),
                    ('string-music', '"2"'::jsonb),
                    ('string-unknown', '"unknown"'::jsonb),
                    ('zero-number', '0'::jsonb);
                `);

                const queryRunner = {
                    query(sql: string) {
                        return client.query(sql);
                    },
                } as unknown as QueryRunner;

                await new ApplicationTypeInteger1778207100000().up(queryRunner);

                const result = await client.query<{ id: string; type: number | null; pg_type: string }>(
                    `SELECT id, "type", pg_typeof("type")::text AS pg_type FROM applications ORDER BY id;`,
                );

                assert.deepEqual(Object.fromEntries(result.rows.map((row) => [row.id, row.type])), {
                    "decimal-number": null,
                    "invalid-number": null,
                    "json-object": null,
                    "null-value": null,
                    "number-game": 1,
                    "number-ticketed-events": 3,
                    "string-guild-role-subscriptions": 4,
                    "string-music": 2,
                    "string-unknown": null,
                    "zero-number": null,
                });
                assert.deepEqual([...new Set(result.rows.map((row) => row.pg_type))], ["integer"]);

                await new ApplicationTypeInteger1778207100000().down(queryRunner);

                const rolledBack = await client.query<{ id: string; type_text: string | null; json_type: string | null }>(
                    `SELECT id, "type"::text AS type_text, jsonb_typeof("type") AS json_type FROM applications ORDER BY id;`,
                );

                assert.equal(rolledBack.rows.find((row) => row.id === "number-game")?.type_text, "1");
                assert.equal(rolledBack.rows.find((row) => row.id === "number-game")?.json_type, "number");
                assert.equal(rolledBack.rows.find((row) => row.id === "invalid-number")?.type_text, null);
            } finally {
                await client.end();
                await database.close();
            }
        },
    );
});
