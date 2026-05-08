import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ajv } from "../Validator";

describe("WebhookTokenUpdateSchema", () => {
    const validate = ajv.getSchema("WebhookTokenUpdateSchema");

    test("is registered for route request validation", () => {
        assert.ok(validate);
    });

    test("accepts token-auth webhook metadata updates", () => {
        assert.equal(validate?.({ name: "Renamed webhook", avatar: "data:image/png;base64,AAAA" }), true);
    });

    test("rejects channel moves on token-auth webhook updates", () => {
        assert.equal(validate?.({ name: "Renamed webhook", channel_id: "attacker_channel_id" }), false);
    });
});
