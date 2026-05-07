import { describe, test } from "node:test";
import assert from "node:assert";
import { DataSource } from "typeorm";
import { ValidRegistrationToken } from "../../../util/entities/ValidRegistrationTokens";
import { DefaultRegistrationTokenExpirationMs, createRegistrationTokens } from "./RegistrationTokens";

describe("createRegistrationTokens", () => {
    test("creates tokens with database-compatible Date expirations", () => {
        const tokens = createRegistrationTokens(2, 12, 60_000, (length) => "x".repeat(length), Date.UTC(2026, 0, 1));

        assert.strictEqual(tokens.length, 2);
        for (const token of tokens) {
            assert.strictEqual(token.token, "xxxxxxxxxxxx");
            assert.ok(token.expires_at instanceof Date);
            assert.strictEqual(token.expires_at.getTime(), Date.UTC(2026, 0, 1) + 60_000);
        }
    });

    test("passes Date expirations to TypeORM insert parameters", async () => {
        const now = Date.UTC(2026, 0, 1);
        const expirationMs = 60_000;
        const [token] = createRegistrationTokens(1, 12, expirationMs, (length) => "x".repeat(length), now);
        const dataSource = new DataSource({
            type: "postgres",
            entities: [ValidRegistrationToken],
        });

        await (dataSource as unknown as { buildMetadatas(): Promise<void> }).buildMetadatas();

        try {
            ValidRegistrationToken.useDataSource(dataSource);

            const [, parameters] = dataSource.getRepository(ValidRegistrationToken).createQueryBuilder().insert().values(token).getQueryAndParameters();

            assert.ok(
                parameters.some((parameter) => parameter instanceof Date && parameter.getTime() === now + expirationMs),
                "expected the registration token expiration insert parameter to be a Date",
            );
            assert.ok(!parameters.includes(now + expirationMs), "expected no numeric epoch expiration insert parameter");
        } finally {
            ValidRegistrationToken.useDataSource(null);
        }
    });

    test("falls back to a valid expiry date for invalid expiration settings", () => {
        const now = Date.UTC(2026, 0, 1);
        const invalidExpirationValues = [undefined, Number.NaN, "not-a-duration", -1, Number.MAX_VALUE] as unknown as number[];

        for (const expirationMs of invalidExpirationValues) {
            const [token] = createRegistrationTokens(1, 12, expirationMs, (length) => "x".repeat(length), now);

            assert.ok(token.expires_at instanceof Date);
            assert.strictEqual(Number.isFinite(token.expires_at.getTime()), true);
            assert.strictEqual(token.expires_at.getTime(), now + DefaultRegistrationTokenExpirationMs);
        }
    });

    test("falls back to a valid issuance time for invalid clocks", () => {
        const [token] = createRegistrationTokens(1, 12, 60_000, (length) => "x".repeat(length), Number.NaN);

        assert.ok(token.expires_at instanceof Date);
        assert.strictEqual(Number.isFinite(token.expires_at.getTime()), true);
    });
});
