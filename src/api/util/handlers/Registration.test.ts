import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isRegistrationInviteUsable, RegistrationInviteConfiguration, registrationRequiresInvite, validateRegistrationDateOfBirth } from "./Registration";

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

describe("validateRegistrationDateOfBirth", () => {
    const now = new Date("2026-05-08T12:00:00.000Z");

    test("requires date_of_birth only when configured as required", () => {
        assert.equal(validateRegistrationDateOfBirth({ required: true, minimum: 13 }, undefined, now), "required");
        assert.equal(validateRegistrationDateOfBirth({ required: false, minimum: 13 }, undefined, now), undefined);
    });

    test("validates supplied date_of_birth even when optional", () => {
        const config = { required: false, minimum: 13 };

        assert.equal(validateRegistrationDateOfBirth(config, "", now), "invalid");
        assert.equal(validateRegistrationDateOfBirth(config, "2010-02-31", now), "invalid");
        assert.equal(validateRegistrationDateOfBirth(config, "2000-04-03", now), undefined);
    });

    test("enforces configured minimum age for supplied date_of_birth", () => {
        const config = { required: true, minimum: 13 };

        assert.equal(validateRegistrationDateOfBirth(config, "2013-05-08", now), undefined);
        assert.equal(validateRegistrationDateOfBirth(config, "2013-05-09", now), "underage");
    });
});
