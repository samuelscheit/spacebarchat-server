import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { MessageType, type PublicMessage } from "../../schemas/api/messages/Message";
import { MessageComponentType } from "../../schemas/api/messages/Components";
import type { Message as MessageEntity } from "../entities/Message";
import type { NewUrlUserSignatureData } from "../Signing";
import { toMessageMentionUser, toMessageMentionUsers } from "./MessageMentions";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar";

const { Message } = require("../entities/Message") as typeof import("../entities/Message");

const rawMention = {
    id: "mentioned_user_id",
    username: "mentioned",
    discriminator: "0001",
    avatar: "avatar_hash",
    public_flags: 64,
    bio: "profile bio must not leak into message mentions",
    premium: true,
    premium_type: 2,
    created_at: new Date("2026-01-01T00:00:00.000Z"),
};

const serializedMention = {
    id: "mentioned_user_id",
    username: "mentioned",
    discriminator: "0001",
    avatar: "avatar_hash",
    public_flags: 64,
};

function makeMessage(mentions: object[] = [rawMention]): MessageEntity {
    return Object.assign(Object.create(Message.prototype), {
        id: "message_id",
        channel_id: "channel_id",
        timestamp: new Date("2026-01-01T00:00:00.000Z"),
        edited_timestamp: undefined,
        tts: false,
        mention_everyone: false,
        mentions,
        mention_roles: [{ id: "mentioned_role_id" }],
        mention_channels: [],
        attachments: [],
        embeds: [],
        reactions: undefined,
        type: MessageType.DEFAULT,
        flags: 0,
        author: {
            id: "author_id",
            username: "author",
            discriminator: "0001",
            avatar: null,
            public_flags: 0,
            toPublicUser() {
                return {
                    id: this.id,
                    username: this.username,
                    discriminator: this.discriminator,
                    avatar: this.avatar,
                    public_flags: this.public_flags,
                };
            },
        },
        components: [],
        content: "hello <@mentioned_user_id>",
        pinned_at: null,
        message_snapshots: [],
    }) as MessageEntity;
}

describe("Message mention serialization", () => {
    test("projects mentioned users to partial message users", () => {
        const mention = toMessageMentionUser(rawMention);

        assert.deepEqual(mention, serializedMention);
    });

    test("defaults missing avatars to null", () => {
        const mention = toMessageMentionUser({
            id: "mentioned_user_id",
            username: "mentioned",
            discriminator: "0001",
        });

        assert.equal(mention.avatar, null);
    });

    test("projects arrays of mentioned users and defaults missing arrays to empty", () => {
        assert.deepEqual(toMessageMentionUsers([rawMention]), [serializedMention]);
        assert.deepEqual(toMessageMentionUsers(undefined), []);
        assert.deepEqual(toMessageMentionUsers(null), []);
    });

    test("Message.toJSON and snapshots expose partial mention users and role ids", () => {
        const message = makeMessage();

        const json = message.toJSON();
        const snapshot = message.toSnapshot();

        assert.deepEqual(json.mentions, [serializedMention]);
        assert.deepEqual(json.mention_roles, ["mentioned_role_id"]);
        assert.deepEqual(snapshot.message.mentions, [serializedMention]);
        assert.deepEqual(snapshot.message.mention_roles, ["mentioned_role_id"]);
        assert.equal((json.mentions[0] as Record<string, unknown>).bio, undefined);
        assert.equal((snapshot.message.mentions[0] as Record<string, unknown>).bio, undefined);
    });

    test("search hits reuse public message mention serialization", () => {
        const hit = makeMessage().toSearchResult();

        assert.equal(hit.hit, true);
        assert.deepEqual(hit.mentions, [serializedMention]);
        assert.equal((hit.mentions[0] as Record<string, unknown>).bio, undefined);
    });

    test("signed public message responses preserve serialized mentions", () => {
        const message = makeMessage();
        const signed = Message.prototype.withSignedAttachments.call(message.toJSON(), {
            ip: "127.0.0.1",
            userAgent: "node:test",
        } satisfies NewUrlUserSignatureData);

        assert.deepEqual(signed.mentions, [serializedMention]);
        assert.notDeepEqual(signed.mentions, message.embeds);
    });

    test("signs schema-valid public attachment and component media URLs without rebuilding CDN paths", () => {
        const attachmentUrl = "https://cdn.example.test/attachments/channel_id/message_id/file.png";
        const mediaUrl = "https://cdn.example.test/attachments/channel_id/message_id/media.png";
        const publicMessage = {
            attachments: [
                {
                    filename: "file.png",
                    size: 1,
                    url: attachmentUrl,
                    proxy_url: attachmentUrl,
                },
            ],
            components: [
                {
                    type: MessageComponentType.MediaGallery,
                    items: [
                        {
                            media: {
                                url: mediaUrl,
                                proxy_url: mediaUrl,
                            },
                        },
                    ],
                },
            ],
        } as unknown as PublicMessage;

        const signed = Message.prototype.withSignedAttachments.call(publicMessage, {
            ip: "127.0.0.1",
            userAgent: "node:test",
        } satisfies NewUrlUserSignatureData);

        const signedAttachmentUrl = signed.attachments[0].url;
        const signedMediaUrl = (signed.components[0] as never as { items: { media: { url: string } }[] }).items[0].media.url;

        assert.match(signedAttachmentUrl, /^https:\/\/cdn\.example\.test\/attachments\/channel_id\/message_id\/file\.png\?/);
        assert.match(signedAttachmentUrl, /hm=/);
        assert.doesNotMatch(signedAttachmentUrl, /undefined/);

        assert.match(signedMediaUrl, /^https:\/\/cdn\.example\.test\/attachments\/channel_id\/message_id\/media\.png\?/);
        assert.match(signedMediaUrl, /hm=/);
        assert.doesNotMatch(signedMediaUrl, /undefined/);
    });

    test("generated schemas document message mentions as partial users", () => {
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8"));
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8"));

        assert.equal(schemas.Message.properties.mentions.items.$ref, "#/definitions/PartialUser");
        assert.equal(schemas.GuildMessagesSearchMessage.properties.mentions.items.$ref, "#/definitions/PartialUser");
        assert.equal(openapi.components.schemas.Message.properties.mentions.items.$ref, "#/components/schemas/PartialUser");
        assert.equal(openapi.components.schemas.GuildMessagesSearchMessage.properties.mentions.items.$ref, "#/components/schemas/PartialUser");
    });
});
