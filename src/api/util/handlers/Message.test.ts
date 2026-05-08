import { describe, test, type TestContext } from "node:test";
import assert from "node:assert/strict";

const requireModule = require;

type PermissionName = "BYPASS_SLOWMODE" | "MANAGE_CHANNELS" | "MANAGE_MESSAGES" | "SEND_MESSAGES";

async function withHandleMessageMocks(t: TestContext, permissions: PermissionName[] = []) {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost/spacebar_test";

    const spacebarUtil = requireModule("@spacebar/util") as typeof import("@spacebar/util");
    const permissionsModule = requireModule("../../../util/util/Permissions") as typeof import("../../../util/util/Permissions");
    const rightsModule = requireModule("../../../util/util/Rights") as typeof import("../../../util/util/Rights");

    const channel = {
        id: "channel_id",
        guild_id: "guild_id",
        type: 0,
        rate_limit_per_user: 10,
        recipients: [],
        save: async () => undefined,
    };
    const permissionSet = new Set<string>(permissions);
    const permission = {
        cache: {},
        has: (permissionName: PermissionName) => permissionSet.has(permissionName),
        hasThrow: (permissionName: PermissionName) => {
            if (!permissionSet.has(permissionName)) throw new Error(`missing ${permissionName}`);
            return true;
        },
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
    t.mock.method(spacebarUtil.Message, "findOne", async () => ({ timestamp: new Date() }));
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
    t.mock.method(spacebarUtil.Role, "findOneOrFail", async () => ({ mentionable: false }));
    t.mock.method(spacebarUtil.Member, "find", async () => []);
    t.mock.method(spacebarUtil.Session, "find", async () => []);
    t.mock.method(spacebarUtil.Sticker, "find", async () => []);
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
    return { createMessageMock, handleMessage, spacebarUtil };
}

function makeMessageOptions(overrides: Record<string, unknown> = {}) {
    return {
        id: "message_id",
        channel_id: "channel_id",
        author_id: "author_id",
        content: "message content",
        ...overrides,
    };
}

describe("handleMessage", () => {
    test("preserves supplied reactions when reconstructing an edited message", async (t) => {
        const { createMessageMock, handleMessage } = await withHandleMessageMocks(t, ["SEND_MESSAGES", "BYPASS_SLOWMODE"]);
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

    test("rejects a slowmode-limited author without BYPASS_SLOWMODE", async (t) => {
        const { handleMessage, spacebarUtil } = await withHandleMessageMocks(t, ["SEND_MESSAGES", "MANAGE_MESSAGES", "MANAGE_CHANNELS"]);

        await assert.rejects(
            () => handleMessage(makeMessageOptions()),
            (error) => error === spacebarUtil.DiscordApiErrors.SLOWMODE_RATE_LIMIT,
        );
    });

    test("allows a slowmode-limited author with BYPASS_SLOWMODE", async (t) => {
        const { handleMessage } = await withHandleMessageMocks(t, ["SEND_MESSAGES", "BYPASS_SLOWMODE"]);

        const message = await handleMessage(makeMessageOptions());

        assert.equal(message.id, "message_id");
    });
});
