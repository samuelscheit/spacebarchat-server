import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ReadStateFlags } from "../../schemas/uncategorised/MessageAcknowledgeSchema";
import { advanceNotificationCursor, applyChannelMessageReadStateUpdate, applyMessageAcknowledgeToReadState } from "./ReadStateAck";

describe("message ACK read-state updates", () => {
    test("applies channel message read-state updates with an initialized notification cursor", () => {
        const readState = {
            last_message_id: "old-message",
            mention_count: 4,
        };

        applyChannelMessageReadStateUpdate(readState, "100");

        assert.deepEqual(readState, {
            last_message_id: "100",
            mention_count: 0,
            notifications_cursor: "100",
        });
    });

    test("advances notification cursor only to newer message ids", () => {
        const readState = {
            notifications_cursor: "100",
        };

        advanceNotificationCursor(readState, "101");
        assert.equal(readState.notifications_cursor, "101");

        advanceNotificationCursor(readState, "99");
        assert.equal(readState.notifications_cursor, "101");
    });

    test("treats nullish notification cursors as uninitialized", () => {
        const nullCursor = { notifications_cursor: null as string | null };
        const missingCursor = {};

        advanceNotificationCursor(nullCursor, "100");
        advanceNotificationCursor(missingCursor, "100");

        assert.equal(nullCursor.notifications_cursor, "100");
        assert.deepEqual(missingCursor, { notifications_cursor: "100" });
    });

    test("persists modern ACK cursor fields used by READY read_state", () => {
        const readState = {
            last_message_id: "old-message",
            mention_count: 4,
            notifications_cursor: "100",
            last_viewed: 1,
            flags: 0,
        };

        applyMessageAcknowledgeToReadState(readState, "101", {
            last_viewed: 3576,
            flags: ReadStateFlags.IS_GUILD_CHANNEL,
        });

        assert.deepEqual(readState, {
            last_message_id: "101",
            mention_count: 0,
            notifications_cursor: "101",
            last_viewed: 3576,
            flags: ReadStateFlags.IS_GUILD_CHANNEL,
        });
    });

    test("preserves existing optional ACK cursor fields when the client omits them", () => {
        const readState = {
            last_viewed: 3576,
            flags: ReadStateFlags.IS_THREAD,
        };

        applyMessageAcknowledgeToReadState(readState, "100", {});

        assert.deepEqual(readState, {
            last_message_id: "100",
            mention_count: 0,
            notifications_cursor: "100",
            last_viewed: 3576,
            flags: ReadStateFlags.IS_THREAD,
        });
    });

    test("defaults sparse read states to modern READY-compatible cursor values", () => {
        const readState = {};

        applyMessageAcknowledgeToReadState(readState, "100", {});

        assert.deepEqual(readState, {
            last_message_id: "100",
            mention_count: 0,
            notifications_cursor: "100",
            last_viewed: 0,
            flags: 0,
        });
    });
});
