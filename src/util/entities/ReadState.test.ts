import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ReadStateFlags, ReadStateType } from "../../schemas/uncategorised/MessageAcknowledgeSchema";
import { BaseClass } from "./BaseClass";
import { ReadState } from "./ReadState";

function withBaseReadStateJson<T>(json: Partial<ReadState>, run: () => T) {
    const originalToJSON = BaseClass.prototype.toJSON;

    BaseClass.prototype.toJSON = function toJSON() {
        return { ...json };
    };

    try {
        return run();
    } finally {
        BaseClass.prototype.toJSON = originalToJSON;
    }
}

describe("ReadState.toJSON", () => {
    test("keeps last_viewed for non-channel read states while removing channel-only fields", () => {
        const lastPinTimestamp = new Date("2026-05-06T11:00:00.000Z");
        const readState = new ReadState();
        readState.read_state_type = ReadStateType.GUILD_HOME;

        const json = withBaseReadStateJson(
            {
                id: "database-row-id",
                channel_id: "guild-home-1",
                read_state_type: ReadStateType.GUILD_HOME,
                badge_count: 4,
                last_acked_id: "guild-home-item-1",
                last_viewed: 3576,
                mention_count: 8,
                last_message_id: "message-1",
                last_pin_timestamp: lastPinTimestamp,
                flags: ReadStateFlags.IS_GUILD_CHANNEL,
            },
            () => readState.toJSON(),
        );

        assert.deepEqual(json, {
            id: "database-row-id",
            channel_id: "guild-home-1",
            read_state_type: ReadStateType.GUILD_HOME,
            badge_count: 4,
            last_acked_id: "guild-home-item-1",
            last_viewed: 3576,
        });
    });

    test("keeps channel read-state fields while removing non-channel-only fields", () => {
        const lastPinTimestamp = new Date("2026-05-06T10:00:00.000Z");
        const readState = new ReadState();
        readState.read_state_type = ReadStateType.CHANNEL;

        const json = withBaseReadStateJson(
            {
                id: "database-row-id",
                channel_id: "channel-1",
                read_state_type: ReadStateType.CHANNEL,
                mention_count: 2,
                last_message_id: "message-1",
                last_pin_timestamp: lastPinTimestamp,
                last_viewed: 3576,
                flags: ReadStateFlags.IS_THREAD,
                badge_count: 4,
                last_acked_id: "guild-home-item-1",
            },
            () => readState.toJSON(),
        );

        assert.deepEqual(json, {
            id: "database-row-id",
            channel_id: "channel-1",
            read_state_type: ReadStateType.CHANNEL,
            mention_count: 2,
            last_message_id: "message-1",
            last_pin_timestamp: lastPinTimestamp,
            last_viewed: 3576,
            flags: ReadStateFlags.IS_THREAD,
        });
    });
});
