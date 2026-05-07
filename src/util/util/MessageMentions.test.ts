import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { serializeMessageMentions } from "./MessageMentions";

describe("Message mentions serializer", () => {
    test("returns an empty array when message mentions are not loaded", () => {
        assert.deepEqual(serializeMessageMentions(undefined), []);
        assert.deepEqual(serializeMessageMentions(null), []);
    });

    test("serializes mentioned users to public users", () => {
        const mentions = serializeMessageMentions([
            {
                toPublicUser: () => ({
                    id: "123",
                    username: "mentioned",
                }),
            },
        ]);

        assert.deepEqual(mentions, [
            {
                id: "123",
                username: "mentioned",
            },
        ]);
    });

    test("signed message responses keep unloaded mentions as an empty array", async () => {
        const message = await createMessage();

        assert.deepEqual(message.withSignedAttachments({}).mentions, []);
    });

    test("signed message responses serialize loaded mentions to public users", async () => {
        const message = await createMessage([
            {
                id: "123",
                email: "private@example.com",
                toPublicUser: () => ({
                    id: "123",
                    username: "mentioned",
                }),
            },
        ]);

        assert.deepEqual(message.withSignedAttachments({}).mentions, [
            {
                id: "123",
                username: "mentioned",
            },
        ]);
    });

    test("signed message responses accept already serialized public messages", async () => {
        const message = await createMessage();
        const publicMessage = message.toJSON();

        assert.deepEqual(message.withSignedAttachments.call(publicMessage, {}).mentions, []);
    });
});

async function createMessage(mentions?: unknown[]) {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar";
    const { Message } = await import("../entities/Message.js");
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
