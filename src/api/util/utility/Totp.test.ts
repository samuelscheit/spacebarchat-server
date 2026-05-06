import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import Ajv from "ajv";
import { assertMfaCode, consumeMfaBackupCode, isValidTotpCode, type MfaBackupCodeUpdateBuilder } from "./Totp";

const backupCodeEntity = {};

function validateGeneratedSchema(schemaName: string, value: unknown) {
    const schemasPath = path.join(process.cwd(), "assets", "schemas.json");
    const schemas = JSON.parse(fs.readFileSync(schemasPath, { encoding: "utf8" })) as Record<string, object>;
    const ajv = new Ajv({ schemas, strict: false });
    const validate = ajv.getSchema(schemaName);

    assert(validate, `Expected generated schema ${schemaName} to be registered`);
    return validate(value);
}

async function withBackupCodeUpdateResult<T>(
    affected: number | undefined,
    run: (createQueryBuilder: () => MfaBackupCodeUpdateBuilder, statements: [string, Record<string, unknown>][]) => Promise<T>,
) {
    const statements: [string, Record<string, unknown>][] = [];
    const builder: MfaBackupCodeUpdateBuilder = {
        andWhere(query, parameters) {
            statements.push([query, parameters]);
            return this;
        },
        async execute() {
            return { affected };
        },
        set(values) {
            assert.deepEqual(values, { consumed: true });
            return this;
        },
        update(entity) {
            assert.equal(entity, backupCodeEntity);
            return this;
        },
        where(query, parameters) {
            statements.push([query, parameters]);
            return this;
        },
    };

    return run(() => builder, statements);
}

describe("TOTP code validation", () => {
    test("rejects missing secrets and codes", () => {
        assert.equal(isValidTotpCode(undefined, "123456"), false);
        assert.equal(isValidTotpCode("secret", undefined), false);
    });

    test("accepts only current-window TOTP codes", () => {
        assert.equal(
            isValidTotpCode("secret", "123456", () => ({
                delta: 0,
            })),
            true,
        );
        assert.equal(
            isValidTotpCode("secret", "123456", () => ({
                delta: 1,
            })),
            false,
        );
    });

    test("rejects invalid verifier results", () => {
        assert.equal(
            isValidTotpCode("secret", "123456", () => null),
            false,
        );
    });

    test("claims backup codes with one conditional update", async () => {
        await withBackupCodeUpdateResult(1, async (createQueryBuilder, statements) => {
            assert.equal(await consumeMfaBackupCode({ backupCodeEntity, code: "backup-code", createQueryBuilder, userId: "user-id" }), true);
            assert.deepEqual(statements, [
                ["code = :code", { code: "backup-code" }],
                ["expired = :expired", { expired: false }],
                ["consumed = :consumed", { consumed: false }],
                ["user_id = :userId", { userId: "user-id" }],
            ]);
        });

        await withBackupCodeUpdateResult(0, async (createQueryBuilder) => {
            assert.equal(await consumeMfaBackupCode({ backupCodeEntity, code: "backup-code", createQueryBuilder, userId: "user-id" }), false);
        });
    });

    test("accepts backup-code length values for MFA disable validation", () => {
        assert.equal(validateGeneratedSchema("TotpDisableSchema", { code: "123456" }), true);
        assert.equal(validateGeneratedSchema("TotpDisableSchema", { code: "deadbeef" }), true);
        assert.equal(validateGeneratedSchema("TotpDisableSchema", { code: "too-long9" }), false);
    });

    test("read-then-save backup-code consumption can race", async () => {
        let releaseReads: () => void;
        const readsStarted = new Promise<void>((resolve) => {
            releaseReads = resolve;
        });
        const backup = {
            consumed: false,
            saveCalls: 0,
        };
        const readThenSave = async () => {
            const claimedBackup = backup.consumed ? undefined : backup;
            await readsStarted;
            if (!claimedBackup) return false;

            claimedBackup.consumed = true;
            claimedBackup.saveCalls++;
            return true;
        };

        const claims = [readThenSave(), readThenSave()];
        releaseReads!();

        assert.deepEqual(await Promise.all(claims), [true, true]);
        assert.equal(backup.saveCalls, 2);
    });

    test("does not require a code when MFA is disabled", async () => {
        await assertMfaCode({
            mfa_enabled: false,
            totp_secret: undefined,
            code: undefined,
            invalidCodeError: () => new Error("invalid"),
            consumeBackupCode: async () => {
                throw new Error("backup codes should not be loaded");
            },
        });
    });

    test("rejects missing codes when MFA is enabled", async () => {
        let consumeCalls = 0;

        await assert.rejects(
            assertMfaCode({
                mfa_enabled: true,
                totp_secret: "secret",
                code: undefined,
                invalidCodeError: () => new Error("invalid"),
                consumeBackupCode: async () => {
                    consumeCalls++;
                    return true;
                },
            }),
            /invalid/,
        );

        assert.equal(consumeCalls, 0);
    });

    test("accepts atomically consumed backup codes", async () => {
        let consumeCalls = 0;

        await assertMfaCode({
            mfa_enabled: true,
            totp_secret: "secret",
            code: "backup-code",
            invalidCodeError: () => new Error("invalid"),
            consumeBackupCode: async () => {
                consumeCalls++;
                return true;
            },
            verifyTotpToken: () => {
                throw new Error("TOTP should not be checked after backup consumption");
            },
        });

        assert.equal(consumeCalls, 1);
    });

    test("accepts valid TOTP codes when no backup code is consumed", async () => {
        await assertMfaCode({
            mfa_enabled: true,
            totp_secret: "secret",
            code: "123456",
            invalidCodeError: () => new Error("invalid"),
            consumeBackupCode: async () => false,
            verifyTotpToken: () => ({
                delta: 0,
            }),
        });
    });

    test("rejects unclaimed backup codes that are not valid TOTP codes", async () => {
        await assert.rejects(
            assertMfaCode({
                mfa_enabled: true,
                totp_secret: "secret",
                code: "backup-code",
                invalidCodeError: () => new Error("invalid"),
                consumeBackupCode: async () => false,
                verifyTotpToken: () => null,
            }),
            /invalid/,
        );
    });

    test("allows only one duplicate backup-code claim", async () => {
        let releaseClaims: () => void;
        const claimsStarted = new Promise<void>((resolve) => {
            releaseClaims = resolve;
        });
        let claimed = false;
        const createChallenge = () =>
            assertMfaCode({
                mfa_enabled: true,
                totp_secret: "secret",
                code: "backup-code",
                invalidCodeError: () => new Error("invalid"),
                consumeBackupCode: async () => {
                    await claimsStarted;
                    if (claimed) return false;
                    claimed = true;
                    return true;
                },
                verifyTotpToken: () => null,
            });

        const challenges = [createChallenge(), createChallenge()];
        releaseClaims!();
        const results = await Promise.allSettled(challenges);

        assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
        assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    });
});
