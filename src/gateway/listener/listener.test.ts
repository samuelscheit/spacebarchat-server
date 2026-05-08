import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Intents } from "@spacebar/util";
import { canDispatchGuildMemberEvent, canDispatchGuildPresenceUpdate } from "./listener";
import { trackGuildMemberEventId } from "./subscriptions";

describe("canDispatchGuildMemberEvent", () => {
    test("allows current-user member updates without the GUILD_MEMBERS intent", () => {
        const intents = new Intents(0);

        assert.equal(canDispatchGuildMemberEvent("GUILD_MEMBER_UPDATE", "current-user", intents, "current-user"), true);
    });

    test("requires GUILD_MEMBERS intent for other users' member updates", () => {
        const withoutGuildMembers = new Intents(0);
        const withGuildMembers = new Intents(Intents.FLAGS.GUILD_MEMBERS);

        assert.equal(canDispatchGuildMemberEvent("GUILD_MEMBER_UPDATE", "current-user", withoutGuildMembers, "other-user"), false);
        assert.equal(canDispatchGuildMemberEvent("GUILD_MEMBER_UPDATE", "current-user", withGuildMembers, "other-user"), true);
        assert.equal(canDispatchGuildMemberEvent("GUILD_MEMBER_UPDATE", "current-user", withGuildMembers, undefined), false);
    });

    test("requires GUILD_MEMBERS intent for member add and remove dispatches", () => {
        const withoutGuildMembers = new Intents(0);
        const withGuildMembers = new Intents(Intents.FLAGS.GUILD_MEMBERS);

        for (const event of ["GUILD_MEMBER_ADD", "GUILD_MEMBER_REMOVE"] as const) {
            assert.equal(canDispatchGuildMemberEvent(event, "current-user", withoutGuildMembers, "current-user"), false);
            assert.equal(canDispatchGuildMemberEvent(event, "current-user", withoutGuildMembers, "other-user"), false);
            assert.equal(canDispatchGuildMemberEvent(event, "current-user", withGuildMembers, "other-user"), true);
        }
    });
});

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
