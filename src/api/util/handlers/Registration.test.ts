import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isRegistrationInviteUsable, RegistrationInviteConfiguration, registrationRequiresInvite } from "./Registration";

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
