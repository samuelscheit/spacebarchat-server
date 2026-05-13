import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { afterEach, describe, test } from "node:test";

import type { FindManyOptions } from "typeorm";

import type { WebSocket } from "@spacebar/gateway";
import { EVENTEnum, EventOpts, Intents } from "@spacebar/util";
import { CLOSECODES, OPCODES } from "../util";
import { Capabilities } from "../util/Capabilities";
import {
    canDispatchDebouncedMessageReactions,
    canDispatchEventForIntents,
    canDispatchGuildMemberEvent,
    canDispatchGuildPresenceUpdate,
    canDispatchGuildUserUpdate,
    canDispatchIntentEvent,
    canDispatchUserUpdate,
    consumeListenerEvent,
    getIntentGuildIdForEvent,
    getListenerSetupData,
    getRequiredIntentForEvent,
    handleGuildMemberSubscriptionEvent,
    handlePresenceUpdate,
    listenerDependencies,
    shouldSubscribeChannelRouteEvents,
    shouldSubscribeDirectMessageEvents,
    shouldSubscribeGuildChannelEvents,
    shouldSubscribeGuildEvents,
    shouldSubscribePresenceEvents,
    setupListener,
    subscribeDirectUserEvent,
    subscribeGuildMemberEvent,
    toPublicUserUpdateData,
    unsubscribeDirectUserEvent,
    type ListenerSetupData,
} from "./listener";
import { trackGuildMemberEventId } from "./subscriptions";

process.env.DATABASE ??= "postgres://user:password@localhost:5432/spacebar";

function eventOpts(event: string, data: Record<string, unknown> = {}, guild_id?: string, channel_id?: string) {
    return { event, data, guild_id, channel_id } as Pick<EventOpts, "channel_id" | "data" | "event" | "guild_id">;
}

function createDispatchSocket(intents: Intents) {
    const sentPayloads: unknown[] = [];
    const socket = Object.assign(new EventEmitter(), {
        user_id: "listener-user",
        session_id: "listener-session",
        events: {},
        member_events: {},
        guild_event_ids: {},
        guild_member_event_ids: {},
        member_event_guild_ids: {},
        permissions: {},
        recentTransactions: [],
        sequence: 0,
        intents,
        encoding: "json",
        readyState: 1,
        OPEN: 1,
        sentPayloads,
        send(payload: string, callback?: (error?: Error) => void) {
            sentPayloads.push(JSON.parse(payload));
            callback?.();
        },
        close: () => undefined,
    });

    return socket as unknown as WebSocket & { sentPayloads: unknown[] };
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
        const socket = createDispatchSocket(new Intents(Intents.FLAGS.GUILD_PRESENCES));
        socket.events["friend"] = async () => undefined;

        await handlePresenceUpdate.call(socket, {
            event: EVENTEnum.UserUpdate,
            user_id: "friend",
            data: userUpdateData("friend"),
        } as never);

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
        const socket = createDispatchSocket(new Intents(Intents.FLAGS.GUILD_PRESENCES));
        socket.member_events["visible-member"] = async () => undefined;
        trackGuildMemberEventId(socket.guild_member_event_ids, socket.member_event_guild_ids, "guild", "visible-member");

        await handlePresenceUpdate.call(socket, {
            event: EVENTEnum.UserUpdate,
            user_id: "visible-member",
            data: userUpdateData("visible-member"),
        } as never);

        assert.equal(socket.sentPayloads.length, 1);
    });

    test("does not send user updates for hidden lazy member users", async () => {
        const socket = createDispatchSocket(new Intents(Intents.FLAGS.GUILD_PRESENCES));
        socket.member_events["visible-member"] = async () => undefined;
        trackGuildMemberEventId(socket.guild_member_event_ids, socket.member_event_guild_ids, "guild", "visible-member");

        await handlePresenceUpdate.call(socket, {
            event: EVENTEnum.UserUpdate,
            user_id: "hidden-member",
            data: userUpdateData("hidden-member"),
        } as never);

        assert.deepEqual(socket.sentPayloads, []);
    });

    test("uses the update payload id when RabbitMQ event metadata has no route id", async () => {
        const socket = createDispatchSocket(new Intents(Intents.FLAGS.GUILD_PRESENCES));
        socket.member_events["visible-member"] = async () => undefined;
        trackGuildMemberEventId(socket.guild_member_event_ids, socket.member_event_guild_ids, "guild", "visible-member");

        await handlePresenceUpdate.call(socket, {
            event: EVENTEnum.UserUpdate,
            data: userUpdateData("visible-member"),
        } as never);

        assert.equal(socket.sentPayloads.length, 1);
    });
});

describe("direct and lazy user subscription overlap", () => {
    test("tracks lazy membership without opening a duplicate listener when direct subscription already exists", async () => {
        const socket = createDispatchSocket(new Intents(Intents.FLAGS.GUILD_PRESENCES));
        socket.events["friend"] = async () => undefined;

        assert.equal(await subscribeGuildMemberEvent.call(socket, "guild", "friend"), false);

        assert.deepEqual(socket.guild_member_event_ids, { guild: new Set(["friend"]) });
        assert.deepEqual(socket.member_event_guild_ids, { friend: new Set(["guild"]) });
        assert.deepEqual(socket.member_events, {});
    });

    test("promotes a lazy listener to a direct listener when a relationship is added", async () => {
        const socket = createDispatchSocket(new Intents(Intents.FLAGS.GUILD_PRESENCES));
        const unsubscribe = async () => undefined;
        socket.member_events["friend"] = unsubscribe;
        trackGuildMemberEventId(socket.guild_member_event_ids, socket.member_event_guild_ids, "guild", "friend");

        await subscribeDirectUserEvent.call(socket, "friend", {});

        assert.deepEqual(socket.member_events, {});
        assert.equal(socket.events["friend"], unsubscribe);
        assert.deepEqual(socket.member_event_guild_ids, { friend: new Set(["guild"]) });
    });

    test("promotes a direct listener back to a lazy listener when a relationship is removed", async () => {
        const socket = createDispatchSocket(new Intents(Intents.FLAGS.GUILD_PRESENCES));
        let cancelled = false;
        const unsubscribe = async () => {
            cancelled = true;
        };
        socket.events["friend"] = unsubscribe;
        trackGuildMemberEventId(socket.guild_member_event_ids, socket.member_event_guild_ids, "guild", "friend");

        await unsubscribeDirectUserEvent.call(socket, "friend");

        assert.equal(cancelled, false);
        assert.deepEqual(socket.events, {});
        assert.equal(socket.member_events["friend"], unsubscribe);
        assert.deepEqual(socket.member_event_guild_ids, { friend: new Set(["guild"]) });

        await handlePresenceUpdate.call(socket, {
            event: EVENTEnum.UserUpdate,
            user_id: "friend",
            data: userUpdateData("friend"),
        } as never);
        assert.equal(socket.sentPayloads.length, 1);
    });

    test("cancels a direct listener when no lazy membership still needs it", async () => {
        const socket = createDispatchSocket(new Intents(Intents.FLAGS.GUILD_PRESENCES));
        let cancelled = false;
        socket.events["friend"] = async () => {
            cancelled = true;
        };

        await unsubscribeDirectUserEvent.call(socket, "friend");

        assert.equal(cancelled, true);
        assert.deepEqual(socket.events, {});
        assert.deepEqual(socket.member_events, {});
    });
});

describe("consumeListenerEvent", () => {
    test("acknowledges and closes invalidated events before reading dispatch data", async () => {
        const operations: string[] = [];
        const socket = {
            events: {},
            recentTransactions: [],
            sequence: 7,
            close: (code?: number, reason?: string) => {
                operations.push(`close:${code}:${reason}`);
            },
        };
        const event = {
            event: "INVALIDATED" as const,
            acknowledge: () => {
                operations.push("acknowledge");
            },
            cancel: () => undefined,
            get data(): never {
                throw new Error("control events must not read dispatch data");
            },
        };

        await consumeListenerEvent.call(socket as unknown as WebSocket, event);

        assert.deepEqual(operations, [`acknowledge`, `close:${CLOSECODES.Authentication_failed}:Invalidated Token`]);
        assert.equal(socket.sequence, 7);
    });

    test("filters USER_DELETE dispatches by the identified session intent", async () => {
        const withoutInstanceUserUpdates = createDispatchSocket(new Intents(0n));

        await consumeListenerEvent.call(withoutInstanceUserUpdates, {
            event: "USER_DELETE",
            data: { user_id: "deleted-user" },
        } as EventOpts);

        assert.deepEqual(withoutInstanceUserUpdates.sentPayloads, []);
        assert.equal(withoutInstanceUserUpdates.sequence, 0);

        const withInstanceUserUpdates = createDispatchSocket(new Intents(Intents.ERKINALP_FLAGS.INSTANCE_USER_UPDATES));

        await consumeListenerEvent.call(withInstanceUserUpdates, {
            event: "USER_DELETE",
            data: { user_id: "deleted-user" },
        } as EventOpts);

        assert.deepEqual(withInstanceUserUpdates.sentPayloads, [
            {
                op: OPCODES.Dispatch,
                t: "USER_DELETE",
                d: { user_id: "deleted-user" },
                s: 0,
            },
        ]);
        assert.equal(withInstanceUserUpdates.sequence, 1);
    });
});

describe("gateway intent dispatch filtering", () => {
    test("maps guild events to their required guild intent", () => {
        assert.equal(getRequiredIntentForEvent("GUILD_CREATE", "guild"), Intents.FLAGS.GUILDS);
        assert.equal(getRequiredIntentForEvent("PRESENCE_UPDATE", "guild"), Intents.FLAGS.GUILD_PRESENCES);
        assert.equal(getRequiredIntentForEvent("INVITE_CREATE", "guild"), Intents.FLAGS.GUILD_INVITES);
    });

    test("infers guild context for user-routed guild events", () => {
        assert.equal(getIntentGuildIdForEvent({ event: "GUILD_CREATE", data: { id: "guild" } }), "guild");
        assert.equal(canDispatchEventForIntents(new Intents(0), "GUILD_CREATE", "guild"), false);
        assert.equal(canDispatchEventForIntents(new Intents(Intents.FLAGS.GUILDS), "GUILD_CREATE", "guild"), true);
    });

    test("does not infer guild context from non-guild object identifiers", () => {
        assert.equal(getIntentGuildIdForEvent({ event: "MESSAGE_CREATE", data: { id: "message" } }), undefined);
        assert.equal(getIntentGuildIdForEvent({ event: "CHANNEL_CREATE", data: { id: "channel" } }), undefined);
        assert.equal(getIntentGuildIdForEvent({ event: "MESSAGE_CREATE", data: { guild_id: "guild", id: "message" } }), "guild");
    });

    test("maps direct-message events to direct-message intents", () => {
        assert.equal(getRequiredIntentForEvent("MESSAGE_CREATE", undefined), Intents.FLAGS.DIRECT_MESSAGES);
        assert.equal(getRequiredIntentForEvent("MESSAGE_REACTION_ADD", undefined), Intents.FLAGS.DIRECT_MESSAGE_REACTIONS);
    });

    test("distinguishes shared event names by guild context", () => {
        const guildMessages = new Intents(Intents.FLAGS.GUILD_MESSAGES);
        const dmMessages = new Intents(Intents.FLAGS.DIRECT_MESSAGES);

        assert.equal(canDispatchEventForIntents(guildMessages, "MESSAGE_CREATE", "guild"), true);
        assert.equal(canDispatchEventForIntents(dmMessages, "MESSAGE_CREATE", "guild"), false);
        assert.equal(canDispatchEventForIntents(dmMessages, "MESSAGE_CREATE", undefined), true);
        assert.equal(canDispatchEventForIntents(guildMessages, "MESSAGE_CREATE", undefined), false);
        assert.equal(canDispatchEventForIntents(dmMessages, "MESSAGE_CREATE", getIntentGuildIdForEvent({ event: "MESSAGE_CREATE", data: { id: "message" } })), true);
    });

    test("allows current-user guild member updates without the guild members intent", () => {
        assert.equal(canDispatchEventForIntents(new Intents(0), "GUILD_MEMBER_UPDATE", "guild", "current-user", { user: { id: "current-user" } }), true);
        assert.equal(canDispatchEventForIntents(new Intents(0), "GUILD_MEMBER_UPDATE", "guild", "current-user", { user: { id: "other-user" } }), false);
    });

    test("requires the guild members intent for thread membership updates", () => {
        assert.equal(getRequiredIntentForEvent("THREAD_MEMBERS_UPDATE", "guild"), Intents.FLAGS.GUILD_MEMBERS);
        assert.equal(canDispatchEventForIntents(new Intents(0), "THREAD_MEMBERS_UPDATE", "guild"), false);
        assert.equal(canDispatchEventForIntents(new Intents(Intents.FLAGS.GUILDS), "THREAD_MEMBERS_UPDATE", "guild"), false);
        assert.equal(canDispatchEventForIntents(new Intents(Intents.FLAGS.GUILD_MEMBERS), "THREAD_MEMBERS_UPDATE", "guild"), true);
    });

    test("requires voice-state intent without gating stream control events", () => {
        assert.equal(getRequiredIntentForEvent("VOICE_STATE_UPDATE", "guild"), Intents.FLAGS.GUILD_VOICE_STATES);
        assert.equal(canDispatchEventForIntents(new Intents(0), "VOICE_STATE_UPDATE", "guild"), false);
        assert.equal(canDispatchEventForIntents(new Intents(Intents.FLAGS.GUILD_VOICE_STATES), "VOICE_STATE_UPDATE", "guild"), true);
        assert.equal(canDispatchEventForIntents(new Intents(0), "STREAM_CREATE", "guild"), true);
        assert.equal(canDispatchEventForIntents(new Intents(0), "STREAM_SERVER_UPDATE", "guild"), true);
        assert.equal(canDispatchEventForIntents(new Intents(0), "STREAM_DELETE", "guild"), true);
    });

    test("treats unmapped gateway events as passthrough", () => {
        assert.equal(canDispatchEventForIntents(new Intents(0), "USER_UPDATE", undefined), true);
        assert.equal(canDispatchEventForIntents(new Intents(0), "APPLICATION_COMMAND_CREATE", "guild"), true);
        assert.equal(canDispatchEventForIntents(undefined, "APPLICATION_COMMAND_UPDATE", "guild"), true);
    });

    test("denies mapped gateway events when intents are missing", () => {
        assert.equal(canDispatchEventForIntents(undefined, "GUILD_CREATE", "guild"), false);
        assert.equal(canDispatchEventForIntents(undefined, "MESSAGE_CREATE", "guild"), false);
        assert.equal(canDispatchEventForIntents(undefined, "MESSAGE_CREATE", undefined), false);
        assert.equal(canDispatchEventForIntents(undefined, "AUTO_MODERATION_RULE_CREATE", "guild"), false);
    });

    test("maps common auto moderation events to their intents", () => {
        assert.equal(getRequiredIntentForEvent("AUTO_MODERATION_RULE_CREATE", "guild"), Intents.FLAGS.AUTO_MODERATION_CONFIGURATION);
        assert.equal(getRequiredIntentForEvent("AUTO_MODERATION_ACTION_EXECUTION", "guild"), Intents.FLAGS.AUTO_MODERATION_EXECUTION);
        assert.equal(canDispatchEventForIntents(new Intents(0), "AUTO_MODERATION_RULE_CREATE", "guild"), false);
    });

    test("requires the instance user updates intent for USER_DELETE", () => {
        const noIntents = new Intents(0n);
        const instanceUserUpdates = new Intents(Intents.ERKINALP_FLAGS.INSTANCE_USER_UPDATES);

        assert.equal(getRequiredIntentForEvent("USER_DELETE", undefined), Intents.ERKINALP_FLAGS.INSTANCE_USER_UPDATES);
        assert.equal(canDispatchEventForIntents(undefined, "USER_DELETE", undefined), false);
        assert.equal(canDispatchEventForIntents(noIntents, "USER_DELETE", undefined), false);
        assert.equal(canDispatchEventForIntents(instanceUserUpdates, "USER_DELETE", undefined), true);
        assert.equal(canDispatchIntentEvent(noIntents, eventOpts("USER_DELETE", { user_id: "deleted-user" })), false);
        assert.equal(canDispatchIntentEvent(instanceUserUpdates, eventOpts("USER_DELETE", { user_id: "deleted-user" })), true);
    });
});

describe("getListenerSetupData", () => {
    test("returns preloaded Identify setup data without querying listener entities", async () => {
        const { Member, Recipient, Relationship } = require("@spacebar/util");
        const originalMemberFind = Member.find;
        const originalRecipientFind = Recipient.find;
        const originalRelationshipFind = Relationship.find;
        const preloaded: ListenerSetupData = {
            guilds: [],
            dm_channels: [],
            relationships: [],
            permissions: {},
        };

        try {
            Member.find = async () => assert.fail("Member.find should not be called for preloaded setup data");
            Recipient.find = async () => assert.fail("Recipient.find should not be called for preloaded setup data");
            Relationship.find = async () => assert.fail("Relationship.find should not be called for preloaded setup data");

            assert.equal(await getListenerSetupData("user", preloaded), preloaded);
        } finally {
            Member.find = originalMemberFind;
            Recipient.find = originalRecipientFind;
            Relationship.find = originalRelationshipFind;
        }
    });

    test("falls back to database queries when no Identify setup data is provided", async () => {
        const { Member, Recipient, Relationship } = require("@spacebar/util");
        const originalMemberFind = Member.find;
        const originalRecipientFind = Recipient.find;
        const originalRelationshipFind = Relationship.find;
        const calls: string[] = [];

        try {
            Member.find = async (options: FindManyOptions) => {
                calls.push("members");
                assert.deepEqual(options.where, { id: "user" });
                assert.deepEqual(options.relations, { guild: { channels: true } });
                return [{ guild: { id: "guild", channels: [] } }];
            };
            Recipient.find = async (options: FindManyOptions) => {
                calls.push("recipients");
                assert.deepEqual(options.where, { user_id: "user", closed: false });
                assert.deepEqual(options.relations, { channel: true });
                return [{ channel: { id: "dm" } }];
            };
            Relationship.find = async (options: FindManyOptions) => {
                calls.push("relationships");
                assert.deepEqual(options.where, { from_id: "user", type: 1 });
                return [{ to_id: "friend" }];
            };

            assert.deepEqual(await getListenerSetupData("user"), {
                guilds: [{ id: "guild", channels: [] }],
                dm_channels: [{ id: "dm" }],
                relationships: [{ to_id: "friend" }],
            });
            assert.deepEqual(calls.sort(), ["members", "recipients", "relationships"]);
        } finally {
            Member.find = originalMemberFind;
            Recipient.find = originalRecipientFind;
            Relationship.find = originalRelationshipFind;
        }
    });
});

describe("setupListener", () => {
    afterEach(() => {
        const { RabbitMQ } = require("@spacebar/util");
        RabbitMQ.connection = undefined;
    });

    test("filters preloaded Identify guild data to the socket shard", async () => {
        const { Permissions } = require("@spacebar/util");
        const originalListenEventDependency = listenerDependencies.listenEvent;
        const originalGetPermission = listenerDependencies.getPermission;
        const guildOnShard0 = (8n << 22n).toString();
        const guildOnShard1 = (9n << 22n).toString();
        const shardPermission = new Permissions("VIEW_CHANNEL");
        shardPermission.cache = { roles: [{ id: guildOnShard0 }], user_id: "user" };
        const offShardPermission = new Permissions("VIEW_CHANNEL");
        offShardPermission.cache = { roles: [{ id: guildOnShard1 }], user_id: "user" };
        const setupData: ListenerSetupData = {
            guilds: [
                {
                    id: guildOnShard0,
                    channels: [{ id: "visible-channel", permission_overwrites: [] }],
                },
                {
                    id: guildOnShard1,
                    channels: [{ id: "off-shard-channel", permission_overwrites: [] }],
                },
            ],
            dm_channels: [],
            relationships: [],
            permissions: {
                [guildOnShard0]: shardPermission,
                [guildOnShard1]: offShardPermission,
            },
        };
        const subscriptions: string[] = [];
        const socket = new EventEmitter() as WebSocket;
        Object.assign(socket, {
            user_id: "user",
            session_id: "session",
            events: {},
            member_events: {},
            guild_event_ids: {},
            guild_member_event_ids: {},
            member_event_guild_ids: {},
            permissions: {},
            recentTransactions: [],
            sequence: 0,
            intents: { has: () => true },
            shard_id: 0n,
            shard_count: 2n,
            close: (code: number, reason: string) => assert.fail(`unexpected close ${code} ${reason}`),
        });

        try {
            listenerDependencies.getPermission = async () => assert.fail("preloaded shard permissions should be reused");
            listenerDependencies.listenEvent = async (eventId: string) => {
                subscriptions.push(eventId);
                return async () => undefined;
            };

            await setupListener.call(socket, setupData);

            assert.deepEqual(subscriptions.sort(), ["session", "user", "visible-channel", guildOnShard0].sort());
            assert.deepEqual(Object.keys(socket.permissions), [guildOnShard0]);
        } finally {
            listenerDependencies.listenEvent = originalListenEventDependency;
            listenerDependencies.getPermission = originalGetPermission;
            socket.emit("close");
            await socket.closeCleanup;
        }
    });

    test("uses Identify setup data for initial subscriptions and fetches fresh data on reconnect", async () => {
        const util = require("@spacebar/util");
        const { Member, Permissions, RabbitMQ, Recipient, Relationship } = util;
        const originalMemberFind = Member.find;
        const originalRecipientFind = Recipient.find;
        const originalRelationshipFind = Relationship.find;
        const originalGetPermission = listenerDependencies.getPermission;
        const listenerPermission = new Permissions("VIEW_CHANNEL");
        listenerPermission.cache = { roles: [{ id: "guild" }], user_id: "user" };
        const setupData: ListenerSetupData = {
            guilds: [
                {
                    id: "guild",
                    channels: [
                        { id: "visible-channel", permission_overwrites: [] },
                        {
                            id: "hidden-channel",
                            permission_overwrites: [
                                {
                                    id: "guild",
                                    type: 0,
                                    allow: "0",
                                    deny: Permissions.FLAGS.VIEW_CHANNEL.toString(),
                                },
                            ],
                        },
                    ],
                },
            ],
            dm_channels: [{ id: "dm" }],
            relationships: [{ to_id: "friend" }],
            permissions: { guild: listenerPermission },
        };
        const subscriptions: string[] = [];
        let initialSetup = true;
        let dbQueriesAfterReconnect = 0;
        let getPermissionCalls = 0;
        let reconnect: (() => void) | undefined;

        try {
            Member.find = async () => {
                if (initialSetup) assert.fail("initial setup should reuse Identify guild data");
                dbQueriesAfterReconnect++;
                return [{ guild: { id: "reconnect-guild", channels: [{ id: "reconnect-channel", permission_overwrites: [] }] } }];
            };
            Recipient.find = async () => {
                if (initialSetup) assert.fail("initial setup should reuse Identify DM data");
                dbQueriesAfterReconnect++;
                return [];
            };
            Relationship.find = async () => {
                if (initialSetup) assert.fail("initial setup should reuse Identify relationship data");
                dbQueriesAfterReconnect++;
                return [];
            };
            listenerDependencies.getPermission = async (userId?: string, guildId?: unknown) => {
                getPermissionCalls++;
                assert.equal(userId, "user");
                assert.equal(guildId, "reconnect-guild");
                const permissions = new Permissions("VIEW_CHANNEL");
                permissions.cache = { roles: [{ id: guildId }], user_id: userId };
                return permissions;
            };

            const socket = new EventEmitter() as WebSocket;
            Object.assign(socket, {
                user_id: "user",
                session_id: "session",
                events: {},
                member_events: {},
                guild_event_ids: {},
                guild_member_event_ids: {},
                member_event_guild_ids: {},
                permissions: {},
                recentTransactions: [],
                sequence: 0,
                intents: { has: () => true },
                close: (code: number, reason: string) => assert.fail(`unexpected close ${code} ${reason}`),
            });
            RabbitMQ.connection = {
                createChannel: async () => ({
                    queues: {},
                    ch: 1,
                    on: () => undefined,
                    off: () => undefined,
                    close: async () => undefined,
                }),
            };
            const originalOn = RabbitMQ.on;
            const originalOff = RabbitMQ.off;
            RabbitMQ.on = (event: "reconnected" | "disconnected", listener: () => void) => {
                if (event === "reconnected") reconnect = listener;
            };
            RabbitMQ.off = () => undefined;

            const originalListenEvent = RabbitMQ.listenEvent;
            // listenEvent is exported directly from @spacebar/util; listenerDependencies makes subscription side effects injectable for this unit test.
            const originalListenEventDependency = listenerDependencies.listenEvent;
            const fakeListenEvent = async (eventId: string) => {
                subscriptions.push(eventId);
                return async () => undefined;
            };
            RabbitMQ.listenEvent = fakeListenEvent;
            listenerDependencies.listenEvent = fakeListenEvent;

            try {
                await setupListener.call(socket, setupData);
                assert.deepEqual(subscriptions.sort(), ["dm", "friend", "guild", "session", "user", "visible-channel"]);
                assert.deepEqual(Object.keys(socket.permissions), ["guild"]);
                assert.equal(getPermissionCalls, 0);

                subscriptions.length = 0;
                initialSetup = false;
                assert.ok(reconnect);
                reconnect();
                await new Promise<void>((resolve) => {
                    setImmediate(resolve);
                });

                assert.equal(dbQueriesAfterReconnect, 3);
                assert.equal(getPermissionCalls, 1);
                assert.deepEqual(subscriptions.sort(), ["reconnect-channel", "reconnect-guild", "session", "user"]);
            } finally {
                RabbitMQ.listenEvent = originalListenEvent;
                listenerDependencies.listenEvent = originalListenEventDependency;
                socket.emit("close");
                await socket.closeCleanup;
                RabbitMQ.on = originalOn;
                RabbitMQ.off = originalOff;
            }
        } finally {
            Member.find = originalMemberFind;
            Recipient.find = originalRecipientFind;
            Relationship.find = originalRelationshipFind;
            listenerDependencies.getPermission = originalGetPermission;
        }
    });
});

describe("canDispatchDebouncedMessageReactions", () => {
    test("requires the DEBOUNCE_MESSAGE_REACTIONS capability", () => {
        assert.equal(canDispatchDebouncedMessageReactions(undefined), false);
        assert.equal(canDispatchDebouncedMessageReactions(new Capabilities()), false);
        assert.equal(canDispatchDebouncedMessageReactions(new Capabilities("DEBOUNCE_MESSAGE_REACTIONS")), true);
    });
});

describe("gateway listener intent filtering", () => {
    test("allows guild events only when their connection intent is present", () => {
        const noIntents = new Intents(0n);
        const guildMessages = new Intents(Intents.FLAGS.GUILD_MESSAGES);

        assert.equal(canDispatchIntentEvent(noIntents, eventOpts("MESSAGE_CREATE", { guild_id: "guild" })), false);
        assert.equal(canDispatchIntentEvent(guildMessages, eventOpts("MESSAGE_CREATE", { guild_id: "guild" })), true);
    });

    test("uses direct message intents for non-guild message routes", () => {
        const guildMessages = new Intents(Intents.FLAGS.GUILD_MESSAGES);
        const directMessages = new Intents(Intents.FLAGS.DIRECT_MESSAGES);

        assert.equal(canDispatchIntentEvent(guildMessages, eventOpts("MESSAGE_CREATE", { channel_id: "dm" })), false);
        assert.equal(canDispatchIntentEvent(directMessages, eventOpts("MESSAGE_CREATE", { channel_id: "dm" })), true);
    });

    test("uses tracked guild channel routes when guild message payloads omit guild_id", () => {
        const guildMessages = new Intents(Intents.FLAGS.GUILD_MESSAGES);
        const directMessages = new Intents(Intents.FLAGS.DIRECT_MESSAGES);
        const guildEventIds = { guild: new Set(["guild-channel"]) };
        const guildMessageRoute = eventOpts("MESSAGE_CREATE", { id: "message", channel_id: "guild-channel" }, undefined, "guild-channel");
        const directMessageRoute = eventOpts("MESSAGE_CREATE", { id: "message", channel_id: "dm-channel" }, undefined, "dm-channel");
        const guildMessageWithoutTopLevelChannel = eventOpts("MESSAGE_CREATE", { id: "message", channel_id: "guild-channel" });

        assert.equal(canDispatchIntentEvent(guildMessages, guildMessageRoute, guildEventIds), true);
        assert.equal(canDispatchIntentEvent(guildMessages, guildMessageWithoutTopLevelChannel, guildEventIds), true);
        assert.equal(canDispatchIntentEvent(directMessages, guildMessageRoute, guildEventIds), false);
        assert.equal(canDispatchIntentEvent(directMessages, directMessageRoute, guildEventIds), true);
    });

    test("requires the guild presences intent for presence updates", () => {
        const noIntents = new Intents(0n);
        const guildPresences = new Intents(Intents.FLAGS.GUILD_PRESENCES);

        assert.equal(canDispatchIntentEvent(noIntents, eventOpts("PRESENCE_UPDATE", { guild_id: "guild" })), false);
        assert.equal(canDispatchIntentEvent(guildPresences, eventOpts("PRESENCE_UPDATE", { guild_id: "guild" })), true);
    });

    test("allows current-user guild member updates without the guild members intent", () => {
        const noIntents = new Intents(0n);

        assert.equal(canDispatchIntentEvent(noIntents, eventOpts("GUILD_MEMBER_UPDATE", { guild_id: "guild", user: { id: "current-user" } }), {}, "current-user"), true);
        assert.equal(canDispatchIntentEvent(noIntents, eventOpts("GUILD_MEMBER_UPDATE", { guild_id: "guild", user: { id: "other-user" } }), {}, "current-user"), false);
    });

    test("keeps custom and internal listener events as passthrough", () => {
        const noIntents = new Intents(0n);

        assert.equal(canDispatchIntentEvent(noIntents, eventOpts("SPACEBAR_CUSTOM_EVENT")), true);
        assert.equal(canDispatchIntentEvent(noIntents, eventOpts("SB_SESSION_CLOSE")), true);
    });

    test("derives route subscription categories from connection intents", () => {
        const noIntents = new Intents(0n);
        const directMessages = new Intents(Intents.FLAGS.DIRECT_MESSAGES);
        const guilds = new Intents(Intents.FLAGS.GUILDS);
        const guildMembers = new Intents(Intents.FLAGS.GUILD_MEMBERS);
        const guildInvites = new Intents(Intents.FLAGS.GUILD_INVITES);
        const guildVoiceStates = new Intents(Intents.FLAGS.GUILD_VOICE_STATES);
        const guildMessages = new Intents(Intents.FLAGS.GUILD_MESSAGES);
        const automodConfiguration = new Intents(Intents.FLAGS.AUTO_MODERATION_CONFIGURATION);
        const presences = new Intents(Intents.FLAGS.GUILD_PRESENCES);

        assert.equal(shouldSubscribeDirectMessageEvents(noIntents), false);
        assert.equal(shouldSubscribeGuildEvents(noIntents), false);
        assert.equal(shouldSubscribeGuildChannelEvents(noIntents), false);
        assert.equal(shouldSubscribePresenceEvents(noIntents), false);

        assert.equal(shouldSubscribeDirectMessageEvents(directMessages), true);
        assert.equal(shouldSubscribeGuildEvents(guilds), true);
        assert.equal(shouldSubscribeGuildChannelEvents(guilds), true);
        assert.equal(shouldSubscribeGuildEvents(guildMembers), true);
        assert.equal(shouldSubscribeGuildChannelEvents(guildMembers), false);
        assert.equal(shouldSubscribeGuildEvents(guildInvites), true);
        assert.equal(shouldSubscribeGuildChannelEvents(guildInvites), false);
        assert.equal(shouldSubscribeGuildEvents(guildVoiceStates), true);
        assert.equal(shouldSubscribeGuildChannelEvents(guildVoiceStates), true);
        assert.equal(shouldSubscribeGuildEvents(guildMessages), true);
        assert.equal(shouldSubscribeGuildChannelEvents(guildMessages), true);
        assert.equal(shouldSubscribeGuildEvents(automodConfiguration), true);
        assert.equal(shouldSubscribeGuildChannelEvents(automodConfiguration), false);
        assert.equal(shouldSubscribePresenceEvents(presences), true);
        assert.equal(shouldSubscribeGuildChannelEvents(presences), false);
    });

    test("uses direct message intents for non-guild channel lifecycle events", () => {
        const guilds = new Intents(Intents.FLAGS.GUILDS);
        const directMessages = new Intents(Intents.FLAGS.DIRECT_MESSAGES);
        const guildChannelCreate = eventOpts("CHANNEL_CREATE", { id: "guild-channel", guild_id: "guild" });
        const directChannelCreate = eventOpts("CHANNEL_CREATE", { id: "dm-channel", type: 1 });

        assert.equal(canDispatchIntentEvent(guilds, guildChannelCreate), true);
        assert.equal(canDispatchIntentEvent(directMessages, guildChannelCreate), false);
        assert.equal(canDispatchIntentEvent(guilds, directChannelCreate), false);
        assert.equal(canDispatchIntentEvent(directMessages, directChannelCreate), true);
        assert.equal(canDispatchIntentEvent(directMessages, eventOpts("CHANNEL_RECIPIENT_REMOVE", { channel_id: "dm-channel" })), true);
    });

    test("keeps dynamic channel route subscriptions in the matching guild or DM intent bucket", () => {
        const guildMessages = new Intents(Intents.FLAGS.GUILD_MESSAGES);
        const directMessages = new Intents(Intents.FLAGS.DIRECT_MESSAGES);
        const guildEventIds = { guild: new Set(["guild-channel"]) };
        const guildChannelRoute = eventOpts("CHANNEL_UPDATE", { id: "guild-channel", guild_id: "guild" }, undefined, "guild-channel");
        const trackedGuildChannelRoute = eventOpts("CHANNEL_UPDATE", { id: "guild-channel" }, undefined, "guild-channel");
        const directChannelRoute = eventOpts("CHANNEL_UPDATE", { id: "dm-channel", type: 1 }, undefined, "dm-channel");

        assert.equal(shouldSubscribeChannelRouteEvents(guildMessages, guildChannelRoute, guildEventIds), true);
        assert.equal(shouldSubscribeChannelRouteEvents(guildMessages, trackedGuildChannelRoute, guildEventIds), true);
        assert.equal(shouldSubscribeChannelRouteEvents(guildMessages, directChannelRoute, guildEventIds), false);
        assert.equal(shouldSubscribeChannelRouteEvents(directMessages, guildChannelRoute, guildEventIds), false);
        assert.equal(shouldSubscribeChannelRouteEvents(directMessages, directChannelRoute, guildEventIds), true);
    });

    test("uses current invite and thread member event names from the intent maps", () => {
        assert.ok(Intents.GUILD_INTENT_TO_EVENTS_MAP[6].includes("INVITE_CREATE"));
        assert.ok(Intents.GUILD_INTENT_TO_EVENTS_MAP[6].includes("INVITE_DELETE"));
        assert.ok(Intents.GUILD_INTENT_TO_EVENTS_MAP[7].includes("VOICE_CHANNEL_STATUS_UPDATE"));
        assert.ok(Intents.GUILD_INTENT_TO_EVENTS_MAP[1].includes("THREAD_MEMBERS_UPDATE"));
        assert.equal(Intents.GUILD_INTENT_TO_EVENTS_MAP[1].includes("THREAD_MEMBERS_UPDATE "), false);
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
