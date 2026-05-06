import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { serializeMessageRoleMentions } from "./MessageRoleMentions";

describe("Message role mentions serializer", () => {
    test("returns role ids instead of role objects", () => {
        assert.deepEqual(serializeMessageRoleMentions([{ id: "role-a" }, { id: "role-b" }]), ["role-a", "role-b"]);
    });

    test("preserves role ids that are already serialized", () => {
        assert.deepEqual(serializeMessageRoleMentions(["role-a", "role-b"]), ["role-a", "role-b"]);
    });

    test("returns an empty array when role mentions are not loaded", () => {
        assert.deepEqual(serializeMessageRoleMentions(undefined), []);
        assert.deepEqual(serializeMessageRoleMentions(null), []);
    });

    test("signed attachment responses keep the public message projection", async () => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar";
        const { Message } = await import("../entities/Message.js");
        const publicUser = {
            id: "user-id",
            username: "tester",
            discriminator: "0000",
            public_flags: 0,
            avatar: null,
        };
        const rawUser = {
            ...publicUser,
            rights: "1",
            toPublicUser: () => publicUser,
        };
        const message = Object.assign(new Message(), {
            id: "message-id",
            channel_id: "channel-id",
            author_id: "author-id",
            timestamp: new Date("2026-01-01T00:00:00.000Z"),
            edited_timestamp: undefined,
            author: rawUser,
            mentions: [rawUser],
            mention_roles: [{ id: "role-id", name: "role name" }],
            mention_channels: [],
            attachments: [],
            embeds: [],
            reactions: [],
            sticker_items: [],
            components: [],
            type: 0,
            flags: 0,
            content: "hello <@&role-id>",
            pinned_at: null,
        });

        const signedMessage = message.withSignedAttachments({
            ip: "127.0.0.1",
            userAgent: "node:test",
        }) as Record<string, unknown>;

        assert.equal(signedMessage.author_id, undefined);
        assert.deepEqual(signedMessage.mention_roles, ["role-id"]);
        assert.deepEqual(signedMessage.mentions, [publicUser]);
    });

    test("signed attachment responses support gateway public message objects", async () => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar";
        const { Message } = await import("../entities/Message.js");
        const publicMessage = {
            id: "message-id",
            channel_id: "channel-id",
            timestamp: "2026-01-01T00:00:00.000Z",
            edited_timestamp: null,
            author: { id: "user-id", username: "tester", discriminator: "0000", public_flags: 0, avatar: null },
            mentions: [],
            mention_roles: ["role-id"],
            mention_channels: [],
            attachments: [],
            embeds: [],
            reactions: [],
            sticker_items: [],
            components: [],
            type: 0,
            flags: 0,
            content: "hello <@&role-id>",
            pinned: false,
            tts: false,
            mention_everyone: false,
        };

        const signedMessage = Message.prototype.withSignedAttachments.call(publicMessage, {
            ip: "127.0.0.1",
            userAgent: "node:test",
        }) as Record<string, unknown>;

        assert.deepEqual(signedMessage.mention_roles, ["role-id"]);
        assert.deepEqual(signedMessage.attachments, []);
        assert.deepEqual(signedMessage.components, []);
    });
});
