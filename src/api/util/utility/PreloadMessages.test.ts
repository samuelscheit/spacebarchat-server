import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { preloadAuthorizedMessages, serializePreloadedMessage } from "./PreloadMessages";

type FakeMessage = {
    id: string;
    channel_id: string;
    toJSON(): {
        id: string;
        channel_id: string;
        reactions?: string[];
    };
};

function fakeMessage(id: string, channelId: string): FakeMessage {
    return {
        id,
        channel_id: channelId,
        toJSON() {
            return {
                id,
                channel_id: channelId,
                reactions: ["leaked-reaction"],
            };
        },
    };
}

describe("PreloadMessages", () => {
    test("serializePreloadedMessage removes reactions from the response shape", () => {
        const serialized = serializePreloadedMessage(fakeMessage("message", "channel"));

        assert.deepEqual(serialized, {
            id: "message",
            channel_id: "channel",
            reactions: undefined,
        });
    });

    test("preloadAuthorizedMessages does not query latest messages for unauthorized channels", async () => {
        const queriedChannelIds: string[] = [];

        const messages = await preloadAuthorizedMessages(["visible", "private", "empty"], {
            getAuthorizedChannelIds: async (channelIds) => {
                assert.deepEqual(channelIds, ["visible", "private", "empty"]);
                return new Set(["visible", "empty"]);
            },
            findLatestMessage: async (channelId) => {
                queriedChannelIds.push(channelId);
                return channelId === "empty" ? null : fakeMessage("latest-visible", channelId);
            },
        });

        assert.deepEqual(queriedChannelIds, ["visible", "empty"]);
        assert.deepEqual(messages, [
            {
                id: "latest-visible",
                channel_id: "visible",
                reactions: undefined,
            },
        ]);
    });
});
