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

describe("password strength", () => {
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
        assert.equal(isPasswordBlocklisted("Password123!", [" password123! "]), true);
    });

    test("uses exact configured thresholds instead of off-by-one minimums", () => {
        assert.deepEqual(failureCodes("AA1!aaaa"), ["PASSWORD_REQUIREMENTS_MIN_NUMBERS"]);
        assert.deepEqual(failureCodes("A11!aaaa"), ["PASSWORD_REQUIREMENTS_MIN_UPPERCASE"]);
        assert.deepEqual(failureCodes("AA11aaaa"), ["PASSWORD_REQUIREMENTS_MIN_SYMBOLS"]);
        assert.deepEqual(failureCodes("AA11!aa"), ["PASSWORD_REQUIREMENTS_MIN_LENGTH"]);
        assert.equal(validatePasswordPolicy("AA11!aaa", policy).valid, true);
    });

    test("treats non-ASCII letters and numbers as alphanumeric instead of symbols", () => {
        const unicodePolicy: PasswordStrengthPolicy = {
            minLength: 8,
            minNumbers: 2,
            minUpperCase: 1,
            minSymbols: 1,
            blocklist: [],
        };

        const withoutSymbol = validatePasswordPolicy("Äbcdef12", unicodePolicy);
        assert.equal(withoutSymbol.metrics.upperCase, 1);
        assert.equal(withoutSymbol.metrics.numbers, 2);
        assert.equal(withoutSymbol.metrics.symbols, 0);
        assert.deepEqual(
            withoutSymbol.failures.map((failure) => failure.code),
            ["PASSWORD_REQUIREMENTS_MIN_SYMBOLS"],
        );

        assert.equal(validatePasswordPolicy("Äbcdef12!", { ...unicodePolicy, minLength: 9 }).valid, true);
    });

    test("returns finite bounded scores for empty and short passwords", () => {
        for (const password of ["", "a", "aa", "abcdefgh", "AA11!aaa"]) {
            const strength = calculatePasswordStrength(password, policy);
            assert.equal(Number.isFinite(strength), true, password);
            assert.ok(strength >= 0, password);
            assert.ok(strength <= 1, password);
        }

        assert.equal(calculatePasswordStrength("", policy), 0);
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

    test("normalizes exact blocklist matches", () => {
        const result = validatePasswordPolicy("Password123!", {
            ...policy,
            minUpperCase: 1,
            blocklist: [" password123! "],
        });

        assert.equal(result.blocklisted, true);
        assert.equal(result.score, 0);
        assert.ok(result.failures.some((failure) => failure.code === "PASSWORD_REQUIREMENTS_BLOCKLIST"));
        assert.equal(isPasswordBlocklisted("Password123!", ["not-password123!"]), false);
    });
});

function failureCodes(password: string): string[] {
    return validatePasswordPolicy(password, policy).failures.map((failure) => failure.code);
}
