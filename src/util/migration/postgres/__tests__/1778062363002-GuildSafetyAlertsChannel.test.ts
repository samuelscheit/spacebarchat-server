import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import type { QueryRunner } from "typeorm";
import { GuildSafetyAlertsChannel1778062363002 } from "../1778062363002-GuildSafetyAlertsChannel";

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

describe("GuildSafetyAlertsChannel1778062363002", () => {
    test("adds a nullable int8 safety alerts channel reference", async () => {
        const migration = new GuildSafetyAlertsChannel1778062363002();
        const { queries, queryRunner } = createQueryRunner();

        await migration.up(queryRunner);

        assert.deepEqual(queries, [
            `ALTER TABLE "guilds" ADD "safety_alerts_channel_id" int8`,
            `ALTER TABLE "guilds" ADD CONSTRAINT "FK_guilds_safety_alerts_channel_id" FOREIGN KEY ("safety_alerts_channel_id") REFERENCES "channels"("id")`,
        ]);
    });

    test("drops the safety alerts channel reference before the column", async () => {
        const migration = new GuildSafetyAlertsChannel1778062363002();
        const { queries, queryRunner } = createQueryRunner();

        await migration.down(queryRunner);

        assert.deepEqual(queries, [`ALTER TABLE "guilds" DROP CONSTRAINT "FK_guilds_safety_alerts_channel_id"`, `ALTER TABLE "guilds" DROP COLUMN "safety_alerts_channel_id"`]);
    });

    test("does not pre-create the incremental column in the initial DDL", () => {
        const initialMigration = fs.readFileSync(path.join(process.cwd(), "src", "util", "migration", "postgres-initial.ts"), "utf8");

        assert.doesNotMatch(initialMigration, /safety_alerts_channel_id/);
    });
});
