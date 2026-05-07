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
