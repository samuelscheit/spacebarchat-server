import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import type { QueryRunner } from "typeorm";
import { GuildMaxStageVideoChannelUsers1778209616000 } from "../1778209616000-GuildMaxStageVideoChannelUsers";

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

describe("GuildMaxStageVideoChannelUsers1778209616000", () => {
    test("keeps the column owned by the incremental migration, not fresh-database initial DDL", () => {
        const initialMigration = readFileSync(path.join(process.cwd(), "src/util/migration/postgres-initial.ts"), "utf8");

        assert.equal(initialMigration.includes("max_stage_video_channel_users"), false);
    });

    test("adds and backfills the stage video user limit column", async () => {
        const migration = new GuildMaxStageVideoChannelUsers1778209616000();
        const { queries, queryRunner } = createQueryRunner();

        await migration.up(queryRunner);

        assert.deepEqual(queries, [
            `ALTER TABLE "guilds" ADD "max_stage_video_channel_users" integer`,
            `UPDATE "guilds" SET "max_stage_video_channel_users" = 50 WHERE "max_stage_video_channel_users" IS NULL`,
        ]);
    });

    test("drops the stage video user limit column on rollback", async () => {
        const migration = new GuildMaxStageVideoChannelUsers1778209616000();
        const { queries, queryRunner } = createQueryRunner();

        await migration.down(queryRunner);

        assert.deepEqual(queries, [`ALTER TABLE "guilds" DROP COLUMN "max_stage_video_channel_users"`]);
    });
});
