import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ReadStateType } from "../../../schemas/uncategorised/MessageAcknowledgeSchema";
import { applyAckBulkReadStateUpdate, getReadStateIdentity } from "./ReadState";

describe("read state helpers", () => {
    test("defaults bulk acknowledgements to channel read states", () => {
        assert.deepEqual(
            getReadStateIdentity("user-id", {
                channel_id: "channel-id",
                message_id: "message-id",
            }),
            {
                user_id: "user-id",
                channel_id: "channel-id",
                read_state_type: ReadStateType.CHANNEL,
            },
        );
    });

    test("keeps non-channel read state types in the persistence identity", () => {
        assert.deepEqual(
            getReadStateIdentity("user-id", {
                channel_id: "guild-id",
                message_id: "event-id",
                read_state_type: ReadStateType.GUILD_EVENT,
            }),
            {
                user_id: "user-id",
                channel_id: "guild-id",
                read_state_type: ReadStateType.GUILD_EVENT,
            },
        );
    });

    test("only clears channel mention counts when applying bulk acknowledgements", () => {
        const channelState = applyAckBulkReadStateUpdate(
            { last_message_id: "old-message-id", mention_count: 4, read_state_type: ReadStateType.CHANNEL },
            { channel_id: "channel-id", message_id: "new-message-id" },
        );
        assert.equal(channelState.last_message_id, "new-message-id");
        assert.equal(channelState.mention_count, 0);

        const eventState = applyAckBulkReadStateUpdate(
            { last_message_id: "old-event-id", mention_count: 4, read_state_type: ReadStateType.GUILD_EVENT },
            {
                channel_id: "guild-id",
                message_id: "new-event-id",
                read_state_type: ReadStateType.GUILD_EVENT,
            },
        );
        assert.equal(eventState.last_message_id, "new-event-id");
        assert.equal(eventState.mention_count, 4);
        assert.equal(eventState.read_state_type, ReadStateType.GUILD_EVENT);
    });
});
