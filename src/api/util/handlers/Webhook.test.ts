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
