import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getInviteAcceptanceDenial, InviteAcceptanceUserFlags } from "./InviteAcceptancePolicy";

describe("getInviteAcceptanceDenial", () => {
    test("denies banned users before other invite policies", () => {
        assert.equal(
            getInviteAcceptanceDenial({
                banned: true,
                features: ["INVITES_DISABLED"],
                publicFlags: InviteAcceptanceUserFlags.DISCORD_EMPLOYEE,
            }),
            "USER_BANNED",
        );
    });

    test("denies quarantined users", () => {
        assert.equal(
            getInviteAcceptanceDenial({
                features: [],
                publicFlags: InviteAcceptanceUserFlags.QUARANTINED,
            }),
            "QUARANTINED",
        );
    });

    test("denies non-staff users from internal employee guilds", () => {
        assert.equal(
            getInviteAcceptanceDenial({
                features: ["INTERNAL_EMPLOYEE_ONLY"],
                publicFlags: 0,
            }),
            "INTERNAL_EMPLOYEE_ONLY",
        );
    });

    test("allows staff users into internal employee guilds", () => {
        assert.equal(
            getInviteAcceptanceDenial({
                features: ["INTERNAL_EMPLOYEE_ONLY"],
                publicFlags: InviteAcceptanceUserFlags.DISCORD_EMPLOYEE,
            }),
            undefined,
        );
    });

    test("denies guilds with invite joins disabled", () => {
        assert.equal(
            getInviteAcceptanceDenial({
                features: ["INVITES_DISABLED"],
                publicFlags: 0,
            }),
            "INVITES_DISABLED",
        );
    });
});
