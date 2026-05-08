import { describe, test } from "node:test";
import assert from "node:assert/strict";

const requireModule = require;

describe("handleMessage", () => {
    test("resolves stickers from the message guild and global sticker scope", async (t) => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost/spacebar_test";

        const spacebarUtil = requireModule("@spacebar/util") as typeof import("@spacebar/util");
        const stickers = [
            { id: "global_sticker", guild_id: null },
            { id: "guild_sticker", guild_id: "guild_id" },
        ];

        const findMock = t.mock.method(spacebarUtil.Sticker, "find", async () => stickers);

        const { resolveMessageStickers } = (await import("./Message.js")) as typeof import("./Message");
        const resolved = await resolveMessageStickers(["global_sticker", "guild_sticker"], { guild_id: "guild_id" });

        assert.equal(resolved, stickers);
        const where = (findMock.mock.calls[0].arguments[0] as { where: unknown }).where as Array<Record<string, unknown>>;
        assert.equal(where.length, 2);
        assert.equal(where[1].guild_id, "guild_id");
    });

    test("rejects missing or out-of-guild stickers instead of silently dropping them", async (t) => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost/spacebar_test";

        const spacebarUtil = requireModule("@spacebar/util") as typeof import("@spacebar/util");
        t.mock.method(spacebarUtil.Sticker, "find", async () => [{ id: "available_sticker", guild_id: "guild_id" }]);

        const { resolveMessageStickers } = (await import("./Message.js")) as typeof import("./Message");

        await assert.rejects(() => resolveMessageStickers(["available_sticker", "missing_sticker"], { guild_id: "guild_id" }), {
            code: spacebarUtil.DiscordApiErrors.UNKNOWN_STICKER.code,
            message: spacebarUtil.DiscordApiErrors.UNKNOWN_STICKER.message,
        });
    });

    test("rejects payloads with too many or duplicate stickers", async () => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost/spacebar_test";

        const spacebarUtil = requireModule("@spacebar/util") as typeof import("@spacebar/util");
        const { resolveMessageStickers } = (await import("./Message.js")) as typeof import("./Message");

        await assert.rejects(() => resolveMessageStickers(["one", "two", "three", "four"], { guild_id: "guild_id" }), {
            code: spacebarUtil.DiscordApiErrors.INVALID_STICKER_SENT.code,
            message: spacebarUtil.DiscordApiErrors.INVALID_STICKER_SENT.message,
        });

        await assert.rejects(() => resolveMessageStickers(["one", "one"], { guild_id: "guild_id" }), {
            code: spacebarUtil.DiscordApiErrors.INVALID_STICKER_SENT.code,
            message: spacebarUtil.DiscordApiErrors.INVALID_STICKER_SENT.message,
        });
    });

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
});
