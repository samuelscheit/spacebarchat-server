import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Events, WSEvents } from "../../../util/util/Constants";
import { Intents } from "../../../util/util/Intents";
import { buildGuildEmojiPatchEvents, buildGuildEmojiUpdateEventData } from "./EmojiEvents";

describe("emoji event helpers", () => {
    test("builds singular guild emoji update data", () => {
        const emoji = {
            id: "1",
            guild_id: "2",
            name: "blob",
        };

        assert.deepEqual(buildGuildEmojiUpdateEventData(emoji), {
            guild_id: "2",
            emoji,
        });
    });

    test("builds singular then aggregate guild emoji patch events", () => {
        const emoji = {
            id: "1",
            guild_id: "2",
            name: "blob",
        };
        const emojis = [emoji];

        assert.deepEqual(buildGuildEmojiPatchEvents(emoji, emojis), [
            {
                event: "GUILD_EMOJI_UPDATE",
                guild_id: "2",
                data: {
                    guild_id: "2",
                    emoji,
                },
            },
            {
                event: "GUILD_EMOJIS_UPDATE",
                guild_id: "2",
                data: {
                    guild_id: "2",
                    emojis,
                },
            },
        ]);
    });

    test("exposes guild emoji updates through websocket constants and guild expression intents", () => {
        assert.equal(WSEvents.GUILD_EMOJI_UPDATE, "GUILD_EMOJI_UPDATE");
        assert.ok(Intents.GUILD_INTENT_TO_EVENTS_MAP[3].includes("GUILD_EMOJI_UPDATE"));
    });

    test("exposes reaction add-many through websocket constants and reaction intents", () => {
        assert.equal(Events.MESSAGE_REACTION_ADD_MANY, "messageReactionAddMany");
        assert.equal(WSEvents.MESSAGE_REACTION_ADD_MANY, "MESSAGE_REACTION_ADD_MANY");
        assert.ok(Intents.GUILD_INTENT_TO_EVENTS_MAP[10].includes("MESSAGE_REACTION_ADD_MANY"));
        assert.ok(Intents.DM_INTENT_TO_EVENTS_MAP[13].includes("MESSAGE_REACTION_ADD_MANY"));
    });

    test("requires a non-null guild id at compile time", () => {
        function assertGuildIdTypes() {
            // @ts-expect-error guild_id is required for guild-routed gateway events.
            buildGuildEmojiUpdateEventData({ id: "1" });

            // @ts-expect-error guild_id must not be null.
            buildGuildEmojiUpdateEventData({ id: "1", guild_id: null });
        }

        assert.equal(typeof assertGuildIdTypes, "function");
    });
});
