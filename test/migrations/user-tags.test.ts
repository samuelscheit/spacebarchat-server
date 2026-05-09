import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { QueryRunner } from "typeorm";
import * as uniqueUserTagsMigration from "../../src/util/migration/postgres/1778207400000-UniqueUserTags";
import {
    chooseAvailableDiscriminator,
    chooseIncrementingDiscriminator,
    isUserTagUniqueViolation,
    retryOnUserTagUniqueViolation,
    USER_TAG_REGISTRATION_ATTEMPTS,
    USERS_USERNAME_DISCRIMINATOR_INDEX,
    userDiscriminatorAlreadyTakenFieldError,
} from "../../src/util/util/UserTag";

const { UniqueUserTags1778207400000 } = uniqueUserTagsMigration;

function createQueryRunner(responses: unknown[] = []) {
    const queries: string[] = [];

    return {
        queries,
        queryRunner: {
            query: async (query: string) => {
                queries.push(query);
                return responses.shift() ?? [];
            },
        } as unknown as QueryRunner,
    };
}

describe("user tag utilities", () => {
    test("exports only the migration class from the user tag migration module", () => {
        assert.deepEqual(Object.keys(uniqueUserTagsMigration).sort(), ["UniqueUserTags1778207400000"]);
    });

    test("creates the unique user tag index only after checking existing duplicates", async () => {
        const migration = new UniqueUserTags1778207400000();
        const { queries, queryRunner } = createQueryRunner();

        await migration.up(queryRunner);

        assert.equal(queries.length, 2);
        assert.ok(queries[0].includes("SELECT username, discriminator, ARRAY_AGG(id ORDER BY id) AS ids"));
        assert.ok(queries[0].includes("GROUP BY username, discriminator"));
        assert.equal(queries[1], `CREATE UNIQUE INDEX ${USERS_USERNAME_DISCRIMINATOR_INDEX} ON users (username, discriminator);`);
    });

    test("aborts the user tag migration when duplicates exist", async () => {
        const migration = new UniqueUserTags1778207400000();
        const { queries, queryRunner } = createQueryRunner([[{ username: "alice", discriminator: "0001", ids: ["1", "2"] }]]);

        await assert.rejects(() => migration.up(queryRunner), /alice#0001: 1, 2/);
        assert.equal(queries.length, 1);
    });

    test("drops the unique user tag index on rollback", async () => {
        const migration = new UniqueUserTags1778207400000();
        const { queries, queryRunner } = createQueryRunner();

        await migration.down(queryRunner);

        assert.deepEqual(queries, [`DROP INDEX ${USERS_USERNAME_DISCRIMINATOR_INDEX};`]);
    });

    test("chooses an available discriminator by scanning from the random start", () => {
        assert.equal(chooseAvailableDiscriminator(["9998", "0001"], 9998), "9999");
        assert.equal(chooseAvailableDiscriminator(["9998", "9999"], 9998), "0001");
    });

    test("returns undefined when every discriminator is taken", () => {
        const taken = Array.from({ length: 9999 }, (_, index) => String(index + 1).padStart(4, "0"));

        assert.equal(chooseAvailableDiscriminator(taken, 1), undefined);
        assert.equal(chooseIncrementingDiscriminator(taken), undefined);
    });

    test("chooses the next incrementing discriminator and wraps into gaps", () => {
        assert.equal(chooseIncrementingDiscriminator([]), "0001");
        assert.equal(chooseIncrementingDiscriminator(["0001", "0002"]), "0003");
        assert.equal(chooseIncrementingDiscriminator(["0001", "9999"]), "0002");
    });

    test("detects user tag unique constraint violations", () => {
        assert.equal(isUserTagUniqueViolation({ code: "23505", constraint: USERS_USERNAME_DISCRIMINATOR_INDEX }), true);
        assert.equal(isUserTagUniqueViolation({ driverError: { code: "23505", constraint: USERS_USERNAME_DISCRIMINATOR_INDEX } }), true);
        assert.equal(isUserTagUniqueViolation({ code: "23505", constraint: "other_unique_index" }), false);
        assert.equal(isUserTagUniqueViolation({ code: "23503", constraint: USERS_USERNAME_DISCRIMINATOR_INDEX }), false);
    });

    test("builds the duplicate discriminator field error", () => {
        const error = userDiscriminatorAlreadyTakenFieldError("Taken");

        assert.equal(error.code, 50035);
        assert.equal(error.errors?.discriminator._errors[0].code, "INVALID_DISCRIMINATOR");
        assert.equal(error.errors?.discriminator._errors[0].message, "Taken");
    });

    test("retries user tag unique violations until the operation succeeds", async () => {
        const attempts: number[] = [];
        const result = await retryOnUserTagUniqueViolation(async (attempt) => {
            attempts.push(attempt);
            if (attempt < 2) {
                throw { code: "23505", constraint: USERS_USERNAME_DISCRIMINATOR_INDEX };
            }
            return "created";
        });

        assert.equal(result, "created");
        assert.deepEqual(attempts, [0, 1, 2]);
    });

    test("returns undefined after exhausting user tag unique violation retries", async () => {
        let attempts = 0;

        const result = await retryOnUserTagUniqueViolation(async () => {
            attempts += 1;
            throw { code: "23505", constraint: USERS_USERNAME_DISCRIMINATOR_INDEX };
        });

        assert.equal(result, undefined);
        assert.equal(attempts, USER_TAG_REGISTRATION_ATTEMPTS);
    });

    test("does not retry unrelated database errors", async () => {
        const error = { code: "23505", constraint: "other_unique_index" };
        let attempts = 0;

        await assert.rejects(
            () =>
                retryOnUserTagUniqueViolation(async () => {
                    attempts += 1;
                    throw error;
                }),
            error,
        );
        assert.equal(attempts, 1);
    });
});
