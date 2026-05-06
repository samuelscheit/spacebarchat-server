import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildWebhooksUpdateEvent, buildWebhooksUpdateEventData } from "./WebhookEvents";

describe("webhook event helpers", () => {
    test("builds webhook update event data from persisted webhook ids", () => {
        assert.deepEqual(
            buildWebhooksUpdateEventData({
                channel_id: "123",
                guild_id: "456",
            }),
            {
                channel_id: "123",
                guild_id: "456",
            },
        );
    });

    test("does not build guild-only webhook update event data without a guild id", () => {
        assert.equal(
            buildWebhooksUpdateEventData({
                channel_id: "123",
                guild_id: null,
            }),
            undefined,
        );
    });

    test("builds webhook update event data from a loaded channel relation", () => {
        assert.deepEqual(
            buildWebhooksUpdateEventData({
                channel_id: "123",
                guild_id: null,
                channel: {
                    guild_id: "456",
                },
            }),
            {
                channel_id: "123",
                guild_id: "456",
            },
        );
    });

    test("builds webhook update events on the changed channel", () => {
        assert.deepEqual(
            buildWebhooksUpdateEvent({
                channel_id: "123",
                guild_id: "456",
            }),
            {
                event: "WEBHOOKS_UPDATE",
                channel_id: "123",
                data: {
                    channel_id: "123",
                    guild_id: "456",
                },
            },
        );
    });

    test("skips webhook update events when no guild id exists", () => {
        assert.equal(
            buildWebhooksUpdateEvent({
                channel_id: "123",
                guild_id: undefined,
            }),
            undefined,
        );
    });
});
