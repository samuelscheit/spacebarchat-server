import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { canCreateServerDm, shouldCheckServerDmPrivacy } from "./DmPrivacy";

describe("canCreateServerDm", () => {
    test("allows friends even when recipient restricts guild DMs", () => {
        assert.equal(
            canCreateServerDm({
                isBlocked: false,
                isFriend: true,
                recipientSettings: { default_guilds_restricted: true },
                sharedGuildIds: ["guild-a"],
            }),
            true,
        );
    });

    test("blocks DMs when either user blocked the other", () => {
        assert.equal(
            canCreateServerDm({
                isBlocked: true,
                isFriend: true,
                recipientSettings: { default_guilds_restricted: false },
                sharedGuildIds: ["guild-a"],
            }),
            false,
        );
    });

    test("blocks non-friend DMs without shared guild context", () => {
        assert.equal(
            canCreateServerDm({
                isBlocked: false,
                isFriend: false,
                recipientSettings: { default_guilds_restricted: true },
                sharedGuildIds: [],
            }),
            false,
        );
    });

    test("allows shared-guild DMs when recipient has no restrictions", () => {
        assert.equal(
            canCreateServerDm({
                isBlocked: false,
                isFriend: false,
                recipientSettings: null,
                sharedGuildIds: ["guild-a"],
            }),
            true,
        );
    });

    test("blocks server DMs when recipient restricts all guilds by default", () => {
        assert.equal(
            canCreateServerDm({
                isBlocked: false,
                isFriend: false,
                recipientSettings: { default_guilds_restricted: true },
                sharedGuildIds: ["guild-a"],
            }),
            false,
        );
    });

    test("blocks server DMs when every shared guild is restricted", () => {
        assert.equal(
            canCreateServerDm({
                isBlocked: false,
                isFriend: false,
                recipientSettings: { restricted_guilds: ["guild-a", "guild-b"] },
                sharedGuildIds: ["guild-a", "guild-b"],
            }),
            false,
        );
    });

    test("allows server DMs when at least one shared guild is unrestricted", () => {
        assert.equal(
            canCreateServerDm({
                isBlocked: false,
                isFriend: false,
                recipientSettings: { restricted_guilds: ["guild-a"] },
                sharedGuildIds: ["guild-a", "guild-b"],
            }),
            true,
        );
    });
});

describe("shouldCheckServerDmPrivacy", () => {
    test("checks privacy for a fresh one-to-one DM", () => {
        assert.equal(
            shouldCheckServerDmPrivacy({
                recipientCount: 1,
                existingCreatorRecipientClosed: null,
            }),
            true,
        );
    });

    test("checks privacy before reopening a closed existing one-to-one DM", () => {
        assert.equal(
            shouldCheckServerDmPrivacy({
                recipientCount: 1,
                existingCreatorRecipientClosed: true,
            }),
            true,
        );
        assert.equal(
            canCreateServerDm({
                isBlocked: false,
                isFriend: false,
                recipientSettings: { default_guilds_restricted: true },
                sharedGuildIds: ["guild-a"],
            }),
            false,
        );
        assert.equal(
            canCreateServerDm({
                isBlocked: false,
                isFriend: false,
                recipientSettings: { restricted_guilds: ["guild-a"] },
                sharedGuildIds: ["guild-a"],
            }),
            false,
        );
    });

    test("checks privacy before a direct message send reopens a closed one-to-one DM", () => {
        assert.equal(
            shouldCheckServerDmPrivacy({
                recipientCount: 1,
                existingCreatorRecipientClosed: true,
            }),
            true,
        );
    });

    test("skips privacy when the existing one-to-one DM is already open", () => {
        assert.equal(
            shouldCheckServerDmPrivacy({
                recipientCount: 1,
                existingCreatorRecipientClosed: false,
            }),
            false,
        );
    });

    test("skips privacy for group DMs and note-to-self channels", () => {
        assert.equal(
            shouldCheckServerDmPrivacy({
                recipientCount: 2,
                existingCreatorRecipientClosed: true,
            }),
            false,
        );
        assert.equal(
            shouldCheckServerDmPrivacy({
                recipientCount: 0,
                existingCreatorRecipientClosed: null,
            }),
            false,
        );
    });
});
