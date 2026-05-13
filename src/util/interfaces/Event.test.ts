import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
    EVENTEnum,
    READY_SESSION_TYPE,
    type ChannelPinsAckEvent,
    type ConversationSummaryUpdateEvent,
    type EVENT,
    type FriendSuggestionDeleteEvent,
    type MessageReactionAddManyEvent,
    type NotificationCenterItemsAckEvent,
    type ReadyEventData,
    type VoiceChannelStatusUpdateEvent,
} from "./Event";

describe("ReadyEventData", () => {
    test("uses Discord's normal READY session type", () => {
        const sessionType = READY_SESSION_TYPE satisfies ReadyEventData["session_type"];

        assert.equal(sessionType, "normal");
    });
});

describe("gateway reaction add-many event declarations", () => {
    test("uses the documented MESSAGE_REACTION_ADD_MANY name instead of the stale bulk-add TODO", () => {
        assert.equal(EVENTEnum.MessageReactionAddMany, "MESSAGE_REACTION_ADD_MANY");

        const eventName: EVENT = "MESSAGE_REACTION_ADD_MANY";
        assert.equal(eventName, "MESSAGE_REACTION_ADD_MANY");
    });

    test("types the debounced reaction payload", () => {
        const event: MessageReactionAddManyEvent = {
            event: "MESSAGE_REACTION_ADD_MANY",
            channel_id: "channel-id",
            data: {
                channel_id: "channel-id",
                message_id: "message-id",
                guild_id: "guild-id",
                reactions: [
                    {
                        users: ["user-a", "user-b"],
                        emoji: { id: undefined, name: "👍" },
                    },
                ],
            },
        };

        assert.deepEqual(event.data.reactions[0], {
            users: ["user-a", "user-b"],
            emoji: { id: undefined, name: "👍" },
        });
    });
});

describe("conversation summary gateway event declarations", () => {
    test("uses the documented conversation summary update event name", () => {
        assert.equal(EVENTEnum.ConversationSummaryUpdate, "CONVERSATION_SUMMARY_UPDATE");

        const eventName: EVENT = "CONVERSATION_SUMMARY_UPDATE";
        assert.equal(eventName, "CONVERSATION_SUMMARY_UPDATE");
    });

    test("types the conversation summary update payload", () => {
        const event: ConversationSummaryUpdateEvent = {
            event: "CONVERSATION_SUMMARY_UPDATE",
            guild_id: "guild-id",
            channel_id: "channel-id",
            data: {
                guild_id: "guild-id",
                channel_id: "channel-id",
                summaries: [],
            },
        };

        assert.deepEqual(event.data, {
            guild_id: "guild-id",
            channel_id: "channel-id",
            summaries: [],
        });
    });
});

describe("channel pins ack gateway event declarations", () => {
    test("uses the documented channel pins ack event name", () => {
        assert.equal(EVENTEnum.ChannelPinsAck, "CHANNEL_PINS_ACK");

        const eventName: EVENT = "CHANNEL_PINS_ACK";
        assert.equal(eventName, "CHANNEL_PINS_ACK");
    });

    test("types the user-scoped channel pins ack payload", () => {
        const event: ChannelPinsAckEvent = {
            event: "CHANNEL_PINS_ACK",
            user_id: "user-id",
            data: {
                channel_id: "channel-id",
                timestamp: "2026-05-08T12:34:56.000Z",
                version: 232,
            },
        };

        assert.deepEqual(event.data, {
            channel_id: "channel-id",
            timestamp: "2026-05-08T12:34:56.000Z",
            version: 232,
        });
    });
});

describe("friend suggestion delete gateway event declarations", () => {
    test("uses the documented friend suggestion delete event name", () => {
        assert.equal(EVENTEnum.FriendSuggestionDelete, "FRIEND_SUGGESTION_DELETE");

        const eventName: EVENT = "FRIEND_SUGGESTION_DELETE";
        assert.equal(eventName, "FRIEND_SUGGESTION_DELETE");
    });

    test("types the documented deleted suggestion payload", () => {
        const event: FriendSuggestionDeleteEvent = {
            event: "FRIEND_SUGGESTION_DELETE",
            user_id: "current-user",
            data: {
                suggested_user_id: "852892297661906993",
            },
        };

        assert.deepEqual(event.data, {
            suggested_user_id: "852892297661906993",
        });
    });
});

describe("notification center item ack gateway event declarations", () => {
    test("uses the documented notification center items ack event name", () => {
        assert.equal(EVENTEnum.NotificationCenterItemsAck, "NOTIFICATION_CENTER_ITEMS_ACK");

        const eventName: EVENT = "NOTIFICATION_CENTER_ITEMS_ACK";
        assert.equal(eventName, "NOTIFICATION_CENTER_ITEMS_ACK");
    });

    test("types the acknowledged item payload", () => {
        const event: NotificationCenterItemsAckEvent = {
            event: "NOTIFICATION_CENTER_ITEMS_ACK",
            user_id: "current-user",
            data: {
                id: "1456516148545421313",
            },
        };

        assert.deepEqual(event.data, {
            id: "1456516148545421313",
        });
    });
});

describe("voice channel status gateway event declarations", () => {
    test("uses the documented voice channel status update event name", () => {
        assert.equal(EVENTEnum.VoiceChannelStatusUpdate, "VOICE_CHANNEL_STATUS_UPDATE");

        const eventName: EVENT = "VOICE_CHANNEL_STATUS_UPDATE";
        assert.equal(eventName, "VOICE_CHANNEL_STATUS_UPDATE");
    });

    test("types the documented voice channel status update payload", () => {
        const event: VoiceChannelStatusUpdateEvent = {
            event: "VOICE_CHANNEL_STATUS_UPDATE",
            channel_id: "channel-id",
            data: {
                id: "channel-id",
                guild_id: "guild-id",
                status: null,
            },
        };

        assert.deepEqual(event.data, {
            id: "channel-id",
            guild_id: "guild-id",
            status: null,
        });
    });
});
