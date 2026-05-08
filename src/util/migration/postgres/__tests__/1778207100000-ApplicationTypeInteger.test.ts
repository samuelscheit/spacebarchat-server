import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { QueryRunner } from "typeorm";
import { ApplicationTypeInteger1778207100000 } from "../1778207100000-ApplicationTypeInteger";

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

describe("ApplicationTypeInteger1778207100000", () => {
    test("converts legacy jsonb application type values to nullable integers", async () => {
        const { queries, queryRunner } = createQueryRunner();

        await new ApplicationTypeInteger1778207100000().up(queryRunner);

        assert.equal(queries.length, 1);
        assert.match(queries[0], /ALTER TABLE applications ALTER COLUMN "type" TYPE integer/);
        assert.match(queries[0], /jsonb_typeof\("type"\) = 'number'/);
        assert.match(queries[0], /jsonb_typeof\("type"\) = 'string'/);
        assert.match(queries[0], /ELSE NULL/);
    });

    test("rolls back to jsonb scalar values", async () => {
        const { queries, queryRunner } = createQueryRunner();

        await new ApplicationTypeInteger1778207100000().down(queryRunner);

        assert.deepEqual(queries, [`ALTER TABLE applications ALTER COLUMN "type" TYPE jsonb USING to_jsonb("type");`]);
    });
});
