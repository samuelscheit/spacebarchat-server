import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { HTTPError } from "lambert-server";
import { assertConsumableEmailActionTokenRecord, EmailActionTokenPurpose, getEmailActionTokenExpiresAt, hashEmailActionToken, isEmailActionTokenPayload } from "./EmailActionToken";

describe("EmailActionToken", () => {
    const now = new Date("2026-05-06T00:00:00.000Z");
    const token = "email-action-token";

    test("computes short purpose-specific expiries", () => {
        assert.equal(getEmailActionTokenExpiresAt(EmailActionTokenPurpose.resetPassword, now).toISOString(), "2026-05-06T01:00:00.000Z");
        assert.equal(getEmailActionTokenExpiresAt(EmailActionTokenPurpose.verifyEmail, now).toISOString(), "2026-05-07T00:00:00.000Z");
    });

    test("recognizes only structured email action JWT payloads", () => {
        assert.equal(
            isEmailActionTokenPayload({
                typ: "email_action",
                id: "user",
                iat: 1700000000,
                exp: 1700003600,
                kid: "key",
                purpose: EmailActionTokenPurpose.verifyEmail,
                nonce: "nonce",
                ver: 1,
            }),
            true,
        );

        assert.equal(
            isEmailActionTokenPayload({
                typ: "email_action",
                id: "user",
                iat: 1700000000,
                exp: 1700003600,
                kid: "key",
                purpose: "unknown",
                nonce: "nonce",
                ver: 1,
            }),
            false,
        );
    });

    test("accepts a matching unexpired unconsumed token record", () => {
        const record = assertConsumableEmailActionTokenRecord(
            {
                token_hash: hashEmailActionToken(token),
                purpose: EmailActionTokenPurpose.resetPassword,
                user_id: "user",
                email: "user@example.com",
                expires_at: new Date("2026-05-06T00:10:00.000Z"),
                consumed_at: null,
            },
            EmailActionTokenPurpose.resetPassword,
            token,
            now,
            "user@example.com",
        );

        assert.equal(record.user_id, "user");
    });

    test("rejects wrong purpose, consumed, expired, wrong hash, and wrong email records", () => {
        const baseRecord = {
            token_hash: hashEmailActionToken(token),
            purpose: EmailActionTokenPurpose.resetPassword,
            user_id: "user",
            email: "user@example.com",
            expires_at: new Date("2026-05-06T00:10:00.000Z"),
            consumed_at: null,
        };

        for (const record of [
            { ...baseRecord, purpose: EmailActionTokenPurpose.verifyEmail },
            { ...baseRecord, consumed_at: now },
            { ...baseRecord, expires_at: now },
            { ...baseRecord, token_hash: hashEmailActionToken("other-token") },
            { ...baseRecord, email: "other@example.com" },
        ]) {
            assert.throws(
                () => assertConsumableEmailActionTokenRecord(record, EmailActionTokenPurpose.resetPassword, token, now, "user@example.com"),
                (error) => error instanceof HTTPError && error.code === 401,
            );
        }
    });
});
