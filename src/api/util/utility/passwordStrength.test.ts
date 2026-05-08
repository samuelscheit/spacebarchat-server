import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { checkPassword, validatePasswordPolicy } from "./passwordStrength";

const policy = {
    minLength: 8,
    minNumbers: 2,
    minUpperCase: 2,
    minSymbols: 1,
};

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

    test("allows symbol checks to be disabled", () => {
        assert.equal(validatePasswordPolicy("ABabcdef12", { ...policy, minSymbols: 0 }), undefined);
    });
});

describe("checkPassword", () => {
    test("returns finite scores for short passwords", () => {
        assert.equal(checkPassword(""), 0);
        assert.equal(checkPassword("a"), 0);
    });
});
