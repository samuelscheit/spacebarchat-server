import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { QueryRunner } from "typeorm";
import { ChannelIconEmoji1778062363002 } from "../../src/util/migration/postgres/1778062363002-ChannelIconEmoji";

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

describe("ChannelIconEmoji1778062363002", () => {
    test("adds a nullable jsonb column for channel icon emoji payloads", async () => {
        const migration = new ChannelIconEmoji1778062363002();
        const { queries, queryRunner } = createQueryRunner();

        await migration.up(queryRunner);

        assert.deepStrictEqual(queries, [`ALTER TABLE "channels" ADD "icon_emoji" jsonb`]);
    });

    test("drops the channel icon emoji column on rollback", async () => {
        const migration = new ChannelIconEmoji1778062363002();
        const { queries, queryRunner } = createQueryRunner();

        await migration.down(queryRunner);

        assert.deepStrictEqual(queries, [`ALTER TABLE "channels" DROP COLUMN "icon_emoji"`]);
    });
});
