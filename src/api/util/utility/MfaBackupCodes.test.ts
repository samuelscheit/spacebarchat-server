import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { MFA_BACKUP_CODES_CHALLENGE_TTL, createMfaBackupCodesChallengeNonce, verifyMfaBackupCodesChallengeNonce } from "./MfaBackupCodes";

describe("MFA backup-code challenge nonces", () => {
    const secret = "test-secret";
    const now = 1_000_000;
    const randomBytes = (size: number) => Buffer.alloc(size, 1);

    test("binds a challenge nonce to the user and requested action", () => {
        const nonce = createMfaBackupCodesChallengeNonce("user-a", "view", { secret, now, randomBytes });

        assert.equal(verifyMfaBackupCodesChallengeNonce("user-a", "view", nonce, { secret, now }), true);
        assert.equal(verifyMfaBackupCodesChallengeNonce("user-b", "view", nonce, { secret, now }), false);
        assert.equal(verifyMfaBackupCodesChallengeNonce("user-a", "regenerate", nonce, { secret, now }), false);
    });

    test("rejects expired and tampered challenge nonces", () => {
        const nonce = createMfaBackupCodesChallengeNonce("user-a", "regenerate", { secret, now, randomBytes });
        const [payloadSegment, signatureSegment] = nonce.split(".");
        const payload = JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8"));
        payload.user_id = "user-b";
        const tamperedNonce = `${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${signatureSegment}`;

        assert.equal(verifyMfaBackupCodesChallengeNonce("user-a", "regenerate", nonce, { secret, now: now + MFA_BACKUP_CODES_CHALLENGE_TTL }), true);
        assert.equal(verifyMfaBackupCodesChallengeNonce("user-a", "regenerate", nonce, { secret, now: now + MFA_BACKUP_CODES_CHALLENGE_TTL + 1 }), false);
        assert.equal(verifyMfaBackupCodesChallengeNonce("user-a", "regenerate", tamperedNonce, { secret, now }), false);
        assert.equal(verifyMfaBackupCodesChallengeNonce("user-a", "regenerate", "not-a-valid-nonce", { secret, now }), false);
    });
});

describe("TotpDisableSchema", () => {
    test("allows TOTP codes and generated 8-character backup codes", () => {
        const schemaPath = path.join(__dirname, "..", "..", "..", "..", "assets", "schemas.json");
        const schemas = JSON.parse(fs.readFileSync(schemaPath, "utf8"));

        assert.equal(schemas.TotpDisableSchema.properties.code.minLength, 6);
        assert.equal(schemas.TotpDisableSchema.properties.code.maxLength, 8);
    });
});
