import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { isValidWebhookToken } from "./WebhookToken";

describe("Webhook token validation", () => {
    test("accepts the exact webhook token", () => {
        assert.equal(isValidWebhookToken("valid_token", "valid_token"), true);
    });

    test("rejects missing stored tokens", () => {
        assert.equal(isValidWebhookToken(undefined, "valid_token"), false);
        assert.equal(isValidWebhookToken(null, "valid_token"), false);
        assert.equal(isValidWebhookToken("", "valid_token"), false);
    });

    test("rejects non-string request tokens", () => {
        assert.equal(isValidWebhookToken("valid_token", undefined), false);
        assert.equal(isValidWebhookToken("valid_token", 123456), false);
    });

    test("rejects different-length tokens without throwing", () => {
        assert.equal(isValidWebhookToken("valid_token", "valid"), false);
    });

    test("rejects same-length wrong tokens", () => {
        assert.equal(isValidWebhookToken("valid_token", "invalidtokn"), false);
    });
});
