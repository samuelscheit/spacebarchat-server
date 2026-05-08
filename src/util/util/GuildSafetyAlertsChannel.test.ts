import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { getMetadataArgsStorage, type QueryRunner } from "typeorm";
import { GuildSafetyAlertsChannel1778209700000 } from "../migration/postgres/1778209700000-GuildSafetyAlertsChannel";

test("guild entity persists safety alerts channel as a nullable channel relation", async () => {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar";
    const { Guild } = await import("../entities/Guild.js");
    const storage = getMetadataArgsStorage();

    const column = storage.columns.find((x) => x.target === Guild && x.propertyName === "safety_alerts_channel_id");
    assert.equal(column?.options.type, "int8");
    assert.equal(column?.options.nullable, true);

    const relation = storage.relations.find((x) => x.target === Guild && x.propertyName === "safety_alerts_channel");
    assert.equal(relation?.relationType, "many-to-one");

    const joinColumn = storage.joinColumns.find((x) => x.target === Guild && x.propertyName === "safety_alerts_channel");
    assert.equal(joinColumn?.name, "safety_alerts_channel_id");

    const relationId = storage.relationIds.find((x) => x.target === Guild && x.propertyName === "safety_alerts_channel_id");
    assert.ok(relationId);
});

test("guild safety alerts channel migration adds nullable int8 channel foreign key", async () => {
    const queries: string[] = [];
    const migration = new GuildSafetyAlertsChannel1778209700000();

    await migration.up({
        query: async (sql: string) => {
            queries.push(sql);
        },
    } as unknown as QueryRunner);

    assert.deepEqual(queries, [
        `ALTER TABLE guilds ADD safety_alerts_channel_id int8`,
        `ALTER TABLE guilds ADD CONSTRAINT "FK_98f612b904dddc6b5b2f848aa42" FOREIGN KEY (safety_alerts_channel_id) REFERENCES channels(id)`,
    ]);
});

test("guild safety alerts channel migration removes the foreign key before the column on rollback", async () => {
    const queries: string[] = [];
    const migration = new GuildSafetyAlertsChannel1778209700000();

    await migration.down({
        query: async (sql: string) => {
            queries.push(sql);
        },
    } as unknown as QueryRunner);

    assert.deepEqual(queries, [
        `ALTER TABLE guilds DROP CONSTRAINT "FK_98f612b904dddc6b5b2f848aa42"`,
        `ALTER TABLE guilds DROP COLUMN safety_alerts_channel_id`,
    ]);
});

test("postgres initial DDL leaves safety alerts channel to the ordered migration", () => {
    const initialSource = readFileSync(path.join(process.cwd(), "src", "util", "migration", "postgres-initial.ts"), "utf8");

    assert.doesNotMatch(initialSource, /safety_alerts_channel_id/);
});

test("guild update route validates non-null safety alerts channel ids", () => {
    const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "guilds", "#guild_id", "index.ts"), "utf8");

    assert.match(routeSource, /if \(body\.safety_alerts_channel_id != undefined\)/);
    assert.match(routeSource, /if \(body\.safety_alerts_channel_id !== null\)/);
    assert.match(routeSource, /where: \{ guild_id, id: body\.safety_alerts_channel_id \}/);
});
