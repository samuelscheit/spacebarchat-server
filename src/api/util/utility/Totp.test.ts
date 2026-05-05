import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { assertMfaCode, isValidTotpCode, type MfaBackupCodeChallenge } from "./Totp";

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

    test("does not require a code when MFA is disabled", async () => {
        await assertMfaCode({
            mfa_enabled: false,
            totp_secret: undefined,
            code: undefined,
            invalidCodeError: () => new Error("invalid"),
            findBackupCode: async () => {
                throw new Error("backup codes should not be loaded");
            },
        });
    });

    test("rejects missing codes when MFA is enabled", async () => {
        await assert.rejects(
            assertMfaCode({
                mfa_enabled: true,
                totp_secret: "secret",
                code: undefined,
                invalidCodeError: () => new Error("invalid"),
                findBackupCode: async () => undefined,
            }),
            /invalid/,
        );
    });

    test("accepts and consumes unused backup codes", async () => {
        let saved = false;
        const backup: MfaBackupCodeChallenge = {
            consumed: false,
            async save() {
                saved = true;
            },
        };

        await assertMfaCode({
            mfa_enabled: true,
            totp_secret: "secret",
            code: "backup-code",
            invalidCodeError: () => new Error("invalid"),
            findBackupCode: async () => backup,
        });

        assert.equal(backup.consumed, true);
        assert.equal(saved, true);
    });
});
