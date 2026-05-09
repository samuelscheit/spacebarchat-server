import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { HTTPError } from "lambert-server";
import { ChannelType, isTextChannel } from "../../src/schemas/api/channels/Channel";

const MESSAGE_CAPABLE_CHANNEL_TYPES = new Set<ChannelType>([
    ChannelType.DM,
    ChannelType.GROUP_DM,
    ChannelType.GUILD_NEWS,
    ChannelType.GUILD_VOICE,
    ChannelType.GUILD_NEWS_THREAD,
    ChannelType.GUILD_PUBLIC_THREAD,
    ChannelType.GUILD_PRIVATE_THREAD,
    ChannelType.GUILD_TEXT,
]);

const NON_TEXT_CHANNEL_TYPES = new Set<ChannelType>([
    ChannelType.GUILD_STORE,
    ChannelType.GUILD_STAGE_VOICE,
    ChannelType.GUILD_CATEGORY,
    ChannelType.GUILD_FORUM,
    ChannelType.GUILD_DIRECTORY,
    ChannelType.GUILD_LFG,
    ChannelType.LFG_GROUP_DM,
    ChannelType.THREAD_ALPHA,
    ChannelType.GUILD_MEDIA,
    ChannelType.LOBBY,
    ChannelType.EPHEMERAL_DM,
    ChannelType.UNHANDLED,
]);

function enumValues(enumObject: Record<string, string | number>) {
    return Object.values(enumObject).filter((value): value is number => typeof value === "number");
}

describe("isTextChannel", () => {
    test("classifies every declared channel type", () => {
        const classifiedTypes = new Set([...MESSAGE_CAPABLE_CHANNEL_TYPES, ...NON_TEXT_CHANNEL_TYPES]);

        assert.deepEqual(new Set(enumValues(ChannelType)), classifiedTypes);
    });

    test("accepts channel types supported by text-channel API routes", () => {
        for (const channelType of MESSAGE_CAPABLE_CHANNEL_TYPES) {
            assert.equal(isTextChannel(channelType), true, `${ChannelType[channelType]} should be text-capable`);
        }
    });

    test("rejects known non-text channel types with a channel type error", () => {
        for (const channelType of NON_TEXT_CHANNEL_TYPES) {
            assert.throws(
                () => isTextChannel(channelType),
                (error: unknown) => error instanceof HTTPError && error.message === "not a text channel",
                `${ChannelType[channelType]} should not be text-capable`,
            );
        }
    });
});
