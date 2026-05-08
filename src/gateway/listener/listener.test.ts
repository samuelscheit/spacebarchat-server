import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { afterEach, describe, test } from "node:test";

import type { FindManyOptions } from "typeorm";

import { canDispatchGuildPresenceUpdate, getListenerSetupData, listenerDependencies, setupListener, type ListenerSetupData } from "./listener";
import type { WebSocket } from "../util";
import { trackGuildMemberEventId } from "./subscriptions";

process.env.DATABASE ??= "postgres://user:password@localhost:5432/spacebar";

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
