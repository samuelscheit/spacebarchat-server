import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { BaseMessageComponents, MessageComponentType } from "@spacebar/schemas";

const requireModule = require;

describe("handleMessage", () => {
    test("preserves supplied reactions when reconstructing an edited message", async (t) => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost/spacebar_test";

        const spacebarUtil = requireModule("@spacebar/util") as typeof import("@spacebar/util");
        const permissionsModule = requireModule("../../../util/util/Permissions") as typeof import("../../../util/util/Permissions");
        const rightsModule = requireModule("../../../util/util/Rights") as typeof import("../../../util/util/Rights");

        const channel = {
            id: "channel_id",
            guild_id: "guild_id",
            type: 0,
            rate_limit_per_user: 0,
            recipients: [],
            save: async () => undefined,
        };
        const permission = {
            cache: {},
            has: () => false,
            hasThrow: () => undefined,
        };
        const rights = {
            hasThrow: () => undefined,
        };

        t.mock.method(spacebarUtil.Config, "get", () => ({
            limits: {
                message: {
                    maxCharacters: 2000,
                },
            },
        }));
        t.mock.method(spacebarUtil.Channel, "findOneOrFail", async () => channel);
        const createMessageMock = t.mock.method(spacebarUtil.Message, "create", (input: Record<string, unknown>) => ({
            ...input,
            flags: (input.flags as number | undefined) ?? 0,
            attachments: (input.attachments as unknown[] | undefined) ?? [],
            embeds: (input.embeds as unknown[] | undefined) ?? [],
            mentions: (input.mentions as unknown[] | undefined) ?? [],
            mention_roles: [],
            save: async () => undefined,
        }));
        t.mock.method(spacebarUtil.User, "findOneOrFail", async () => ({
            id: "author_id",
            clean_data: () => undefined,
        }));
        t.mock.method(spacebarUtil.User, "findOne", async () => null);
        t.mock.method(spacebarUtil.Role, "findOne", async () => null);
        t.mock.method(spacebarUtil.Member, "find", async () => []);
        t.mock.method(spacebarUtil.Session, "find", async () => []);
        t.mock.method(spacebarUtil.ReadState, "findBy", async () => []);
        t.mock.method(spacebarUtil.ReadState, "create", (value: Record<string, unknown>) => ({
            ...value,
            save: async () => value,
        }));
        t.mock.method(spacebarUtil.ReadState, "getRepository", () => ({
            update: async () => undefined,
            increment: async () => undefined,
        }));
        t.mock.method(permissionsModule, "getPermission", async () => permission);
        t.mock.method(rightsModule, "getRights", async () => rights);

        const { handleMessage } = (await import("./Message.js")) as typeof import("./Message");
        const reactions = [{ count: 1, emoji: { name: "thumb" }, user_ids: ["user_id"] }];

        const message = await handleMessage({
            id: "message_id",
            channel_id: "channel_id",
            author_id: "author_id",
            content: "edited content",
            reactions,
        });

        assert.equal(message.reactions, reactions);
        assert.equal((createMessageMock.mock.calls[0].arguments[0] as Record<string, unknown>).reactions, reactions);
    });

    test("processes component cloud attachment media when constructing a message", async (t) => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost/spacebar_test";

        const spacebarUtil = requireModule("@spacebar/util") as typeof import("@spacebar/util");
        const permissionsModule = requireModule("../../../util/util/Permissions") as typeof import("../../../util/util/Permissions");
        const rightsModule = requireModule("../../../util/util/Rights") as typeof import("../../../util/util/Rights");

        const channel = {
            id: "message_channel_id",
            guild_id: "guild_id",
            type: 0,
            rate_limit_per_user: 0,
            recipients: [],
            save: async () => undefined,
        };
        const author = {
            id: "author_id",
            clean_data: () => undefined,
        };
        const permission = {
            cache: {},
            has: () => false,
            hasThrow: () => undefined,
        };
        const rights = {
            hasThrow: () => undefined,
        };
        const savedAttachments: unknown[] = [];
        const fetchCalls: string[] = [];

        t.mock.method(spacebarUtil.Config, "get", () => ({
            components: {
                actionRowLimit: 5,
                mediaGalleryLimit: 10,
            },
            cdn: {
                endpointPrivate: "https://cdn.internal",
                endpointPublic: "https://cdn.public",
            },
            limits: {
                message: {
                    maxCharacters: 2000,
                },
            },
            security: {
                requestSignature: "signature",
            },
        }));
        t.mock.method(spacebarUtil.Channel, "findOneOrFail", async () => channel);
        t.mock.method(spacebarUtil.Message, "create", (input: Record<string, unknown>) => ({
            ...input,
            flags: (input.flags as number | undefined) ?? 0,
            attachments: (input.attachments as unknown[] | undefined) ?? [],
            embeds: (input.embeds as unknown[] | undefined) ?? [],
            mentions: (input.mentions as unknown[] | undefined) ?? [],
            mention_roles: [],
            save: async () => undefined,
        }));
        t.mock.method(spacebarUtil.User, "findOneOrFail", async () => author);
        t.mock.method(spacebarUtil.User, "findOne", async () => null);
        t.mock.method(spacebarUtil.Role, "findOne", async () => null);
        t.mock.method(spacebarUtil.Member, "find", async () => []);
        t.mock.method(spacebarUtil.Session, "find", async () => []);
        t.mock.method(spacebarUtil.ReadState, "findBy", async () => []);
        t.mock.method(spacebarUtil.ReadState, "create", (value: Record<string, unknown>) => ({
            ...value,
            save: async () => value,
        }));
        t.mock.method(spacebarUtil.ReadState, "getRepository", () => ({
            update: async () => undefined,
            increment: async () => undefined,
        }));
        t.mock.method(spacebarUtil.CloudAttachment, "findOne", async (options: unknown) => {
            assert.deepEqual(options, {
                where: {
                    uploadFilename: "upload_channel_id/CLOUD_batch/0/image.png",
                    channelId: "upload_channel_id",
                },
            });
            return {
                id: "cloud_attachment_id",
                uploadFilename: "upload_channel_id/CLOUD_batch/0/image.png",
                userFilename: "image.png",
                userId: "author_id",
                channelId: "upload_channel_id",
                size: 123,
                height: 40,
                width: 50,
                contentType: "image/png",
            };
        });
        t.mock.method(spacebarUtil.Attachment, "create", (value: Record<string, unknown>) => ({
            ...value,
            id: "component_attachment_id",
            save: async () => {
                savedAttachments.push(value);
            },
        }));
        t.mock.method(permissionsModule, "getPermission", async () => permission);
        t.mock.method(rightsModule, "getRights", async () => rights);
        t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
            fetchCalls.push(input.toString());
            return {
                ok: true,
                json: async () => ({ success: true, new_path: "attachments/message_channel_id/message_id/image.png" }),
                text: async () => "",
            } as Response;
        });

        const { handleMessage } = (await import("./Message.js")) as typeof import("./Message");
        const media = { url: "attachment://upload_channel_id/CLOUD_batch/0/image.png" };
        const components: BaseMessageComponents[] = [
            {
                type: MessageComponentType.MediaGallery,
                items: [{ media }],
            },
        ];

        await handleMessage({
            id: "message_id",
            channel_id: "message_channel_id",
            author_id: "author_id",
            components,
            flags: 1 << 15,
            cloud_attachment_upload_channel_id: "upload_channel_id",
            attachment_channel_ids: ["upload_channel_id", "message_channel_id"],
            attachment_user_id: "author_id",
        });

        assert.deepEqual(fetchCalls, [
            "https://cdn.internal/_spacebar/cdn/attachments/upload_channel_id/CLOUD_batch/0/image.png/clone_to_message/message_id?destination_channel_id=message_channel_id",
        ]);
        assert.deepEqual(savedAttachments, [
            {
                filename: "image.png",
                size: 123,
                height: 40,
                width: 50,
                content_type: "image/png",
                channel_id: "message_channel_id",
                message_id: "message_id",
            },
        ]);
        assert.deepEqual(media, {
            url: "https://cdn.public/attachments/message_channel_id/message_id/image.png",
            proxy_url: "https://cdn.public/attachments/message_channel_id/message_id/image.png",
            id: "component_attachment_id",
            height: 40,
            width: 50,
            content_type: "image/png",
            attachment_id: "cloud_attachment_id",
        });
    });
});
