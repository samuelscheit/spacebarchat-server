import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
    consumeMfaBackupCodesChallengeNonce,
    getMfaBackupCodesChallengePurpose,
    hashMfaBackupCodesChallengeNonce,
    issueMfaBackupCodesChallengeNonce,
    MFA_BACKUP_CODES_CHALLENGE_TTL,
    type MfaBackupCodesChallengeStateStore,
    createMfaBackupCodesChallengeNonce,
    verifyMfaBackupCodesChallengeNonce,
} from "./MfaBackupCodes";

function createStateStore() {
    const records = new Map<string, { token_hash: string; user_id: string; purpose: string; expires_at: Date; consumed_at: Date | null }>();
    const updates: Array<{ criteria: unknown; partialEntity: unknown }> = [];

    const stateStore: MfaBackupCodesChallengeStateStore = {
        async insert(record) {
            records.set(record.token_hash, record);
        },
        async update(criteria, partialEntity) {
            updates.push({ criteria, partialEntity });
            const { token_hash, user_id, purpose } = criteria as { token_hash: string; user_id: string; purpose: string };
            const record = records.get(token_hash);
            if (!record || record.user_id !== user_id || record.purpose !== purpose || record.consumed_at) return { affected: 0 };

            record.consumed_at = (partialEntity as { consumed_at: Date }).consumed_at;
            return { affected: 1 };
        },
    };

    return { records, stateStore, updates };
}

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

        assert.equal(verifyMfaBackupCodesChallengeNonce("user-a", "regenerate", nonce, { secret, now: now + MFA_BACKUP_CODES_CHALLENGE_TTL - 1 }), true);
        assert.equal(verifyMfaBackupCodesChallengeNonce("user-a", "regenerate", nonce, { secret, now: now + MFA_BACKUP_CODES_CHALLENGE_TTL }), false);
        assert.equal(verifyMfaBackupCodesChallengeNonce("user-a", "regenerate", tamperedNonce, { secret, now }), false);
        assert.equal(verifyMfaBackupCodesChallengeNonce("user-a", "regenerate", "not-a-valid-nonce", { secret, now }), false);
    });

    test("stores and consumes challenge nonces exactly once", async () => {
        const { records, stateStore, updates } = createStateStore();
        const nonce = await issueMfaBackupCodesChallengeNonce("user-a", "view", { secret, now, randomBytes, stateStore });
        const tokenHash = hashMfaBackupCodesChallengeNonce(nonce);

        assert.equal(records.size, 1);
        assert.deepEqual(records.get(tokenHash), {
            token_hash: tokenHash,
            user_id: "user-a",
            purpose: getMfaBackupCodesChallengePurpose("view"),
            expires_at: new Date(now + MFA_BACKUP_CODES_CHALLENGE_TTL),
            consumed_at: null,
        });
        assert.equal(await consumeMfaBackupCodesChallengeNonce("user-a", "view", nonce, { secret, now, stateStore }), true);
        assert.equal(await consumeMfaBackupCodesChallengeNonce("user-a", "view", nonce, { secret, now, stateStore }), false);
        assert.equal(updates.length, 2);

        const firstUpdate = updates[0];
        const criteria = firstUpdate.criteria as Record<string, unknown>;
        assert.equal(criteria.token_hash, tokenHash);
        assert.equal(criteria.user_id, "user-a");
        assert.equal(criteria.purpose, getMfaBackupCodesChallengePurpose("view"));
        assert.ok(criteria.consumed_at, "consume update must require an unconsumed challenge record");
        assert.ok(criteria.expires_at, "consume update must require an unexpired challenge record");
        assert.ok((firstUpdate.partialEntity as { consumed_at: Date }).consumed_at instanceof Date);
        assert.ok(records.get(tokenHash)?.consumed_at instanceof Date);
    });

    test("does not consume nonces without matching stored state", async () => {
        const { stateStore, updates } = createStateStore();
        const nonce = createMfaBackupCodesChallengeNonce("user-a", "view", { secret, now, randomBytes });

        assert.equal(await consumeMfaBackupCodesChallengeNonce("user-a", "view", nonce, { secret, now, stateStore }), false);
        assert.equal(updates.length, 1);
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
