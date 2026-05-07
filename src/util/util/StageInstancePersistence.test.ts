import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import type { QueryRunner } from "typeorm";
import { StageInstances1778043000000 } from "../migration/postgres/1778043000000-StageInstances";

test("stage instance migration uses int8 snowflake columns compatible with existing FKs", async () => {
    const queries: string[] = [];
    const migration = new StageInstances1778043000000();

    await migration.up({
        query: async (sql: string) => {
            queries.push(sql);
        },
    } as unknown as QueryRunner);

    const upSql = queries.join("\n");
    assert.match(upSql, /"id" int8 NOT NULL/);
    assert.match(upSql, /"guild_id" int8 NOT NULL/);
    assert.match(upSql, /"channel_id" int8 NOT NULL/);
    assert.match(upSql, /"guild_scheduled_event_id" int8/);
    assert.doesNotMatch(upSql, /"(?:id|guild_id|channel_id|guild_scheduled_event_id)" character varying/);
});

test("stage instance entity declares int8 snowflake relation columns", () => {
    const entitySource = readFileSync(path.join(process.cwd(), "src", "util", "entities", "StageInstance.ts"), "utf8");

    assert.match(entitySource, /@Column\(\{ type: "int8" \}\)\s+@RelationId\(\(stageInstance: StageInstance\) => stageInstance\.guild\)/);
    assert.match(entitySource, /@Column\(\{ type: "int8" \}\)\s+@RelationId\(\(stageInstance: StageInstance\) => stageInstance\.channel\)/);
    assert.match(entitySource, /@Column\(\{ type: "int8", nullable: true \}\)\s+guild_scheduled_event_id/);
});
