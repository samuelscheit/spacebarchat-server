import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import type { QueryRunner } from "typeorm";
import { GuildIncidentsData1778520000000 } from "../1778520000000-GuildIncidentsData";

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

describe("GuildIncidentsData1778520000000", () => {
    test("adds a nullable jsonb incidents data column", async () => {
        const migration = new GuildIncidentsData1778520000000();
        const { queries, queryRunner } = createQueryRunner();

        await migration.up(queryRunner);

        assert.deepEqual(queries, [`ALTER TABLE "guilds" ADD "incidents_data" jsonb`]);
    });

    test("drops the incidents data column on rollback", async () => {
        const migration = new GuildIncidentsData1778520000000();
        const { queries, queryRunner } = createQueryRunner();

        await migration.down(queryRunner);

        assert.deepEqual(queries, [`ALTER TABLE "guilds" DROP COLUMN "incidents_data"`]);
    });

    test("keeps the column owned by the incremental migration, not fresh-database initial DDL", () => {
        const initialMigration = fs.readFileSync(path.join(process.cwd(), "src", "util", "migration", "postgres-initial.ts"), "utf8");

        assert.doesNotMatch(initialMigration, /incidents_data/);
    });
});
