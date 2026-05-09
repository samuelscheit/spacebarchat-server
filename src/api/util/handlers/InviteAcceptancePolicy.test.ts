import assert from "node:assert/strict";
import { GuildFeature } from "../../../util/util/GuildFeatures";
import { describe, test } from "node:test";
import { getInviteAcceptanceDenial, InviteAcceptanceUserFlags } from "./InviteAcceptancePolicy";

describe("getInviteAcceptanceDenial", () => {
    test("denies banned users before other invite policies", () => {
        assert.equal(
            getInviteAcceptanceDenial({
                banned: true,
                features: [GuildFeature.InvitesDisabled],
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
                features: [GuildFeature.InternalEmployeeOnly],
                publicFlags: 0,
            }),
            GuildFeature.InternalEmployeeOnly,
        );
    });

    test("allows staff users into internal employee guilds", () => {
        assert.equal(
            getInviteAcceptanceDenial({
                features: [GuildFeature.InternalEmployeeOnly],
                publicFlags: InviteAcceptanceUserFlags.DISCORD_EMPLOYEE,
            }),
            undefined,
        );
    });

    test("denies guilds with invite joins disabled", () => {
        assert.equal(
            getInviteAcceptanceDenial({
                features: [GuildFeature.InvitesDisabled],
                publicFlags: 0,
            }),
            GuildFeature.InvitesDisabled,
        );
    });
});
