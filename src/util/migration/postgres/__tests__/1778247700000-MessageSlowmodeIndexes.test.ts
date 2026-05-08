import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { QueryRunner } from "typeorm";
import { initial0 } from "../../postgres-initial";
import { MessageSlowmodeIndexes1778247700000 } from "../1778247700000-MessageSlowmodeIndexes";

const messageSlowmodeIndexNames = ["IDX_messages_channel_timestamp", "IDX_messages_channel_author_timestamp"];

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

describe("MessageSlowmodeIndexes1778247700000", () => {
    test("keeps fresh initial DDL from pre-creating migration-owned indexes", async () => {
        const { queries, queryRunner } = createQueryRunner();

        await new initial0().up(queryRunner);

        assert.deepEqual(
            queries.filter((query) => messageSlowmodeIndexNames.some((indexName) => query.includes(indexName))),
            [],
        );
    });

    test("adds indexes for channel message rate checks", async () => {
        const migration = new MessageSlowmodeIndexes1778247700000();
        const { queries, queryRunner } = createQueryRunner();

        await migration.up(queryRunner);

        assert.deepEqual(queries, [
            `CREATE INDEX IF NOT EXISTS "IDX_messages_channel_timestamp" ON "messages" ("channel_id", "timestamp")`,
            `CREATE INDEX IF NOT EXISTS "IDX_messages_channel_author_timestamp" ON "messages" ("channel_id", "author_id", "timestamp")`,
        ]);
    });

    test("drops message rate indexes on rollback", async () => {
        const migration = new MessageSlowmodeIndexes1778247700000();
        const { queries, queryRunner } = createQueryRunner();

        await migration.down(queryRunner);

        assert.deepEqual(queries, [`DROP INDEX IF EXISTS "IDX_messages_channel_author_timestamp"`, `DROP INDEX IF EXISTS "IDX_messages_channel_timestamp"`]);
    });
});
