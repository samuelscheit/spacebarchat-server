import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { EVENTEnum, type EVENT, type MessageReactionAddManyEvent } from "./Event";

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
