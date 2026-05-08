import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ReadStateFlags } from "../../schemas/uncategorised/MessageAcknowledgeSchema";
import { advanceNotificationCursor, applyChannelMessageReadStateUpdate, applyMessageAcknowledgeToReadState } from "./ReadStateAck";

describe("message ACK read-state updates", () => {
    const OLDER_SNOWFLAKE = "1456516148545421312";
    const CURRENT_SNOWFLAKE = "1456516148545421313";
    const NEWER_SNOWFLAKE = "1456516148545421314";

    test("applies channel message read-state updates with an initialized notification cursor", () => {
        const readState = {
            last_message_id: OLDER_SNOWFLAKE,
            mention_count: 4,
        };

        applyChannelMessageReadStateUpdate(readState, CURRENT_SNOWFLAKE);

        assert.deepEqual(readState, {
            last_message_id: CURRENT_SNOWFLAKE,
            mention_count: 0,
            notifications_cursor: CURRENT_SNOWFLAKE,
        });
    });

    test("advances notification cursor only to newer snowflakes without losing precision", () => {
        const readState = {
            notifications_cursor: CURRENT_SNOWFLAKE,
        };

        advanceNotificationCursor(readState, NEWER_SNOWFLAKE);
        assert.equal(readState.notifications_cursor, NEWER_SNOWFLAKE);

        advanceNotificationCursor(readState, OLDER_SNOWFLAKE);
        assert.equal(readState.notifications_cursor, NEWER_SNOWFLAKE);
    });

    test("keeps notification cursor unchanged for equal or older channel message updates", () => {
        const readState = {
            last_message_id: CURRENT_SNOWFLAKE,
            mention_count: 3,
            notifications_cursor: CURRENT_SNOWFLAKE,
        };

        applyChannelMessageReadStateUpdate(readState, CURRENT_SNOWFLAKE);
        assert.equal(readState.notifications_cursor, CURRENT_SNOWFLAKE);

        applyChannelMessageReadStateUpdate(readState, OLDER_SNOWFLAKE);
        assert.deepEqual(readState, {
            last_message_id: OLDER_SNOWFLAKE,
            mention_count: 0,
            notifications_cursor: CURRENT_SNOWFLAKE,
        });
    });

    test("treats nullish notification cursors as uninitialized", () => {
        const nullCursor = { notifications_cursor: null as string | null };
        const missingCursor = {};

        advanceNotificationCursor(nullCursor, CURRENT_SNOWFLAKE);
        advanceNotificationCursor(missingCursor, CURRENT_SNOWFLAKE);

        assert.equal(nullCursor.notifications_cursor, CURRENT_SNOWFLAKE);
        assert.deepEqual(missingCursor, { notifications_cursor: CURRENT_SNOWFLAKE });
    });

    test("repairs null notification cursors from an existing newer channel read marker", () => {
        const readState = {
            last_message_id: CURRENT_SNOWFLAKE,
            mention_count: 2,
            notifications_cursor: null as string | null,
        };

        applyChannelMessageReadStateUpdate(readState, OLDER_SNOWFLAKE);

        assert.deepEqual(readState, {
            last_message_id: OLDER_SNOWFLAKE,
            mention_count: 0,
            notifications_cursor: CURRENT_SNOWFLAKE,
        });
    });

    test("persists modern ACK cursor fields used by READY read_state", () => {
        const readState = {
            last_message_id: OLDER_SNOWFLAKE,
            mention_count: 4,
            notifications_cursor: CURRENT_SNOWFLAKE,
            last_viewed: 1,
            flags: 0,
        };

        applyMessageAcknowledgeToReadState(readState, NEWER_SNOWFLAKE, {
            last_viewed: 3576,
            flags: ReadStateFlags.IS_GUILD_CHANNEL,
        });

        assert.deepEqual(readState, {
            last_message_id: NEWER_SNOWFLAKE,
            mention_count: 0,
            notifications_cursor: NEWER_SNOWFLAKE,
            last_viewed: 3576,
            flags: ReadStateFlags.IS_GUILD_CHANNEL,
        });
    });

    test("does not rewind notification cursor when acknowledging an older message as unread marker", () => {
        const readState = {
            last_message_id: CURRENT_SNOWFLAKE,
            mention_count: 2,
            notifications_cursor: CURRENT_SNOWFLAKE,
            last_viewed: 1,
            flags: 0,
        };

        applyMessageAcknowledgeToReadState(readState, OLDER_SNOWFLAKE, {});

        assert.deepEqual(readState, {
            last_message_id: OLDER_SNOWFLAKE,
            mention_count: 0,
            notifications_cursor: CURRENT_SNOWFLAKE,
            last_viewed: 1,
            flags: 0,
        });
    });

    test("does not initialize ACK notification cursor behind an existing read marker", () => {
        const readState = {
            last_message_id: CURRENT_SNOWFLAKE,
            mention_count: 2,
            notifications_cursor: null as string | null,
            last_viewed: 1,
            flags: 0,
        };

        applyMessageAcknowledgeToReadState(readState, OLDER_SNOWFLAKE, {});

        assert.deepEqual(readState, {
            last_message_id: OLDER_SNOWFLAKE,
            mention_count: 0,
            notifications_cursor: CURRENT_SNOWFLAKE,
            last_viewed: 1,
            flags: 0,
        });
    });

    test("preserves existing optional ACK cursor fields when the client omits them", () => {
        const readState = {
            last_viewed: 3576,
            flags: ReadStateFlags.IS_THREAD,
        };

        applyMessageAcknowledgeToReadState(readState, CURRENT_SNOWFLAKE, {});

        assert.deepEqual(readState, {
            last_message_id: CURRENT_SNOWFLAKE,
            mention_count: 0,
            notifications_cursor: CURRENT_SNOWFLAKE,
            last_viewed: 3576,
            flags: ReadStateFlags.IS_THREAD,
        });
    });

    test("defaults sparse read states to modern READY-compatible cursor values", () => {
        const readState = {};

        applyMessageAcknowledgeToReadState(readState, CURRENT_SNOWFLAKE, {});

        assert.deepEqual(readState, {
            last_message_id: CURRENT_SNOWFLAKE,
            mention_count: 0,
            notifications_cursor: CURRENT_SNOWFLAKE,
            last_viewed: 0,
            flags: 0,
        });
    });
});
