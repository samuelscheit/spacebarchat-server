import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { EVENTEnum } from "@spacebar/util";
import { OPCODES } from "../util";
import {
    canDispatchGuildPresenceUpdate,
    canDispatchGuildUserUpdate,
    canDispatchUserUpdate,
    handlePresenceUpdate,
    subscribeDirectUserEvent,
    subscribeGuildMemberEvent,
    toPublicUserUpdateData,
    unsubscribeDirectUserEvent,
} from "./listener";
import { trackGuildMemberEventId } from "./subscriptions";

type ListenerSocket = {
    events: Record<string, (() => Promise<unknown>) | undefined>;
    member_events: Record<string, () => Promise<unknown>>;
    guild_member_event_ids: Record<string, Set<string>>;
    member_event_guild_ids: Record<string, Set<string>>;
    sequence: number;
    sentPayloads: unknown[];
};

function createSocket(): ListenerSocket {
    const sentPayloads: unknown[] = [];

    return {
        OPEN: 1,
        close() {
            return undefined;
        },
        encoding: "json",
        events: {},
        guild_member_event_ids: {},
        member_event_guild_ids: {},
        member_events: {},
        readyState: 1,
        send(data: string, callback: (error?: Error) => void) {
            sentPayloads.push(JSON.parse(data));
            callback();
        },
        sequence: 0,
        sentPayloads,
    } as ListenerSocket;
}

function userUpdateData(id: string) {
    return {
        id,
        username: "visible",
        discriminator: "0001",
        email: "private@example.com",
        mfa_enabled: true,
        phone: "+15555550123",
        pronouns: null,
        settings: { locale: "en-US" },
    };
}

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

        assert.equal(canDispatchGuildUserUpdate(memberEventGuildIds, "visible-member"), true);
        assert.equal(canDispatchGuildUserUpdate(memberEventGuildIds, "hidden-member"), false);
        assert.equal(canDispatchGuildUserUpdate(memberEventGuildIds, undefined), false);
    });

    test("allows user updates tracked through any subscribed guild", () => {
        const guildMemberEventIds: Record<string, Set<string>> = {};
        const memberEventGuildIds: Record<string, Set<string>> = {};
        trackGuildMemberEventId(guildMemberEventIds, memberEventGuildIds, "guild-a", "member-a");
        trackGuildMemberEventId(guildMemberEventIds, memberEventGuildIds, "guild-b", "member-b");

        assert.equal(canDispatchGuildUserUpdate(memberEventGuildIds, "member-b"), true);
    });
});

describe("canDispatchUserUpdate", () => {
    test("allows updates for direct user subscriptions and lazy member subscriptions", () => {
        const guildMemberEventIds: Record<string, Set<string>> = {};
        const memberEventGuildIds: Record<string, Set<string>> = {};
        trackGuildMemberEventId(guildMemberEventIds, memberEventGuildIds, "guild", "visible-member");

        assert.equal(canDispatchUserUpdate({ friend: async () => undefined }, memberEventGuildIds, "friend"), true);
        assert.equal(canDispatchUserUpdate({}, memberEventGuildIds, "visible-member"), true);
        assert.equal(canDispatchUserUpdate({}, memberEventGuildIds, "hidden-member"), false);
        assert.equal(canDispatchUserUpdate({ friend: async () => undefined }, memberEventGuildIds, undefined), false);
    });
});

describe("toPublicUserUpdateData", () => {
    test("strips private fields from non-self user update payloads", () => {
        const data = toPublicUserUpdateData(userUpdateData("visible-member") as never);

        assert.equal(data.id, "visible-member");
        assert.equal(data.username, "visible");
        assert.equal(data.pronouns, "");
        assert.equal("email" in data, false);
        assert.equal("phone" in data, false);
        assert.equal("mfa_enabled" in data, false);
        assert.equal("settings" in data, false);
    });

    test("uses entity public serialization when available", () => {
        const data = toPublicUserUpdateData({
            id: "visible-member",
            email: "private@example.com",
            toPublicUser() {
                return { id: "visible-member", username: "from-method" };
            },
        } as never);

        assert.deepEqual(data, { id: "visible-member", username: "from-method" });
    });
});

describe("handlePresenceUpdate USER_UPDATE dispatch", () => {
    test("sends public user updates to direct user subscriptions", async () => {
        const socket = createSocket();
        socket.events["friend"] = async () => undefined;

        await handlePresenceUpdate.call(
            socket as never,
            {
                event: EVENTEnum.UserUpdate,
                user_id: "friend",
                data: userUpdateData("friend"),
            } as never,
        );

        assert.equal(socket.sentPayloads.length, 1);
        const payload = socket.sentPayloads[0] as { op: number; t: string; d: Record<string, unknown>; s: number };
        assert.equal(payload.op, OPCODES.Dispatch);
        assert.equal(payload.t, EVENTEnum.UserUpdate);
        assert.equal(payload.s, 0);
        assert.equal(payload.d.id, "friend");
        assert.equal(payload.d.username, "visible");
        assert.equal(payload.d.pronouns, "");
        assert.equal("email" in payload.d, false);
        assert.equal("phone" in payload.d, false);
        assert.equal("mfa_enabled" in payload.d, false);
        assert.equal("settings" in payload.d, false);
        assert.equal(socket.sequence, 1);
    });

    test("sends user updates for visible lazy member subscriptions without a direct subscription", async () => {
        const socket = createSocket();
        socket.member_events["visible-member"] = async () => undefined;
        trackGuildMemberEventId(socket.guild_member_event_ids, socket.member_event_guild_ids, "guild", "visible-member");

        await handlePresenceUpdate.call(
            socket as never,
            {
                event: EVENTEnum.UserUpdate,
                user_id: "visible-member",
                data: userUpdateData("visible-member"),
            } as never,
        );

        assert.equal(socket.sentPayloads.length, 1);
    });

    test("does not send user updates for hidden lazy member users", async () => {
        const socket = createSocket();
        socket.member_events["visible-member"] = async () => undefined;
        trackGuildMemberEventId(socket.guild_member_event_ids, socket.member_event_guild_ids, "guild", "visible-member");

        await handlePresenceUpdate.call(
            socket as never,
            {
                event: EVENTEnum.UserUpdate,
                user_id: "hidden-member",
                data: userUpdateData("hidden-member"),
            } as never,
        );

        assert.deepEqual(socket.sentPayloads, []);
    });

    test("uses the update payload id when RabbitMQ event metadata has no route id", async () => {
        const socket = createSocket();
        socket.member_events["visible-member"] = async () => undefined;
        trackGuildMemberEventId(socket.guild_member_event_ids, socket.member_event_guild_ids, "guild", "visible-member");

        await handlePresenceUpdate.call(
            socket as never,
            {
                event: EVENTEnum.UserUpdate,
                data: userUpdateData("visible-member"),
            } as never,
        );

        assert.equal(socket.sentPayloads.length, 1);
    });
});

describe("direct and lazy user subscription overlap", () => {
    test("tracks lazy membership without opening a duplicate listener when direct subscription already exists", async () => {
        const socket = createSocket();
        socket.events["friend"] = async () => undefined;

        assert.equal(await subscribeGuildMemberEvent.call(socket as never, "guild", "friend"), false);

        assert.deepEqual(socket.guild_member_event_ids, { guild: new Set(["friend"]) });
        assert.deepEqual(socket.member_event_guild_ids, { friend: new Set(["guild"]) });
        assert.deepEqual(socket.member_events, {});
    });

    test("promotes a lazy listener to a direct listener when a relationship is added", async () => {
        const socket = createSocket();
        const unsubscribe = async () => undefined;
        socket.member_events["friend"] = unsubscribe;
        trackGuildMemberEventId(socket.guild_member_event_ids, socket.member_event_guild_ids, "guild", "friend");

        await subscribeDirectUserEvent.call(socket as never, "friend", {});

        assert.deepEqual(socket.member_events, {});
        assert.equal(socket.events["friend"], unsubscribe);
        assert.deepEqual(socket.member_event_guild_ids, { friend: new Set(["guild"]) });
    });

    test("promotes a direct listener back to a lazy listener when a relationship is removed", async () => {
        const socket = createSocket();
        let cancelled = false;
        const unsubscribe = async () => {
            cancelled = true;
        };
        socket.events["friend"] = unsubscribe;
        trackGuildMemberEventId(socket.guild_member_event_ids, socket.member_event_guild_ids, "guild", "friend");

        await unsubscribeDirectUserEvent.call(socket as never, "friend");

        assert.equal(cancelled, false);
        assert.deepEqual(socket.events, {});
        assert.equal(socket.member_events["friend"], unsubscribe);
        assert.deepEqual(socket.member_event_guild_ids, { friend: new Set(["guild"]) });

        await handlePresenceUpdate.call(
            socket as never,
            {
                event: EVENTEnum.UserUpdate,
                user_id: "friend",
                data: userUpdateData("friend"),
            } as never,
        );
        assert.equal(socket.sentPayloads.length, 1);
    });

    test("cancels a direct listener when no lazy membership still needs it", async () => {
        const socket = createSocket();
        let cancelled = false;
        socket.events["friend"] = async () => {
            cancelled = true;
        };

        await unsubscribeDirectUserEvent.call(socket as never, "friend");

        assert.equal(cancelled, true);
        assert.deepEqual(socket.events, {});
        assert.deepEqual(socket.member_events, {});
    });
});
