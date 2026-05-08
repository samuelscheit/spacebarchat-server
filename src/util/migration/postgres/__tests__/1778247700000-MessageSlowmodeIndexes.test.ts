import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { QueryRunner } from "typeorm";
import { MessageSlowmodeIndexes1778247700000 } from "../1778247700000-MessageSlowmodeIndexes";

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
    test("adds indexes for channel message rate checks", async () => {
        const migration = new MessageSlowmodeIndexes1778247700000();
        const { queries, queryRunner } = createQueryRunner();

        await migration.up(queryRunner);

        assert.deepEqual(queries, [
            `CREATE INDEX "IDX_messages_channel_timestamp" ON "messages" ("channel_id", "timestamp")`,
            `CREATE INDEX "IDX_messages_channel_author_timestamp" ON "messages" ("channel_id", "author_id", "timestamp")`,
        ]);
    });

    test("drops message rate indexes on rollback", async () => {
        const migration = new MessageSlowmodeIndexes1778247700000();
        const { queries, queryRunner } = createQueryRunner();

        await migration.down(queryRunner);

        assert.deepEqual(queries, [
            `DROP INDEX "IDX_messages_channel_author_timestamp"`,
            `DROP INDEX "IDX_messages_channel_timestamp"`,
        ]);
    });
});
