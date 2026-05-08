import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import type { QueryRunner } from "typeorm";
import { GuildProfileTag1778216900000 } from "../migration/postgres/1778216900000-GuildProfileTag";

test("guild profile tag migration adds and removes a nullable 4-character column", async () => {
    const queries: string[] = [];
    const migration = new GuildProfileTag1778216900000();
    const queryRunner = {
        query: async (sql: string) => {
            queries.push(sql);
        },
    } as unknown as QueryRunner;

    await migration.up(queryRunner);
    await migration.down(queryRunner);

    assert.equal(queries[0], `ALTER TABLE "guilds" ADD "profile_tag" character varying(4)`);
    assert.equal(queries[1], `ALTER TABLE "guilds" DROP COLUMN "profile_tag"`);
});

test("guild entity and initial postgres DDL include the custom profile tag column", () => {
    const entitySource = readFileSync(path.join(process.cwd(), "src", "util", "entities", "Guild.ts"), "utf8");
    const initialMigrationSource = readFileSync(path.join(process.cwd(), "src", "util", "migration", "postgres-initial.ts"), "utf8");

    assert.match(entitySource, /@Column\(\{ nullable: true, type: "varchar", length: 4 \}\)\s+profile_tag\?: string \| null/);
    assert.match(initialMigrationSource, /profile_tag character varying\(4\),/);
});
