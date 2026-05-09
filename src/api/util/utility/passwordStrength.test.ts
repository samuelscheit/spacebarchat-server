import assert from "node:assert/strict";
import { afterEach, describe, mock, test } from "node:test";
import { Config } from "@spacebar/util";
import { calculatePasswordStrength, checkPassword, isPasswordBlocklisted, validatePasswordPolicy, type PasswordStrengthPolicy } from "./passwordStrength";

const policy: PasswordStrengthPolicy = {
    minLength: 8,
    minNumbers: 2,
    minUpperCase: 2,
    minSymbols: 1,
    blocklist: [],
};

afterEach(() => {
    mock.restoreAll();
});

describe("validatePasswordPolicy", () => {
    test("accepts a password that exactly satisfies every configured requirement", () => {
        assert.equal(validatePasswordPolicy("ABabcd12!", policy), undefined);
    });

    test("rejects passwords that are one character shorter than the minimum length", () => {
        assert.equal(validatePasswordPolicy("ABcd12!", policy)?.code, "PASSWORD_REQUIREMENTS_MIN_LENGTH");
    });

    test("rejects passwords that have one fewer number than required", () => {
        assert.equal(validatePasswordPolicy("ABabcdef1!", policy)?.code, "PASSWORD_REQUIREMENTS_MIN_NUMBERS");
    });

    test("rejects passwords that have one fewer uppercase letter than required", () => {
        assert.equal(validatePasswordPolicy("Abcdef12!", policy)?.code, "PASSWORD_REQUIREMENTS_MIN_UPPERCASE");
    });

    test("rejects passwords that have one fewer symbol than required", () => {
        assert.equal(validatePasswordPolicy("ABabcdef12", policy)?.code, "PASSWORD_REQUIREMENTS_MIN_SYMBOLS");
    });

    test("returns the first upstream-style policy failure instead of an aggregate result", () => {
        const failure = validatePasswordPolicy("short", policy);

        assert.deepEqual(failure, {
            code: "PASSWORD_REQUIREMENTS_MIN_LENGTH",
            message: "The password must be at least 8 characters long.",
            values: { min: 8 },
        });
        assert.equal("failures" in (failure as object), false);
        assert.equal("score" in (failure as object), false);
    });

    test("allows symbol checks to be disabled", () => {
        assert.equal(validatePasswordPolicy("ABabcdef12", { ...policy, minSymbols: 0 }), undefined);
    });

    test("rejects configured blocklisted passwords after content requirements pass", () => {
        const failure = validatePasswordPolicy("Password123!", {
            ...policy,
            minUpperCase: 1,
            blocklist: [" password123! "],
        });

        assert.equal(failure?.code, "PASSWORD_REQUIREMENTS_BLOCKLIST");
        assert.deepEqual(failure?.values, {});
    });

    test("normalizes exact blocklist matches without rejecting partial matches", () => {
        assert.equal(isPasswordBlocklisted("Password123!", [" password123! "]), true);
        assert.equal(isPasswordBlocklisted("Password123!", ["not-password123!"]), false);
    });

    test("treats non-ASCII letters and numbers as alphanumeric instead of symbols", () => {
        const unicodePolicy: PasswordStrengthPolicy = {
            minLength: 8,
            minNumbers: 2,
            minUpperCase: 1,
            minSymbols: 1,
            blocklist: [],
        };

        assert.equal(validatePasswordPolicy("Äbcdef12", unicodePolicy)?.code, "PASSWORD_REQUIREMENTS_MIN_SYMBOLS");
        assert.equal(validatePasswordPolicy("Äbcdef12!", { ...unicodePolicy, minLength: 9 }), undefined);
        assert.equal(validatePasswordPolicy("Äbcdef١٢!", { ...unicodePolicy, minLength: 9 }), undefined);
    });
});

describe("checkPassword", () => {
    test("returns zero for configured blocklisted passwords", () => {
        mock.method(
            Config,
            "get",
            () =>
                ({
                    register: {
                        password: {
                            ...policy,
                            blocklist: [" password123! "],
                        },
                    },
                }) as ReturnType<typeof Config.get>,
        );

        assert.equal(checkPassword("Password123!"), 0);
    });

    test("returns finite bounded scores for empty and short passwords", () => {
        for (const password of ["", "a", "aa", "abcdefgh", "AA11!aaa"]) {
            const strength = calculatePasswordStrength(password, policy);
            assert.equal(Number.isFinite(strength), true, password);
            assert.ok(strength >= 0, password);
            assert.ok(strength <= 1, password);
        }

        assert.equal(checkPassword(""), 0);
        assert.equal(checkPassword("a"), 0);
    });

    test("scores repeated low-entropy passwords lower than diverse passwords", () => {
        const relaxedPolicy: PasswordStrengthPolicy = {
            minLength: 0,
            minNumbers: 0,
            minUpperCase: 0,
            minSymbols: 0,
            blocklist: [],
        };

        assert.ok(calculatePasswordStrength("abc123!?", relaxedPolicy) > calculatePasswordStrength("aaaaaaaa", relaxedPolicy));
    });
});
