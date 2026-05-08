import { describe, test } from "node:test";
import assert from "node:assert/strict";

describe("executeWebhook", () => {
    test("uses the signed message response for wait=true responses", async (t) => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar";

        const util = require("../../../util") as typeof import("../../../util");
        const eventUtil = require("../../../util/util/Event") as typeof import("../../../util/util/Event");
        const messageHandlers = require("./Message") as typeof import("./Message");
        const messageResponse = require("../utility/MessageResponse") as typeof import("../utility/MessageResponse");

        const channel = {
            id: "channel-id",
            type: 0,
            last_message_id: undefined as string | undefined,
            threadOnly: () => false,
            isWritable: () => true,
            save: async () => undefined,
        };
        const webhook = {
            id: "webhook-id",
            token: "webhook-token",
            name: "webhook-name",
            avatar: null,
            channel_id: channel.id,
            channel,
            application: undefined,
        };
        const rawMessageResponse = {
            id: "message-id",
            attachments: [
                {
                    url: "https://cdn.example/attachments/channel-id/message-id/file.png",
                    proxy_url: "https://cdn.example/attachments/channel-id/message-id/file.png",
                },
            ],
        };
        const signedMessageResponse = {
            id: "message-id",
            attachments: [
                {
                    url: "https://cdn.example/attachments/channel-id/message-id/file.png?ex=123&is=456&hm=abc",
                    proxy_url: "https://cdn.example/attachments/channel-id/message-id/file.png?ex=123&is=456&hm=abc",
                },
            ],
        };
        const message = {
            id: "message-id",
            edited_timestamp: new Date(),
            save: async () => undefined,
            toJSON: () => rawMessageResponse,
        };
        let serializerCalled = false;

        t.mock.method(util.Snowflake, "generate", () => "message-id");
        t.mock.method(util.Config, "get", () => ({
            limits: {
                absoluteRate: {
                    sendMessage: {
                        enabled: false,
                        window: 1000,
                        limit: 10,
                    },
                },
            },
        }));
        t.mock.method(util.Webhook, "findOne", async () => webhook);
        t.mock.method(messageHandlers, "handleMessage", async () => message);
        t.mock.method(messageHandlers, "postHandleMessage", () => Promise.resolve());
        t.mock.method(eventUtil, "emitEvent", async () => undefined);
        t.mock.method(messageResponse, "messageToResponse", (handledMessage: unknown, request: unknown) => {
            serializerCalled = true;
            assert.equal(handledMessage, message);
            assert.equal((request as { ip: string }).ip, "203.0.113.10");
            assert.equal((request as { headers: Record<string, string> }).headers["user-agent"], "test-agent");
            return signedMessageResponse;
        });

        const { executeWebhook } = require("./Webhook") as typeof import("./Webhook");
        const req = {
            body: { content: "hello" },
            files: [],
            params: { webhook_id: webhook.id, token: webhook.token },
            query: { wait: "true" },
            ip: "203.0.113.10",
            headers: { "user-agent": "test-agent" },
            t: (key: string) => key,
        };
        const res = {
            body: undefined as unknown,
            statusCode: 200,
            sent: false,
            status(code: number) {
                this.statusCode = code;
                return this;
            },
            send() {
                this.sent = true;
                return this;
            },
            json(body: unknown) {
                this.body = body;
                return this;
            },
        };

        await executeWebhook(req as never, res as never);

        assert.equal(serializerCalled, true);
        assert.equal(res.body, signedMessageResponse);
        assert.notEqual(res.body, message);
        assert.equal(channel.last_message_id, "message-id");
    });

    test("sends webhook messages to the requested child thread", async (t) => {
        const util = require("../../../util") as typeof import("../../../util");
        const permissionUtil = require("../../../util/util/Permissions") as typeof import("../../../util/util/Permissions");
        const eventUtil = require("../../../util/util/Event") as typeof import("../../../util/util/Event");
        const messageHandlers = require("./Message") as typeof import("./Message");
        const messageResponse = require("../utility/MessageResponse") as typeof import("../utility/MessageResponse");

        const parentChannel = {
            id: "parent-channel-id",
            type: 0,
            guild_id: "guild-id",
            isWritable: () => true,
        };
        const threadChannel = {
            id: "thread-id",
            type: 11,
            guild_id: "guild-id",
            last_message_id: undefined as string | undefined,
            thread_metadata: {
                archived: true,
                archive_timestamp: "2026-01-01T00:00:00.000Z",
                auto_archive_duration: 60,
                create_timestamp: "2026-01-01T00:00:00.000Z",
                locked: false,
            },
            isThread: () => true,
            isWritable: () => true,
            save: async () => undefined,
            toJSON() {
                return { id: this.id, thread_metadata: this.thread_metadata };
            },
        };
        const webhook = {
            id: "webhook-id",
            token: "webhook-token",
            name: "webhook-name",
            avatar: null,
            channel_id: parentChannel.id,
            user_id: "webhook-user-id",
            channel: parentChannel,
            application: undefined,
        };
        const message = {
            id: "message-id",
            edited_timestamp: new Date(),
            save: async () => undefined,
            toJSON: () => ({ id: "message-id", channel_id: threadChannel.id }),
        };
        let handledPayload: { channel_id?: string } | undefined;
        const emittedEvents: Array<{ event?: string; channel_id?: string; data?: unknown }> = [];
        const permissionChecks: Array<{ userId: string; guildId: string | undefined; channel: unknown }> = [];

        t.mock.method(util.Snowflake, "generate", () => "message-id");
        t.mock.method(util.Config, "get", () => ({
            limits: {
                absoluteRate: {
                    sendMessage: {
                        enabled: false,
                        window: 1000,
                        limit: 10,
                    },
                },
            },
        }));
        t.mock.method(util.Webhook, "findOne", async () => webhook);
        t.mock.method(util.Channel, "findOneOrFail", async (options: unknown) => {
            assert.deepEqual(options, {
                where: {
                    id: threadChannel.id,
                    parent_id: parentChannel.id,
                },
            });
            return threadChannel;
        });
        t.mock.method(permissionUtil, "getPermission", async (userId: string, guildId: string | undefined, channel: unknown) => {
            permissionChecks.push({ userId, guildId, channel });
            return { hasThrow: () => undefined };
        });
        t.mock.method(messageHandlers, "handleMessage", async (payload: { channel_id?: string }) => {
            handledPayload = payload;
            return message;
        });
        t.mock.method(messageHandlers, "postHandleMessage", () => Promise.resolve());
        t.mock.method(eventUtil, "emitEvent", async (event: { event?: string; channel_id?: string; data?: unknown }) => {
            emittedEvents.push(event);
        });
        t.mock.method(messageResponse, "messageToResponse", (handledMessage: unknown) => handledMessage);

        const { executeWebhook } = require("./Webhook") as typeof import("./Webhook");
        const req = {
            body: { content: "hello thread" },
            files: [],
            params: { webhook_id: webhook.id, token: webhook.token },
            query: { wait: "true", thread_id: threadChannel.id },
            t: (key: string) => key,
        };
        const res = {
            body: undefined as unknown,
            json(body: unknown) {
                this.body = body;
                return this;
            },
        };

        await executeWebhook(req as never, res as never);

        assert.equal(handledPayload?.channel_id, threadChannel.id);
        assert.equal(threadChannel.last_message_id, message.id);
        assert.equal(threadChannel.thread_metadata.archived, false);
        assert.notEqual(threadChannel.thread_metadata.archive_timestamp, "2026-01-01T00:00:00.000Z");
        assert.deepEqual(
            emittedEvents.map((event) => [event.event, event.channel_id]),
            [
                ["THREAD_UPDATE", threadChannel.id],
                ["MESSAGE_CREATE", threadChannel.id],
            ],
        );
        assert.equal(res.body, message);
        assert.deepEqual(permissionChecks, [
            { userId: webhook.user_id, guildId: parentChannel.guild_id, channel: parentChannel },
            { userId: webhook.user_id, guildId: threadChannel.guild_id, channel: threadChannel },
        ]);
    });

    test("creates a public thread when thread_name is provided", async (t) => {
        const schemas = require("../../../schemas") as typeof import("../../../schemas");
        const util = require("../../../util") as typeof import("../../../util");
        const permissionUtil = require("../../../util/util/Permissions") as typeof import("../../../util/util/Permissions");
        const eventUtil = require("../../../util/util/Event") as typeof import("../../../util/util/Event");
        const messageHandlers = require("./Message") as typeof import("./Message");
        const messageResponse = require("../utility/MessageResponse") as typeof import("../utility/MessageResponse");

        const parentChannel = {
            id: "forum-channel-id",
            type: schemas.ChannelType.GUILD_FORUM,
            guild_id: "guild-id",
            guild: { id: "guild-id" },
            flags: 0,
            available_tags: [{ id: "tag-id", moderated: true }],
            default_auto_archive_duration: 60,
            threadOnly: () => true,
            isWritable: () => true,
        };
        const threadChannel = {
            id: "message-id",
            type: schemas.ChannelType.GUILD_PUBLIC_THREAD,
            guild_id: "guild-id",
            last_message_id: undefined as string | undefined,
            isThread: () => true,
            isWritable: () => true,
            save: async () => undefined,
        };
        const webhook = {
            id: "webhook-id",
            token: "webhook-token",
            name: "webhook-name",
            avatar: null,
            channel_id: parentChannel.id,
            user_id: "webhook-user-id",
            user: { id: "webhook-user-id" },
            channel: parentChannel,
            guild: parentChannel.guild,
            application: undefined,
        };
        const message = {
            id: "message-id",
            edited_timestamp: new Date(),
            save: async () => undefined,
            toJSON: () => ({ id: "message-id", channel_id: threadChannel.id }),
        };
        let handledPayload: { channel_id?: string } | undefined;
        const permissionChecks: Array<{ userId: string; guildId: string | undefined; channel: unknown }> = [];
        const permissionThrows: string[] = [];

        t.mock.method(util.Snowflake, "generate", () => "message-id");
        t.mock.method(util.Config, "get", () => ({
            limits: {
                absoluteRate: {
                    sendMessage: {
                        enabled: false,
                        window: 1000,
                        limit: 10,
                    },
                },
            },
        }));
        t.mock.method(util.Webhook, "findOne", async () => webhook);
        t.mock.method(util.Channel, "createThreadChannel", async (channel: unknown, metadata: unknown, userId: string, options: unknown) => {
            assert.deepEqual(channel, {
                id: "message-id",
                owner: webhook.user,
                parent: parentChannel,
                guild: parentChannel.guild,
                name: "Webhook thread",
                parent_id: parentChannel.id,
                guild_id: parentChannel.guild_id,
                type: schemas.ChannelType.GUILD_PUBLIC_THREAD,
                applied_tags: ["tag-id"],
                recipients: [],
            });
            assert.deepEqual(metadata, {
                archived: false,
                auto_archive_duration: parentChannel.default_auto_archive_duration,
                archive_timestamp: (metadata as { archive_timestamp: string }).archive_timestamp,
                locked: false,
                create_timestamp: (metadata as { create_timestamp: string }).create_timestamp,
            });
            assert.equal(userId, webhook.user_id);
            assert.deepEqual(options, { keepId: true, skipPermissionCheck: true });
            return threadChannel;
        });
        t.mock.method(permissionUtil, "getPermission", async (userId: string, guildId: string | undefined, channel: unknown) => {
            permissionChecks.push({ userId, guildId, channel });
            return {
                hasThrow: (permission: string) => {
                    permissionThrows.push(`${(channel as { id: string }).id}:${permission}`);
                },
            };
        });
        t.mock.method(messageHandlers, "handleMessage", async (payload: { channel_id?: string }) => {
            handledPayload = payload;
            return message;
        });
        t.mock.method(messageHandlers, "postHandleMessage", () => Promise.resolve());
        t.mock.method(eventUtil, "emitEvent", async () => undefined);
        t.mock.method(messageResponse, "messageToResponse", (handledMessage: unknown) => handledMessage);

        const { executeWebhook } = require("./Webhook") as typeof import("./Webhook");
        const req = {
            body: { content: "hello new thread", thread_name: "Webhook thread", applied_tags: ["tag-id"] },
            files: [],
            params: { webhook_id: webhook.id, token: webhook.token },
            query: { wait: "true" },
            t: (key: string) => key,
        };
        const res = {
            body: undefined as unknown,
            json(body: unknown) {
                this.body = body;
                return this;
            },
        };

        await executeWebhook(req as never, res as never);

        assert.equal(handledPayload?.channel_id, threadChannel.id);
        assert.equal(threadChannel.last_message_id, message.id);
        assert.equal(res.body, message);
        assert.deepEqual(permissionChecks, [{ userId: webhook.user_id, guildId: parentChannel.guild_id, channel: parentChannel }]);
        assert.deepEqual(permissionThrows, [`${parentChannel.id}:MANAGE_THREADS`, `${parentChannel.id}:CREATE_PUBLIC_THREADS`, `${parentChannel.id}:SEND_MESSAGES_IN_THREADS`]);
    });

    test("rejects ambiguous thread id and thread name webhook requests", async (t) => {
        const util = require("../../../util") as typeof import("../../../util");
        const messageHandlers = require("./Message") as typeof import("./Message");

        t.mock.method(util.Snowflake, "generate", () => "message-id");
        t.mock.method(messageHandlers, "handleMessage", async () => {
            throw new Error("handleMessage should not be called");
        });

        const { executeWebhook } = require("./Webhook") as typeof import("./Webhook");
        const req = {
            body: { content: "hello", thread_name: "ambiguous" },
            files: [],
            params: { webhook_id: "webhook-id", token: "webhook-token" },
            query: { wait: "true", thread_id: "thread-id" },
            t: (key: string) => key,
        };

        await assert.rejects(
            () => executeWebhook(req as never, {} as never),
            (error: { code?: number; errors?: Record<string, unknown> }) => {
                assert.equal(error.code, 50035);
                assert.ok(error.errors?.thread_name);
                return true;
            },
        );
    });

    test("rejects forum webhook execution without a target thread before message side effects", async (t) => {
        const schemas = require("../../../schemas") as typeof import("../../../schemas");
        const util = require("../../../util") as typeof import("../../../util");
        const permissionUtil = require("../../../util/util/Permissions") as typeof import("../../../util/util/Permissions");
        const messageHandlers = require("./Message") as typeof import("./Message");

        const parentChannel = {
            id: "forum-channel-id",
            type: schemas.ChannelType.GUILD_FORUM,
            guild_id: "guild-id",
            flags: 0,
            available_tags: [],
            threadOnly: () => true,
            isWritable: () => true,
        };
        const webhook = {
            id: "webhook-id",
            token: "webhook-token",
            name: "webhook-name",
            avatar: null,
            channel_id: parentChannel.id,
            user_id: "webhook-user-id",
            channel: parentChannel,
            application: undefined,
        };
        let handleMessageCalled = false;

        t.mock.method(util.Snowflake, "generate", () => "message-id");
        t.mock.method(util.Config, "get", () => ({
            limits: {
                absoluteRate: {
                    sendMessage: {
                        enabled: false,
                        window: 1000,
                        limit: 10,
                    },
                },
            },
        }));
        t.mock.method(util.Webhook, "findOne", async () => webhook);
        t.mock.method(permissionUtil, "getPermission", async () => ({ hasThrow: () => undefined }));
        t.mock.method(messageHandlers, "handleMessage", async () => {
            handleMessageCalled = true;
            throw new Error("handleMessage should not be called");
        });

        const { executeWebhook } = require("./Webhook") as typeof import("./Webhook");
        const req = {
            body: { content: "hello forum parent" },
            files: [],
            params: { webhook_id: webhook.id, token: webhook.token },
            query: { wait: "true" },
            t: (key: string) => key,
        };

        await assert.rejects(
            () => executeWebhook(req as never, {} as never),
            (error: { code?: number; errors?: Record<string, unknown> }) => {
                assert.equal(error.code, 50035);
                assert.ok(error.errors?.thread_name);
                return true;
            },
        );
        assert.equal(handleMessageCalled, false);
    });

    test("rejects webhook sends to locked threads before message side effects", async (t) => {
        const util = require("../../../util") as typeof import("../../../util");
        const permissionUtil = require("../../../util/util/Permissions") as typeof import("../../../util/util/Permissions");
        const messageHandlers = require("./Message") as typeof import("./Message");

        const parentChannel = {
            id: "parent-channel-id",
            type: 0,
            guild_id: "guild-id",
            isWritable: () => true,
        };
        const threadChannel = {
            id: "thread-id",
            type: 11,
            guild_id: "guild-id",
            thread_metadata: {
                archived: false,
                archive_timestamp: "2026-01-01T00:00:00.000Z",
                auto_archive_duration: 60,
                create_timestamp: "2026-01-01T00:00:00.000Z",
                locked: true,
            },
            isThread: () => true,
        };
        const webhook = {
            id: "webhook-id",
            token: "webhook-token",
            name: "webhook-name",
            avatar: null,
            channel_id: parentChannel.id,
            user_id: "webhook-user-id",
            channel: parentChannel,
            application: undefined,
        };
        let handleMessageCalled = false;

        t.mock.method(util.Snowflake, "generate", () => "message-id");
        t.mock.method(util.Config, "get", () => ({
            limits: {
                absoluteRate: {
                    sendMessage: {
                        enabled: false,
                        window: 1000,
                        limit: 10,
                    },
                },
            },
        }));
        t.mock.method(util.Webhook, "findOne", async () => webhook);
        t.mock.method(util.Channel, "findOneOrFail", async () => threadChannel);
        t.mock.method(permissionUtil, "getPermission", async () => ({ hasThrow: () => undefined }));
        t.mock.method(messageHandlers, "handleMessage", async () => {
            handleMessageCalled = true;
            throw new Error("handleMessage should not be called");
        });

        const { executeWebhook } = require("./Webhook") as typeof import("./Webhook");
        const req = {
            body: { content: "hello locked thread" },
            files: [],
            params: { webhook_id: webhook.id, token: webhook.token },
            query: { wait: "true", thread_id: threadChannel.id },
            t: (key: string) => key,
        };

        await assert.rejects(
            () => executeWebhook(req as never, {} as never),
            (error) => {
                assert.equal(error, util.DiscordApiErrors.THREAD_IS_LOCKED);
                return true;
            },
        );
        assert.equal(handleMessageCalled, false);
    });

    test("checks thread send permission before creating a webhook thread", async (t) => {
        const schemas = require("../../../schemas") as typeof import("../../../schemas");
        const util = require("../../../util") as typeof import("../../../util");
        const permissionUtil = require("../../../util/util/Permissions") as typeof import("../../../util/util/Permissions");
        const messageHandlers = require("./Message") as typeof import("./Message");

        const parentChannel = {
            id: "forum-channel-id",
            type: schemas.ChannelType.GUILD_FORUM,
            guild_id: "guild-id",
            guild: { id: "guild-id" },
            flags: 0,
            available_tags: [],
            threadOnly: () => true,
            isWritable: () => true,
        };
        const webhook = {
            id: "webhook-id",
            token: "webhook-token",
            name: "webhook-name",
            avatar: null,
            channel_id: parentChannel.id,
            user_id: "webhook-user-id",
            user: { id: "webhook-user-id" },
            channel: parentChannel,
            guild: parentChannel.guild,
            application: undefined,
        };
        let createThreadCalled = false;
        let handleMessageCalled = false;

        t.mock.method(util.Snowflake, "generate", () => "message-id");
        t.mock.method(util.Config, "get", () => ({
            limits: {
                absoluteRate: {
                    sendMessage: {
                        enabled: false,
                        window: 1000,
                        limit: 10,
                    },
                },
            },
        }));
        t.mock.method(util.Webhook, "findOne", async () => webhook);
        t.mock.method(util.Channel, "createThreadChannel", async () => {
            createThreadCalled = true;
            throw new Error("createThreadChannel should not be called");
        });
        t.mock.method(permissionUtil, "getPermission", async () => ({
            hasThrow: (permission: string) => {
                if (permission === "SEND_MESSAGES_IN_THREADS") throw new Error("missing SEND_MESSAGES_IN_THREADS");
            },
        }));
        t.mock.method(messageHandlers, "handleMessage", async () => {
            handleMessageCalled = true;
            throw new Error("handleMessage should not be called");
        });

        const { executeWebhook } = require("./Webhook") as typeof import("./Webhook");
        const req = {
            body: { content: "hello new thread", thread_name: "Webhook thread" },
            files: [],
            params: { webhook_id: webhook.id, token: webhook.token },
            query: { wait: "true" },
            t: (key: string) => key,
        };

        await assert.rejects(() => executeWebhook(req as never, {} as never), /missing SEND_MESSAGES_IN_THREADS/);
        assert.equal(createThreadCalled, false);
        assert.equal(handleMessageCalled, false);
    });

    test("rejects webhook thread creation before side effects when a required forum tag is missing", async (t) => {
        const schemas = require("../../../schemas") as typeof import("../../../schemas");
        const util = require("../../../util") as typeof import("../../../util");
        const permissionUtil = require("../../../util/util/Permissions") as typeof import("../../../util/util/Permissions");
        const messageHandlers = require("./Message") as typeof import("./Message");

        const parentChannel = {
            id: "forum-channel-id",
            type: schemas.ChannelType.GUILD_FORUM,
            guild_id: "guild-id",
            guild: { id: "guild-id" },
            flags: Number(util.ChannelFlags.FLAGS.REQUIRE_TAG),
            available_tags: [{ id: "tag-id", moderated: false }],
            threadOnly: () => true,
            isWritable: () => true,
        };
        const webhook = {
            id: "webhook-id",
            token: "webhook-token",
            name: "webhook-name",
            avatar: null,
            channel_id: parentChannel.id,
            user_id: "webhook-user-id",
            user: { id: "webhook-user-id" },
            channel: parentChannel,
            guild: parentChannel.guild,
            application: undefined,
        };
        let createThreadCalled = false;
        let handleMessageCalled = false;

        t.mock.method(util.Snowflake, "generate", () => "message-id");
        t.mock.method(util.Config, "get", () => ({
            limits: {
                absoluteRate: {
                    sendMessage: {
                        enabled: false,
                        window: 1000,
                        limit: 10,
                    },
                },
            },
        }));
        t.mock.method(util.Webhook, "findOne", async () => webhook);
        t.mock.method(util.Channel, "createThreadChannel", async () => {
            createThreadCalled = true;
            throw new Error("createThreadChannel should not be called");
        });
        t.mock.method(permissionUtil, "getPermission", async () => ({ hasThrow: () => undefined }));
        t.mock.method(messageHandlers, "handleMessage", async () => {
            handleMessageCalled = true;
            throw new Error("handleMessage should not be called");
        });

        const { executeWebhook } = require("./Webhook") as typeof import("./Webhook");
        const req = {
            body: { content: "hello new thread", thread_name: "Webhook thread" },
            files: [],
            params: { webhook_id: webhook.id, token: webhook.token },
            query: { wait: "true" },
            t: (key: string) => key,
        };

        await assert.rejects(
            () => executeWebhook(req as never, {} as never),
            (error: { code?: number; errors?: Record<string, unknown> }) => {
                assert.equal(error.code, 50035);
                assert.ok(error.errors?.applied_tags);
                return true;
            },
        );
        assert.equal(createThreadCalled, false);
        assert.equal(handleMessageCalled, false);
    });
});

describe("PATCH /webhooks/:webhook_id/:token", () => {
    test("returns the Discord unknown webhook error when the id is missing", async (t) => {
        const util = require("../../../util") as typeof import("../../../util");
        const { updateWebhookWithToken } = require("./Webhook") as typeof import("./Webhook");

        t.mock.method(util.Webhook, "findOne", async () => null);

        const req = {
            params: { webhook_id: "missing_webhook_id", token: "valid_token" },
            body: { name: "Renamed webhook" },
        };
        const res = {};

        await assert.rejects(
            () => updateWebhookWithToken(req as never, res as never),
            (error) => {
                assert.equal(error, util.DiscordApiErrors.UNKNOWN_WEBHOOK);
                return true;
            },
        );
    });

    test("rejects an invalid webhook token before applying metadata updates", async (t) => {
        const util = require("../../../util") as typeof import("../../../util");
        const { updateWebhookWithToken } = require("./Webhook") as typeof import("./Webhook");
        let assigned = false;
        let saved = false;

        t.mock.method(util.Webhook, "findOne", async (options: unknown) => {
            assert.deepEqual(options, {
                where: { id: "webhook_id" },
                relations: { user: true, channel: true, source_channel: true, guild: true, source_guild: true, application: true },
            });

            return {
                id: "webhook_id",
                token: "valid_token",
                channel_id: "channel_id",
                guild_id: "guild_id",
                assign: () => {
                    assigned = true;
                },
                save: async () => {
                    saved = true;
                },
            };
        });

        const req = {
            params: { webhook_id: "webhook_id", token: "wrong_token" },
            body: { name: "Renamed webhook" },
        };
        const res = {};

        await assert.rejects(
            () => updateWebhookWithToken(req as never, res as never),
            (error) => {
                assert.equal(error, util.DiscordApiErrors.INVALID_WEBHOOK_TOKEN_PROVIDED);
                return true;
            },
        );
        assert.equal(assigned, false);
        assert.equal(saved, false);
    });

    test("only applies token-auth metadata fields and returns the updated webhook", async (t) => {
        const util = require("../../../util") as typeof import("../../../util");
        const eventUtil = require("../../../util/util/Event") as typeof import("../../../util/util/Event");
        let assigned: unknown;
        let saved = false;
        let responseBody: unknown;

        t.mock.method(util.Config, "get", () => ({
            api: { endpointPublic: "https://api.example.test" },
            limits: { user: { maxUsername: 32 } },
            user: { blockedContains: [], blockedEquals: [] },
            webhook: { blockedNameRegexPatterns: [] },
        }));
        t.mock.method(eventUtil, "emitEvent", async () => undefined);
        t.mock.method(util.Webhook, "findOne", async () => {
            const webhook = {
                id: "webhook_id",
                type: 1,
                token: "valid_token",
                channel_id: "original_channel_id",
                guild_id: "guild_id",
                name: "Original webhook",
                avatar: null,
                assign(update: unknown) {
                    assigned = update;
                    Object.assign(this, update);
                },
                save: async () => {
                    saved = true;
                },
            };

            return webhook;
        });
        const { updateWebhookWithToken } = require("./Webhook") as typeof import("./Webhook");

        const req = {
            params: { webhook_id: "webhook_id", token: "valid_token" },
            body: { name: "Renamed webhook", channel_id: "attacker_channel_id" },
        };
        const res = {
            json(body: unknown) {
                responseBody = body;
                return this;
            },
        };

        await updateWebhookWithToken(req as never, res as never);

        assert.deepEqual(assigned, { name: "Renamed webhook" });
        assert.equal(saved, true);
        assert.equal((responseBody as { id: string }).id, "webhook_id");
        assert.equal((responseBody as { token: string }).token, "valid_token");
        assert.equal((responseBody as { channel_id: string }).channel_id, "original_channel_id");
        assert.equal((responseBody as { name: string }).name, "Renamed webhook");
        assert.match((responseBody as { url: string }).url, /\/webhooks\/webhook_id\/valid_token$/);
    });
});
