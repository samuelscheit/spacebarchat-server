import { describe, test, type TestContext } from "node:test";
import assert from "node:assert/strict";

const requireModule = require;

describe("handleMessage", () => {
    async function loadHandleMessageWithBaseMocks(t: TestContext) {
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
            cdn: {
                endpointPublic: "https://cdn.example",
            },
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

        return { handleMessage, createMessageMock };
    }

    test("preserves supplied reactions when reconstructing an edited message", async (t) => {
        const { handleMessage, createMessageMock } = await loadHandleMessageWithBaseMocks(t);
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

    test("rewrites attachment-backed embed media and removes consumed attachments", async (t) => {
        const { handleMessage } = await loadHandleMessageWithBaseMocks(t);
        const spacebarUtil = requireModule("@spacebar/util") as typeof import("@spacebar/util");
        const makeAttachment = (filename: string) => {
            const attachment = new spacebarUtil.Attachment();
            Object.assign(attachment, {
                filename,
                size: 1,
                channel_id: "channel_id",
                message_id: "message_id",
            });
            return attachment;
        };

        const message = await handleMessage({
            id: "message_id",
            channel_id: "channel_id",
            author_id: "author_id",
            embeds: [
                {
                    footer: { text: "footer", icon_url: "attachment://footer.png" },
                    image: { url: "attachment://image.gif" },
                    thumbnail: { url: "attachment://thumb.jpg" },
                    video: { url: "attachment://video.mp4" },
                    author: { name: "author", icon_url: "attachment://author.png" },
                },
            ],
            attachments: [
                makeAttachment("footer.png"),
                makeAttachment("image.gif"),
                makeAttachment("thumb.jpg"),
                makeAttachment("video.mp4"),
                makeAttachment("author.png"),
                makeAttachment("kept.txt"),
            ],
        });

        const embed = message.embeds[0];
        assert.equal(embed.footer?.icon_url, "https://cdn.example/attachments/channel_id/message_id/footer.png");
        assert.equal(embed.footer?.proxy_icon_url, "https://cdn.example/attachments/channel_id/message_id/footer.png");
        assert.equal(embed.image?.url, "https://cdn.example/attachments/channel_id/message_id/image.gif");
        assert.equal(embed.image?.proxy_url, "https://cdn.example/attachments/channel_id/message_id/image.gif");
        assert.equal(embed.thumbnail?.url, "https://cdn.example/attachments/channel_id/message_id/thumb.jpg");
        assert.equal(embed.thumbnail?.proxy_url, "https://cdn.example/attachments/channel_id/message_id/thumb.jpg");
        assert.equal(embed.video?.url, "https://cdn.example/attachments/channel_id/message_id/video.mp4");
        assert.equal(embed.video?.proxy_url, "https://cdn.example/attachments/channel_id/message_id/video.mp4");
        assert.equal(embed.author?.icon_url, "https://cdn.example/attachments/channel_id/message_id/author.png");
        assert.equal(embed.author?.proxy_icon_url, "https://cdn.example/attachments/channel_id/message_id/author.png");
        assert.deepEqual(
            message.attachments?.map((attachment: { filename: string }) => attachment.filename),
            ["kept.txt"],
        );
    });
});
