import { describe, test } from "node:test";
import assert from "node:assert/strict";

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

    test("processes component media for newly created messages", async (t) => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost/spacebar_test";

        const spacebarUtil = requireModule("@spacebar/util") as typeof import("@spacebar/util");
        const spacebarSchemas = requireModule("@spacebar/schemas") as typeof import("@spacebar/schemas");
        const permissionsModule = requireModule("../../../util/util/Permissions") as typeof import("../../../util/util/Permissions");
        const rightsModule = requireModule("../../../util/util/Rights") as typeof import("../../../util/util/Rights");

        const channel = {
            id: "channel-id",
            guild_id: "guild-id",
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
        const media: import("@spacebar/schemas").UnfurledMediaItem = { url: "attachment://upload-channel/CLOUD_compUploads/0/uploaded-file" };
        const secondMedia: import("@spacebar/schemas").UnfurledMediaItem = { url: "attachment://upload-channel/CLOUD_compUploads/1/second-file" };

        t.mock.method(spacebarUtil.Config, "get", () => ({
            cdn: {
                endpointPrivate: "https://cdn.internal",
                endpointPublic: "https://cdn.example",
            },
            components: {},
            limits: {
                message: {
                    maxCharacters: 2000,
                },
            },
            security: {
                requestSignature: "secret",
            },
        }));
        t.mock.method(spacebarUtil.Channel, "findOneOrFail", async () => channel);
        t.mock.method(spacebarUtil.Message, "create", (input: Record<string, unknown>) => ({
            ...input,
            id: input.id,
            flags: (input.flags as number | undefined) ?? 0,
            attachments: (input.attachments as unknown[] | undefined) ?? [],
            embeds: (input.embeds as unknown[] | undefined) ?? [],
            mentions: (input.mentions as unknown[] | undefined) ?? [],
            mention_roles: [],
            save: async () => undefined,
        }));
        t.mock.method(spacebarUtil.User, "findOneOrFail", async () => ({
            id: "author-id",
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
        const cloudAttachments = new Map([
            [
                "upload-channel/CLOUD_compUploads/0/uploaded-file",
                {
                    id: "cloud-attachment-id",
                    channelId: "upload-channel",
                    userId: "author-id",
                    uploadFilename: "upload-channel/CLOUD_compUploads/0/uploaded-file",
                    userFilename: "image.png",
                    size: 123,
                    height: 64,
                    width: 32,
                    contentType: "image/png",
                    userOriginalContentType: "image/png",
                },
            ],
            [
                "upload-channel/CLOUD_compUploads/1/second-file",
                {
                    id: "second-cloud-attachment-id",
                    channelId: "upload-channel",
                    userId: "author-id",
                    uploadFilename: "upload-channel/CLOUD_compUploads/1/second-file",
                    userFilename: "second.png",
                    size: 456,
                    height: 128,
                    width: 96,
                    contentType: "image/png",
                    userOriginalContentType: "image/png",
                },
            ],
        ]);
        const findCloudAttachmentMock = t.mock.method(
            spacebarUtil.CloudAttachment,
            "findOne",
            async (options: { where: { uploadFilename: string } }) => cloudAttachments.get(options.where.uploadFilename) ?? null,
        );
        const attachmentIds = ["message-attachment-id", "second-message-attachment-id"];
        let attachmentIndex = 0;
        let attachmentSaveCount = 0;
        t.mock.method(spacebarUtil.Attachment, "create", (input: Record<string, unknown>) => ({
            ...input,
            id: attachmentIds[attachmentIndex++],
            save: async () => {
                attachmentSaveCount++;
            },
        }));
        const componentMediaIds = ["component-media-id", "second-component-media-id"];
        let componentMediaIndex = 0;
        t.mock.method(spacebarUtil.Snowflake, "generate", () => componentMediaIds[componentMediaIndex++]);
        const clonePaths = ["attachments/channel/message/image.png", "attachments/channel/message/second.png"];
        let cloneIndex = 0;
        const fetchMock = t.mock.method(
            globalThis,
            "fetch",
            async () =>
                new Response(JSON.stringify({ success: true, new_path: clonePaths[cloneIndex++] }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                }),
        );
        t.mock.method(permissionsModule, "getPermission", async () => permission);
        t.mock.method(rightsModule, "getRights", async () => rights);

        const { handleMessage } = (await import("./Message.js")) as typeof import("./Message");

        const message = await handleMessage({
            id: "message-id",
            channel_id: "channel-id",
            author_id: "author-id",
            flags: Number(spacebarUtil.MessageFlags.FLAGS.IS_COMPONENTS_V2),
            cloud_attachment_upload_channel_id: "upload-channel",
            attachment_channel_ids: ["upload-channel"],
            attachment_user_id: "author-id",
            components: [
                {
                    type: spacebarSchemas.MessageComponentType.MediaGallery,
                    items: [{ media }, { media: secondMedia }],
                },
            ],
        });

        assert.equal(media.id, "component-media-id");
        assert.equal(media.attachment_id, "message-attachment-id");
        assert.notEqual(media.id, media.attachment_id);
        assert.equal(media.url, "https://cdn.example/attachments/channel/message/image.png");
        assert.equal(media.proxy_url, "https://cdn.example/attachments/channel/message/image.png");
        assert.equal(secondMedia.id, "second-component-media-id");
        assert.equal(secondMedia.attachment_id, "second-message-attachment-id");
        assert.notEqual(secondMedia.id, secondMedia.attachment_id);
        assert.equal(secondMedia.url, "https://cdn.example/attachments/channel/message/second.png");
        assert.equal(secondMedia.proxy_url, "https://cdn.example/attachments/channel/message/second.png");
        assert.deepEqual(
            message.attachments?.map((attachment) => attachment.id),
            attachmentIds,
        );
        assert.equal(attachmentSaveCount, 0);
        assert.deepEqual(
            findCloudAttachmentMock.mock.calls.map((call) => call.arguments[0]),
            [
                {
                    where: {
                        uploadFilename: "upload-channel/CLOUD_compUploads/0/uploaded-file",
                        channelId: "upload-channel",
                    },
                },
                {
                    where: {
                        uploadFilename: "upload-channel/CLOUD_compUploads/1/second-file",
                        channelId: "upload-channel",
                    },
                },
            ],
        );
        assert.equal(fetchMock.mock.calls.length, 2);
        assert.ok(fetchMock.mock.calls.every((call) => String(call.arguments[0]).startsWith("https://cdn.internal/")));
    });

    test("rejects component media cloud attachments owned by another user", async (t) => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost/spacebar_test";

        const spacebarUtil = requireModule("@spacebar/util") as typeof import("@spacebar/util");
        const spacebarSchemas = requireModule("@spacebar/schemas") as typeof import("@spacebar/schemas");
        const permissionsModule = requireModule("../../../util/util/Permissions") as typeof import("../../../util/util/Permissions");
        const rightsModule = requireModule("../../../util/util/Rights") as typeof import("../../../util/util/Rights");

        const channel = {
            id: "channel-id",
            guild_id: "guild-id",
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
        const media: import("@spacebar/schemas").UnfurledMediaItem = { url: "attachment://upload-channel/CLOUD_compUploads/0/uploaded-file" };

        t.mock.method(spacebarUtil.Config, "get", () => ({
            cdn: {
                endpointPrivate: "https://cdn.internal",
                endpointPublic: "https://cdn.example",
            },
            components: {},
            limits: {
                message: {
                    maxCharacters: 2000,
                },
            },
            security: {
                requestSignature: "secret",
            },
        }));
        t.mock.method(spacebarUtil.Channel, "findOneOrFail", async () => channel);
        t.mock.method(spacebarUtil.Message, "create", (input: Record<string, unknown>) => ({
            ...input,
            id: input.id,
            flags: (input.flags as number | undefined) ?? 0,
            attachments: (input.attachments as unknown[] | undefined) ?? [],
            embeds: (input.embeds as unknown[] | undefined) ?? [],
            mentions: (input.mentions as unknown[] | undefined) ?? [],
            mention_roles: [],
            save: async () => undefined,
        }));
        t.mock.method(spacebarUtil.User, "findOneOrFail", async () => ({
            id: "author-id",
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
        t.mock.method(spacebarUtil.CloudAttachment, "findOne", async () => ({
            id: "cloud-attachment-id",
            channelId: "upload-channel",
            userId: "other-user-id",
            uploadFilename: "upload-channel/CLOUD_compUploads/0/uploaded-file",
            userFilename: "image.png",
            size: 123,
            height: 64,
            width: 32,
            contentType: "image/png",
            userOriginalContentType: "image/png",
        }));
        const attachmentCreateMock = t.mock.method(spacebarUtil.Attachment, "create", (input: Record<string, unknown>) => ({
            ...input,
            id: "message-attachment-id",
            save: async () => undefined,
        }));
        const fetchMock = t.mock.method(
            globalThis,
            "fetch",
            async () =>
                new Response(JSON.stringify({ success: true, new_path: "attachments/channel/message/image.png" }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                }),
        );
        t.mock.method(permissionsModule, "getPermission", async () => permission);
        t.mock.method(rightsModule, "getRights", async () => rights);

        const { handleMessage } = (await import("./Message.js")) as typeof import("./Message");

        await assert.rejects(
            handleMessage({
                id: "message-id",
                channel_id: "channel-id",
                author_id: "author-id",
                flags: Number(spacebarUtil.MessageFlags.FLAGS.IS_COMPONENTS_V2),
                cloud_attachment_upload_channel_id: "upload-channel",
                attachment_channel_ids: ["upload-channel"],
                attachment_user_id: "author-id",
                components: [
                    {
                        type: spacebarSchemas.MessageComponentType.MediaGallery,
                        items: [{ media }],
                    },
                ],
            }),
            /You do not own this attachment/,
        );

        assert.equal(fetchMock.mock.calls.length, 0);
        assert.equal(attachmentCreateMock.mock.calls.length, 0);
    });
});
