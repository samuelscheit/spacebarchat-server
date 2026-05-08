import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ReadStateFlags } from "../../schemas/uncategorised/MessageAcknowledgeSchema";
import {
    advanceOnlyNotificationCursorSql,
    applyMessageAcknowledgeToReadState,
    getAdvanceOnlyNotificationCursorCondition,
    shouldAdvanceNotificationCursor,
    type AcknowledgeableReadState,
} from "./ReadStateAck";

describe("message ACK read-state updates", () => {
    test("persists modern ACK cursor fields used by READY read_state", () => {
        const readState = {
            last_message_id: "1000",
            mention_count: 4,
            last_viewed: 1,
            flags: 0,
        };

        applyMessageAcknowledgeToReadState(readState, "2000", {
            last_viewed: 3576,
            flags: ReadStateFlags.IS_GUILD_CHANNEL,
        });

        assert.deepEqual(readState, {
            last_message_id: "2000",
            mention_count: 0,
            last_viewed: 3576,
            flags: ReadStateFlags.IS_GUILD_CHANNEL,
        });
    });

    test("preserves existing optional ACK cursor fields when the client omits them", () => {
        const readState = {
            last_viewed: 3576,
            flags: ReadStateFlags.IS_THREAD,
        };

        applyMessageAcknowledgeToReadState(readState, "2000", {});

        assert.deepEqual(readState, {
            last_message_id: "2000",
            mention_count: 0,
            last_viewed: 3576,
            flags: ReadStateFlags.IS_THREAD,
        });
    });

    test("defaults sparse read states to modern READY-compatible cursor values", () => {
        const readState: AcknowledgeableReadState = {};

        applyMessageAcknowledgeToReadState(readState, "2000", {});

        assert.deepEqual(readState, {
            last_message_id: "2000",
            mention_count: 0,
            last_viewed: 0,
            flags: 0,
        });
    });

    test("detects notification cursor initialization and advancement", () => {
        assert.equal(shouldAdvanceNotificationCursor(undefined, "1000"), true);
        assert.equal(shouldAdvanceNotificationCursor(null, "1000"), true);
        assert.equal(shouldAdvanceNotificationCursor("999", "1000"), true);
    });

    test("detects equal or older notification cursors as non-advancing", () => {
        assert.equal(shouldAdvanceNotificationCursor("1000", "1000"), false);
        assert.equal(shouldAdvanceNotificationCursor("1001", "1000"), false);
    });

    test("builds an atomic advance-only notification cursor update condition", () => {
        const condition = getAdvanceOnlyNotificationCursorCondition("read-state-id", "1000");

        assert.equal(condition.id, "read-state-id");
        assert.equal(typeof condition.notifications_cursor, "object");
        assert.equal(advanceOnlyNotificationCursorSql, "notifications_cursor IS NULL OR notifications_cursor::bigint < :messageId");
    });
});
