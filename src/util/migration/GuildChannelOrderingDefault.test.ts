import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { QueryRunner } from "typeorm";
import { GuildChannelOrderingDefault1776450647002 as BetterSqliteGuildChannelOrderingDefault } from "./better-sqlite3/1776450647002-GuildChannelOrderingDefault";
import { GuildChannelOrderingDefault1776450647002 as PostgresGuildChannelOrderingDefault } from "./postgres/1776450647002-GuildChannelOrderingDefault";
import { GuildChannelOrderingDefault1776450647002 as SqliteGuildChannelOrderingDefault } from "./sqlite/1776450647002-GuildChannelOrderingDefault";

function createRecordingQueryRunner() {
    const queries: string[] = [];
    const queryRunner = {
        async query(query: string) {
            queries.push(query);
            return undefined;
        },
    } as unknown as QueryRunner;

    return { queries, queryRunner };
}

describe("GuildChannelOrderingDefault migrations", () => {
    test("repairs and enforces the Postgres channel_ordering invariant", async () => {
        const { queries, queryRunner } = createRecordingQueryRunner();

        await new PostgresGuildChannelOrderingDefault().up(queryRunner);

        assert.deepEqual(queries, [
            "UPDATE guilds SET channel_ordering = ARRAY[]::int8[] WHERE channel_ordering IS NULL;",
            "ALTER TABLE guilds ALTER COLUMN channel_ordering SET DEFAULT ARRAY[]::int8[];",
            "ALTER TABLE guilds ALTER COLUMN channel_ordering SET NOT NULL;",
        ]);
    });

    test("repairs nullable SQLite channel_ordering rows", async () => {
        const { queries, queryRunner } = createRecordingQueryRunner();

        await new SqliteGuildChannelOrderingDefault().up(queryRunner);

        assert.deepEqual(queries, ["UPDATE guilds SET channel_ordering = '' WHERE channel_ordering IS NULL;"]);
    });

    test("repairs nullable better-sqlite3 channel_ordering rows", async () => {
        const { queries, queryRunner } = createRecordingQueryRunner();

        await new BetterSqliteGuildChannelOrderingDefault().up(queryRunner);

        assert.deepEqual(queries, ["UPDATE guilds SET channel_ordering = '' WHERE channel_ordering IS NULL;"]);
    });
});
