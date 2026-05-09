import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { assertPasswordMeetsPolicy, isRegistrationInviteUsable, RegistrationInviteConfiguration, registrationRequiresInvite } from "./Registration";

describe("registrationRequiresInvite", () => {
    test("requires invites when the instance is invite-only", () => {
        const register: RegistrationInviteConfiguration = {
            requireInvite: true,
            guestsRequireInvite: false,
        };

        assert.equal(registrationRequiresInvite(register, { email: "user@example.com" }), true);
        assert.equal(registrationRequiresInvite(register, { email: "user@example.com", invite: "invite-code" }), false);
    });

    test("requires invites for guest registrations without email", () => {
        const register: RegistrationInviteConfiguration = {
            requireInvite: false,
            guestsRequireInvite: true,
        };

        assert.equal(registrationRequiresInvite(register, {}), true);
        assert.equal(registrationRequiresInvite(register, { invite: "invite-code" }), false);
        assert.equal(registrationRequiresInvite(register, { email: "user@example.com" }), false);
    });

    test("allows open registration when invite requirements are disabled", () => {
        const register: RegistrationInviteConfiguration = {
            requireInvite: false,
            guestsRequireInvite: false,
        };

        assert.equal(registrationRequiresInvite(register, {}), false);
    });

    test("rejects missing and expired invites before user creation", () => {
        assert.equal(isRegistrationInviteUsable(null), false);
        assert.equal(isRegistrationInviteUsable(undefined), false);
        assert.equal(isRegistrationInviteUsable({ isExpired: () => true }), false);
        assert.equal(isRegistrationInviteUsable({ isExpired: () => false }), true);
    });
});

describe("assertPasswordMeetsPolicy", () => {
    const policy = {
        minLength: 8,
        minNumbers: 2,
        minUpperCase: 2,
        minSymbols: 1,
        blocklist: ["Password123!"],
    };

    test("throws a password field error for the first unmet configured password policy requirement", () => {
        assert.throws(
            () => assertPasswordMeetsPolicy("AA1!aaaa", policy, translate),
            (error) => {
                const passwordError = getPasswordError(error);
                assert.equal(passwordError.code, "PASSWORD_REQUIREMENTS_MIN_NUMBERS");
                assert.equal(passwordError.message, "auth:register.PASSWORD_REQUIREMENTS_MIN_NUMBERS:2");
                return true;
            },
        );
    });

    test("throws a password field error for configured blocklisted passwords", () => {
        assert.throws(
            () => assertPasswordMeetsPolicy("Password123!", { ...policy, minUpperCase: 1, minSymbols: 0 }, translate),
            (error) => {
                assert.equal(getPasswordError(error).code, "PASSWORD_REQUIREMENTS_BLOCKLIST");
                return true;
            },
        );
    });

    test("allows passwords that satisfy the configured registration policy", () => {
        assert.doesNotThrow(() => assertPasswordMeetsPolicy("AA11!aaa", policy, translate));
    });
});

function translate(key: string, params?: Record<string, number>) {
    return params?.min === undefined ? key : `${key}:${params.min}`;
}

function getPasswordError(error: unknown) {
    return (error as { errors: { password: { _errors: { code: string; message: string }[] } } }).errors.password._errors[0];
}
