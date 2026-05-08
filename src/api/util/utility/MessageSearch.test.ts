import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { getSearchChannelNsfwFilter, messageToSearchResult, parseIncludeNsfwSearchParam } from "./MessageSearch";

describe("messageToSearchResult", () => {
    test("serializes mentions through the public message serializer", async () => {
        const result = messageToSearchResult(
            await createMessage([
                {
                    id: "40",
                    username: "raw",
                    email: "private@example.com",
                    toPublicUser: () => ({
                        id: "40",
                        username: "mentioned",
                    }),
                },
            ]),
        );

        assert.deepEqual(result.mentions, [
            {
                id: "40",
                username: "mentioned",
                avatar: null,
            },
        ]);
        assert.equal("email" in result.mentions[0], false);
        assert.equal("toPublicUser" in result.mentions[0], false);
    });

    test("serializes webhook messages without a loaded author relation", async () => {
        const message = await createMessage();
        Object.assign(message, {
            author: undefined,
            author_id: undefined,
            webhook_id: "901",
            username: "Webhook Override",
            avatar: "webhook-avatar",
            webhook: {
                id: "901",
                name: "Webhook Default",
                avatar: "default-avatar",
            },
        });

        assert.deepEqual(messageToSearchResult(message).author, {
            id: "901",
            username: "Webhook Override",
            discriminator: "0000",
            avatar: "webhook-avatar",
            bot: true,
            public_flags: 0,
        });
    });
});

describe("search include_nsfw query handling", () => {
    test("only the literal true value includes NSFW channels", () => {
        assert.equal(parseIncludeNsfwSearchParam("true"), true);
        assert.equal(parseIncludeNsfwSearchParam(undefined), false);
        assert.equal(parseIncludeNsfwSearchParam("false"), false);
        assert.equal(parseIncludeNsfwSearchParam("1"), false);
        assert.equal(parseIncludeNsfwSearchParam("True"), false);
        assert.equal(parseIncludeNsfwSearchParam(["true"]), false);
        assert.equal(parseIncludeNsfwSearchParam(["false", "true"]), false);
    });

    test("excludes NSFW channels unless include_nsfw=true is requested", () => {
        assert.deepEqual(getSearchChannelNsfwFilter(undefined), { channel: { nsfw: false } });
        assert.deepEqual(getSearchChannelNsfwFilter("false"), { channel: { nsfw: false } });
        assert.deepEqual(getSearchChannelNsfwFilter(["true"]), { channel: { nsfw: false } });
        assert.deepEqual(getSearchChannelNsfwFilter("true"), {});
    });
});

async function createMessage(mentions?: unknown[]) {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar";
    const { Message } = await import("../../../util/entities/Message.js");
    const message = new Message();
    Object.assign(message, {
        id: "10",
        channel_id: "20",
        author: {
            avatar: null,
            username: "author",
            toPublicUser: () => ({
                id: "30",
                username: "author",
                discriminator: "0001",
                public_flags: 0,
                avatar: null,
            }),
        },
        content: "hello",
        timestamp: new Date("2026-01-01T00:00:00.000Z"),
        edited_timestamp: null,
        tts: false,
        mention_everyone: false,
        mention_roles: [],
        mention_channels: [],
        attachments: [],
        embeds: [],
        pinned_at: null,
        type: 0,
        flags: 0,
        components: [],
    });

    if (mentions !== undefined) message.mentions = mentions as never;

    return message;
}
