import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { compileWebhookNameRegexPatterns, findBlockedWebhookNamePattern } from "./WebhookNamePatterns";

describe("webhook name regex patterns", () => {
    test("returns the matching blocked webhook name pattern", () => {
        assert.equal(findBlockedWebhookNamePattern("official alerts", ["^official\\b"]), "^official\\b");
        assert.equal(findBlockedWebhookNamePattern("build bot", ["^official\\b"]), undefined);
    });

    test("rejects webhook names matching configured regex patterns", () => {
        assert.equal(findBlockedWebhookNamePattern("Official Alerts", ["^official\\b"]), "^official\\b");
    });

    test("allows webhook names that do not match configured regex patterns", () => {
        assert.equal(findBlockedWebhookNamePattern("Build Alerts", ["^official\\b"]), undefined);
    });

    test("rejects invalid webhook name regex configuration", () => {
        assert.throws(() => compileWebhookNameRegexPatterns(["["]), /Invalid webhook name blacklist regex/);
    });

    test("caches compiled webhook name regex patterns by pattern list", () => {
        assert.strictEqual(compileWebhookNameRegexPatterns(["^official$"]), compileWebhookNameRegexPatterns(["^official$"]));
    });
});
