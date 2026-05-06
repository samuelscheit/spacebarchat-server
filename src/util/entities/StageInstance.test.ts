import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const migrationSource = readFileSync(path.join(process.cwd(), "src", "util", "migration", "postgres", "1778043000000-StageInstances.ts"), "utf8");
const entitySource = readFileSync(path.join(process.cwd(), "src", "util", "entities", "StageInstance.ts"), "utf8");

test("stage instance migration uses int8 snowflake columns compatible with existing FKs", () => {
    assert.match(migrationSource, /"id" int8 NOT NULL/);
    assert.match(migrationSource, /"guild_id" int8 NOT NULL/);
    assert.match(migrationSource, /"channel_id" int8 NOT NULL/);
    assert.match(migrationSource, /"guild_scheduled_event_id" int8/);
    assert.doesNotMatch(migrationSource, /"(?:id|guild_id|channel_id|guild_scheduled_event_id)" character varying/);
});

test("stage instance entity declares int8 snowflake relation columns", () => {
    assert.match(entitySource, /@Column\(\{ type: "int8" \}\)\s+@RelationId\(\(stageInstance: StageInstance\) => stageInstance\.guild\)/);
    assert.match(entitySource, /@Column\(\{ type: "int8" \}\)\s+@RelationId\(\(stageInstance: StageInstance\) => stageInstance\.channel\)/);
    assert.match(entitySource, /@Column\(\{ type: "int8", nullable: true \}\)\s+guild_scheduled_event_id/);
});
