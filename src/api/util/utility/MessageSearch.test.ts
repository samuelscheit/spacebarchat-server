import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { messageToSearchResult } from "./MessageSearch";

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
            },
        ]);
        assert.equal("email" in result.mentions[0], false);
        assert.equal("toPublicUser" in result.mentions[0], false);
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
