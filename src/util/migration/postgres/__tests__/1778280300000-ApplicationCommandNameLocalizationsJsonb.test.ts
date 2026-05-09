import { describe, test } from "node:test";
import assert from "node:assert";
import { QueryRunner } from "typeorm";
import { ApplicationCommandNameLocalizationsJsonb1778280300000 } from "../1778280300000-ApplicationCommandNameLocalizationsJsonb";

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

describe("ApplicationCommandNameLocalizationsJsonb1778280300000", () => {
    test("converts application command name localization storage to jsonb", async () => {
        const migration = new ApplicationCommandNameLocalizationsJsonb1778280300000();
        const { queries, queryRunner } = createQueryRunner();

        await migration.up(queryRunner);

        assert.deepStrictEqual(queries, [`ALTER TABLE application_commands ALTER COLUMN name_localizations TYPE jsonb USING name_localizations::jsonb;`]);
    });

    test("restores varchar storage on rollback", async () => {
        const migration = new ApplicationCommandNameLocalizationsJsonb1778280300000();
        const { queries, queryRunner } = createQueryRunner();

        await migration.down(queryRunner);

        assert.deepStrictEqual(queries, [`ALTER TABLE application_commands ALTER COLUMN name_localizations TYPE varchar USING name_localizations::varchar;`]);
    });
});
