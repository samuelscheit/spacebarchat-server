import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildWebhooksUpdateEventData } from "./WebhookEvents";

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
});
