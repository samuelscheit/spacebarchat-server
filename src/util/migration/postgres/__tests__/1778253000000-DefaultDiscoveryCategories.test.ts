import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { QueryRunner } from "typeorm";
import { DEFAULT_DISCOVERY_CATEGORIES } from "../../../util/DefaultDiscoveryCategories";
import { DefaultDiscoveryCategories1778253000000 } from "../1778253000000-DefaultDiscoveryCategories";

function createQueryRunner() {
    const queries: { sql: string; parameters?: unknown[] }[] = [];
    const queryRunner = {
        query(sql: string, parameters?: unknown[]) {
            queries.push({ sql, parameters });
            return Promise.resolve();
        },
    } as unknown as QueryRunner;

    return { queries, queryRunner };
}

describe("DefaultDiscoveryCategories1778253000000", () => {
    test("inserts default categories without overwriting existing rows", async () => {
        const migration = new DefaultDiscoveryCategories1778253000000();
        const { queries, queryRunner } = createQueryRunner();

        await migration.up(queryRunner);

        assert.equal(queries.length, 1);
        assert.match(queries[0].sql, /^INSERT INTO categories \(id, name, localizations, is_primary\) VALUES /);
        assert.match(queries[0].sql, /ON CONFLICT \(id\) DO NOTHING;$/);
        assert.equal(queries[0].parameters?.length, DEFAULT_DISCOVERY_CATEGORIES.length * 4);
        assert.deepEqual(queries[0].parameters?.slice(0, 4), [0, "General", "{}", true]);
        assert.deepEqual(queries[0].parameters?.slice(-4), [49, "Bots", "{}", true]);
    });

    test("does not delete potentially referenced or customized categories on rollback", async () => {
        const migration = new DefaultDiscoveryCategories1778253000000();
        const { queries } = createQueryRunner();

        await migration.down();

        assert.deepEqual(queries, []);
    });
});
