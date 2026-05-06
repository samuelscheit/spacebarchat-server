import { describe, test } from "node:test";
import assert from "node:assert";
import { createRegistrationTokens } from "./RegistrationTokens";

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
});
