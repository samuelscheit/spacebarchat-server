import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { canDispatchGuildPresenceUpdate, canDispatchGuildUserUpdate, canDispatchUserUpdate } from "./listener";
import { trackGuildMemberEventId } from "./subscriptions";

describe("canDispatchGuildPresenceUpdate", () => {
    test("allows direct user presence routes used for friends and DMs", () => {
        assert.equal(canDispatchGuildPresenceUpdate({}, undefined, "member"), true);
    });

    test("allows guild presence routes only for tracked lazy member subscriptions", () => {
        const guildMemberEventIds: Record<string, Set<string>> = {};
        const memberEventGuildIds: Record<string, Set<string>> = {};
        trackGuildMemberEventId(guildMemberEventIds, memberEventGuildIds, "guild", "visible-member");

        assert.equal(canDispatchGuildPresenceUpdate(guildMemberEventIds, "guild", "visible-member"), true);
        assert.equal(canDispatchGuildPresenceUpdate(guildMemberEventIds, "guild", "hidden-member"), false);
        assert.equal(canDispatchGuildPresenceUpdate(guildMemberEventIds, "guild", undefined), false);
    });
});

describe("canDispatchGuildUserUpdate", () => {
    test("allows user updates for users tracked by a lazy member subscription", () => {
        const guildMemberEventIds: Record<string, Set<string>> = {};
        const memberEventGuildIds: Record<string, Set<string>> = {};
        trackGuildMemberEventId(guildMemberEventIds, memberEventGuildIds, "guild", "visible-member");

        assert.equal(canDispatchGuildUserUpdate(guildMemberEventIds, "visible-member"), true);
        assert.equal(canDispatchGuildUserUpdate(guildMemberEventIds, "hidden-member"), false);
        assert.equal(canDispatchGuildUserUpdate(guildMemberEventIds, undefined), false);
    });

    test("allows user updates tracked through any subscribed guild", () => {
        const guildMemberEventIds: Record<string, Set<string>> = {};
        const memberEventGuildIds: Record<string, Set<string>> = {};
        trackGuildMemberEventId(guildMemberEventIds, memberEventGuildIds, "guild-a", "member-a");
        trackGuildMemberEventId(guildMemberEventIds, memberEventGuildIds, "guild-b", "member-b");

        assert.equal(canDispatchGuildUserUpdate(guildMemberEventIds, "member-b"), true);
    });
});

describe("canDispatchUserUpdate", () => {
    test("allows updates for direct user subscriptions and lazy member subscriptions", () => {
        const guildMemberEventIds: Record<string, Set<string>> = {};
        const memberEventGuildIds: Record<string, Set<string>> = {};
        trackGuildMemberEventId(guildMemberEventIds, memberEventGuildIds, "guild", "visible-member");

        assert.equal(canDispatchUserUpdate({ friend: async () => undefined }, guildMemberEventIds, "friend"), true);
        assert.equal(canDispatchUserUpdate({}, guildMemberEventIds, "visible-member"), true);
        assert.equal(canDispatchUserUpdate({}, guildMemberEventIds, "hidden-member"), false);
        assert.equal(canDispatchUserUpdate({ friend: async () => undefined }, guildMemberEventIds, undefined), false);
    });
});
