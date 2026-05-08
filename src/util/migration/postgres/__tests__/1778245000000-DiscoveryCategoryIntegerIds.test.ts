import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { QueryRunner } from "typeorm";
import { DiscoveryCategoryIntegerIds1778245000000 } from "../1778245000000-DiscoveryCategoryIntegerIds";

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

describe("DiscoveryCategoryIntegerIds1778245000000", () => {
    test("restores discovery category ids to integer storage before re-adding the FK", async () => {
        const { queries, queryRunner } = createQueryRunner();

        await new DiscoveryCategoryIntegerIds1778245000000().up(queryRunner);

        assert.deepEqual(queries, [
            `ALTER TABLE guilds DROP CONSTRAINT IF EXISTS guilds_categories_fk;`,
            `UPDATE guilds SET primary_category_id = NULL WHERE primary_category_id IS NOT NULL AND CASE WHEN primary_category_id::text ~ '^[0-9]+$' THEN primary_category_id::numeric NOT BETWEEN 0 AND 2147483647 ELSE true END;`,
            `DELETE FROM categories WHERE CASE WHEN id::text ~ '^[0-9]+$' THEN id::numeric NOT BETWEEN 0 AND 2147483647 ELSE true END;`,
            `ALTER TABLE categories ALTER COLUMN id TYPE integer USING id::integer;`,
            `ALTER TABLE guilds ALTER COLUMN primary_category_id TYPE integer USING primary_category_id::integer;`,
            `ALTER TABLE guilds ADD CONSTRAINT guilds_categories_fk FOREIGN KEY (primary_category_id) REFERENCES categories(id) ON DELETE SET NULL;`,
        ]);
    });

    test("keeps rollback aligned with the earlier bigint migration", async () => {
        const { queries, queryRunner } = createQueryRunner();

        await new DiscoveryCategoryIntegerIds1778245000000().down(queryRunner);

        assert.deepEqual(queries, [
            `ALTER TABLE guilds DROP CONSTRAINT IF EXISTS guilds_categories_fk;`,
            `ALTER TABLE categories ALTER COLUMN id TYPE int8 USING id::int8;`,
            `ALTER TABLE guilds ALTER COLUMN primary_category_id TYPE int8 USING primary_category_id::int8;`,
            `ALTER TABLE guilds ADD CONSTRAINT guilds_categories_fk FOREIGN KEY (primary_category_id) REFERENCES categories(id) ON DELETE SET NULL;`,
        ]);
    });
});
