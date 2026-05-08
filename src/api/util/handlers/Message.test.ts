import { describe, test, type TestContext } from "node:test";
import assert from "node:assert/strict";

const requireModule = require;

function mockHandleMessageDependencies(t: TestContext) {
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

    return { createMessageMock, spacebarUtil };
}

describe("handleMessage", () => {
    test("preserves supplied reactions when reconstructing an edited message", async (t) => {
        const { createMessageMock } = mockHandleMessageDependencies(t);

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

    test("moves attachment URLs referenced by embeds into the embed body", async (t) => {
        const { spacebarUtil } = mockHandleMessageDependencies(t);
        const { handleMessage } = (await import("./Message.js")) as typeof import("./Message");

        function attachment(filename: string) {
            return Object.assign(new spacebarUtil.Attachment(), {
                filename,
                size: 1,
                channel_id: "channel_id",
                message_id: "message_id",
            });
        }

        const message = await handleMessage({
            id: "message_id",
            channel_id: "channel_id",
            author_id: "author_id",
            attachments: [attachment("image.png"), attachment("thumb.png"), attachment("video.mp4"), attachment("footer.png"), attachment("author.png"), attachment("kept.png")],
            embeds: [
                {
                    image: { url: "attachment://image.png" },
                    thumbnail: { url: "attachment://thumb.png" },
                    video: { url: "attachment://video.mp4" },
                    footer: { text: "footer", icon_url: "attachment://footer.png" },
                    author: { name: "author", icon_url: "attachment://author.png" },
                },
            ],
        });

        assert.equal(message.embeds[0].image?.url, "https://cdn.example/attachments/channel_id/message_id/image.png");
        assert.equal(message.embeds[0].image?.proxy_url, "https://cdn.example/attachments/channel_id/message_id/image.png");
        assert.equal(message.embeds[0].thumbnail?.url, "https://cdn.example/attachments/channel_id/message_id/thumb.png");
        assert.equal(message.embeds[0].thumbnail?.proxy_url, "https://cdn.example/attachments/channel_id/message_id/thumb.png");
        assert.equal(message.embeds[0].video?.url, "https://cdn.example/attachments/channel_id/message_id/video.mp4");
        assert.equal(message.embeds[0].video?.proxy_url, "https://cdn.example/attachments/channel_id/message_id/video.mp4");
        assert.equal(message.embeds[0].footer?.icon_url, "https://cdn.example/attachments/channel_id/message_id/footer.png");
        assert.equal(message.embeds[0].footer?.proxy_icon_url, "https://cdn.example/attachments/channel_id/message_id/footer.png");
        assert.equal(message.embeds[0].author?.icon_url, "https://cdn.example/attachments/channel_id/message_id/author.png");
        assert.equal(message.embeds[0].author?.proxy_icon_url, "https://cdn.example/attachments/channel_id/message_id/author.png");
        assert.deepEqual(
            message.attachments?.map((current) => current.filename),
            ["kept.png"],
        );
    });
});
