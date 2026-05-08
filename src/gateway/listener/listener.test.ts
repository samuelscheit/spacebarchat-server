import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Capabilities } from "../util/Capabilities";
import { canDispatchDebouncedMessageReactions, canDispatchGuildPresenceUpdate } from "./listener";
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

describe("canDispatchDebouncedMessageReactions", () => {
    test("requires the DEBOUNCE_MESSAGE_REACTIONS capability", () => {
        assert.equal(canDispatchDebouncedMessageReactions(undefined), false);
        assert.equal(canDispatchDebouncedMessageReactions(new Capabilities()), false);
        assert.equal(canDispatchDebouncedMessageReactions(new Capabilities("DEBOUNCE_MESSAGE_REACTIONS")), true);
    });
});
