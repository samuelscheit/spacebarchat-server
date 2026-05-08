import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { afterEach, describe, test } from "node:test";

import type { FindManyOptions } from "typeorm";

import type { WebSocket } from "@spacebar/gateway";
import { Intents } from "@spacebar/util";
import { CLOSECODES } from "../util";
import {
    canDispatchEventForIntents,
    canDispatchGuildMemberEvent,
    canDispatchGuildPresenceUpdate,
    consumeListenerEvent,
    getIntentGuildIdForEvent,
    getListenerSetupData,
    getRequiredIntentForEvent,
    listenerDependencies,
    setupListener,
    type ListenerSetupData,
} from "./listener";
import { trackGuildMemberEventId } from "./subscriptions";

process.env.DATABASE ??= "postgres://user:password@localhost:5432/spacebar";

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
