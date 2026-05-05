import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { shouldIncrementMentionCount } from "./MessageNotifications";

describe("message notification side effects", () => {
    test("increments mention counts for new messages by default", () => {
        assert.equal(shouldIncrementMentionCount({}), true);
    });

    test("does not increment mention counts when notifications are suppressed", () => {
        assert.equal(shouldIncrementMentionCount({ suppress_notifications: true }), false);
    });
});
