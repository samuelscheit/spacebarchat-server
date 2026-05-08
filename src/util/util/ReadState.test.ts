import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, test } from "node:test";
import { ReadStateType } from "../../schemas/uncategorised/MessageAcknowledgeSchema";
import { applyAckBulkReadStateUpdate, getReadyReadStateWhere, getReadStateIdentity, READY_READ_STATE_SELECT } from "./ReadState";

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

    test("writes channel bulk acknowledgements to channel read-state fields", () => {
        const channelState = applyAckBulkReadStateUpdate(
            {
                last_message_id: "old-message-id",
                last_acked_id: "old-acked-id",
                mention_count: 4,
                badge_count: 7,
                read_state_type: ReadStateType.CHANNEL,
            },
            { channel_id: "channel-id", message_id: "new-message-id" },
        );
        assert.equal(channelState.last_message_id, "new-message-id");
        assert.equal(channelState.last_acked_id, "old-acked-id");
        assert.equal(channelState.mention_count, 0);
        assert.equal(channelState.badge_count, 7);
        assert.equal(channelState.read_state_type, ReadStateType.CHANNEL);
    });

    test("writes non-channel bulk acknowledgements to non-channel read-state fields", () => {
        const eventState = applyAckBulkReadStateUpdate(
            {
                last_message_id: "old-message-id",
                last_acked_id: "old-event-id",
                mention_count: 4,
                badge_count: 7,
                read_state_type: ReadStateType.GUILD_EVENT,
            },
            {
                channel_id: "guild-id",
                message_id: "new-event-id",
                read_state_type: ReadStateType.GUILD_EVENT,
            },
        );
        assert.equal(eventState.last_acked_id, "new-event-id");
        assert.equal(eventState.last_message_id, null);
        assert.equal(eventState.mention_count, 4);
        assert.equal(eventState.badge_count, 0);
        assert.equal(eventState.read_state_type, ReadStateType.GUILD_EVENT);
    });

    test("filters READY read states by capability", () => {
        assert.deepEqual(getReadyReadStateWhere("user-id", false), {
            user_id: "user-id",
            read_state_type: ReadStateType.CHANNEL,
        });
        assert.deepEqual(getReadyReadStateWhere("user-id", true), {
            user_id: "user-id",
        });
    });

    test("selects every field required by READY read-state serialization", () => {
        assert.equal(READY_READ_STATE_SELECT.id, true);
        assert.equal(READY_READ_STATE_SELECT.channel_id, true);
        assert.equal(READY_READ_STATE_SELECT.last_message_id, true);
        assert.equal(READY_READ_STATE_SELECT.last_acked_id, true);
        assert.equal(READY_READ_STATE_SELECT.last_pin_timestamp, true);
        assert.equal(READY_READ_STATE_SELECT.mention_count, true);
        assert.equal(READY_READ_STATE_SELECT.badge_count, true);
        assert.equal(READY_READ_STATE_SELECT.last_viewed, true);
        assert.equal(READY_READ_STATE_SELECT.read_state_type, true);
        assert.equal(READY_READ_STATE_SELECT.flags, true);
    });

    test("declares explicit database types for nullable cursor columns", () => {
        const source = readFileSync(resolve(process.cwd(), "src/util/entities/ReadState.ts"), "utf8");

        assert.match(source, /@Column\(\{\s*type: "varchar",\s*nullable: true\s*\}\)\s+last_message_id\?: string \| null;/);
        assert.match(source, /@Column\(\{\s*type: "varchar",\s*nullable: true\s*\}\)\s+last_acked_id\?: string \| null;/);
    });

    test("keeps read-state persistence in the dedicated ReadState entity instead of Member", () => {
        const memberSource = readFileSync(resolve(process.cwd(), "src/util/entities/Member.ts"), "utf8");
        const readStateSource = readFileSync(resolve(process.cwd(), "src/util/entities/ReadState.ts"), "utf8");

        assert.doesNotMatch(memberSource, /read_state\s*:/);
        assert.doesNotMatch(memberSource, /read_state:\s*\{\}/);
        assert.doesNotMatch(memberSource, /proper read receipts/);
        assert.match(readStateSource, /@Entity\(\{\s*name: "read_states",\s*\}\)/);
        assert.match(readStateSource, /@Index\("IDX_read_states_user_resource_type", \["channel_id", "user_id", "read_state_type"\], \{ unique: true \}\)/);
    });
});
