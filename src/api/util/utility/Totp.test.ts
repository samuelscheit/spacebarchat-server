import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, test } from "node:test";
import Ajv from "ajv";
import { generateSecret, generateToken } from "node-2fa";
import { HTTPError } from "lambert-server";
import { User } from "@spacebar/util";
import { assertMfaCode, consumeMfaBackupCode, isCurrentTotpCode, requireTotpCodeIfConfigured, requireValidTotpCodeIfConfigured, type MfaBackupCodeUpdateBuilder } from "./Totp";

const originalFindOneOrFail = User.findOneOrFail;
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

describe("requireTotpCodeIfConfigured", () => {
    afterEach(() => {
        User.findOneOrFail = originalFindOneOrFail;
    });

    test("loads the hidden TOTP secret explicitly", async () => {
        User.findOneOrFail = ((options: unknown) => {
            assert.deepEqual(options, {
                where: { id: "user_id" },
                select: { id: true, totp_secret: true },
            });
            return Promise.resolve({ id: "user_id", totp_secret: "" });
        }) as typeof User.findOneOrFail;

        await requireTotpCodeIfConfigured("user_id", undefined, "Invalid code");
    });

    test("does not require a code when no TOTP secret is configured", async () => {
        User.findOneOrFail = (() => Promise.resolve({ id: "user_id", totp_secret: "" })) as typeof User.findOneOrFail;

        await requireTotpCodeIfConfigured("user_id", undefined, "Invalid code");
    });

    test("rejects missing and invalid codes when TOTP is configured", async () => {
        const secret = generateSecret({ name: "Spacebar", account: "totp@example.test" }).secret;
        User.findOneOrFail = (() => Promise.resolve({ id: "user_id", totp_secret: secret })) as typeof User.findOneOrFail;

        await assert.rejects(
            () => requireTotpCodeIfConfigured("user_id", undefined, "Invalid code"),
            (error) => {
                assert.ok(error instanceof HTTPError);
                assert.equal(error.message, "Invalid code");
                assert.equal(error.code, 60008);
                return true;
            },
        );

        await assert.rejects(() => requireTotpCodeIfConfigured("user_id", "000000", "Invalid code"), HTTPError);
    });

    test("accepts a valid current TOTP code", async () => {
        const secret = generateSecret({ name: "Spacebar", account: "totp@example.test" }).secret;
        const generated = generateToken(secret);
        assert.ok(generated);

        User.findOneOrFail = (() => Promise.resolve({ id: "user_id", totp_secret: secret })) as typeof User.findOneOrFail;

        await requireTotpCodeIfConfigured("user_id", generated.token, "Invalid code");
    });
});

describe("requireValidTotpCodeIfConfigured", () => {
    test("can validate an already-selected TOTP secret without a database lookup", () => {
        const secret = generateSecret({ name: "Spacebar", account: "totp@example.test" }).secret;
        const generated = generateToken(secret);
        assert.ok(generated);

        assert.doesNotThrow(() => requireValidTotpCodeIfConfigured("", undefined, "Invalid code"));
        assert.doesNotThrow(() => requireValidTotpCodeIfConfigured(secret, generated.token, "Invalid code"));
        assert.throws(() => requireValidTotpCodeIfConfigured(secret, "000000", "Invalid code"), HTTPError);
    });
});

describe("TOTP code validation", () => {
    test("rejects missing secrets and non-string codes", () => {
        assert.equal(isCurrentTotpCode(undefined, "123456"), false);
        assert.equal(isCurrentTotpCode(null, "123456"), false);
        assert.equal(isCurrentTotpCode("secret", undefined), false);
        assert.equal(isCurrentTotpCode("secret", 123456), false);
    });

    test("accepts only current-window TOTP codes", () => {
        assert.equal(
            isCurrentTotpCode("secret", "123456", () => ({
                delta: 0,
            })),
            true,
        );
        assert.equal(
            isCurrentTotpCode("secret", "123456", () => ({
                delta: 1,
            })),
            false,
        );
    });

    test("rejects invalid verifier results", () => {
        assert.equal(
            isCurrentTotpCode("secret", "123456", () => null),
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
});

describe("assertMfaCode", () => {
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

    test("rejects missing and non-string codes when MFA is enabled", async () => {
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

        await assert.rejects(
            assertMfaCode({
                mfa_enabled: true,
                totp_secret: "secret",
                code: 123456,
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
