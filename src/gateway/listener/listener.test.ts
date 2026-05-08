import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { canDispatchGuildPresenceUpdate, handleGuildMemberSubscriptionEvent } from "./listener";
import { trackGuildMemberEventId } from "./subscriptions";
import type { WebSocket } from "../util";

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

describe("handleGuildMemberSubscriptionEvent", () => {
    test("keeps lazy member subscriptions active after member profile updates", async () => {
        const socket = createSubscriptionSocket();
        trackGuildMemberEventId(socket.guild_member_event_ids, socket.member_event_guild_ids, "guild", "visible-member");
        socket.member_events["visible-member"] = async () => {
            throw new Error("member update should not unsubscribe");
        };

        await handleGuildMemberSubscriptionEvent(socket, "GUILD_MEMBER_UPDATE", "guild", "visible-member");

        assert.equal(socket.guild_member_event_ids.guild?.has("visible-member"), true);
        assert.equal(socket.member_event_guild_ids["visible-member"]?.has("guild"), true);
        assert.equal("visible-member" in socket.member_events, true);
    });

    test("removes lazy member subscriptions when a member leaves the guild", async () => {
        const socket = createSubscriptionSocket();
        let unsubscribed = false;
        trackGuildMemberEventId(socket.guild_member_event_ids, socket.member_event_guild_ids, "guild", "departing-member");
        socket.member_events["departing-member"] = async () => {
            unsubscribed = true;
        };

        await handleGuildMemberSubscriptionEvent(socket, "GUILD_MEMBER_REMOVE", "guild", "departing-member");

        assert.equal(unsubscribed, true);
        assert.equal(socket.guild_member_event_ids.guild, undefined);
        assert.equal(socket.member_event_guild_ids["departing-member"], undefined);
        assert.equal(socket.member_events["departing-member"], undefined);
    });
});

function createSubscriptionSocket(): WebSocket {
    return {
        member_events: {},
        guild_member_event_ids: {},
        member_event_guild_ids: {},
    } as WebSocket;
}
