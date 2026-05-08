import { describe, test, type MockTracker } from "node:test";
import assert from "node:assert/strict";

const requireModule = require;

async function setupHandleMessage(
    t: { mock: MockTracker },
    overrides: {
        permissionHas?: (permission: string) => boolean;
        referencedMessage?: Record<string, unknown> | null;
        rolesById?: Record<string, Record<string, unknown>>;
        usersById?: Record<string, Record<string, unknown>>;
    } = {},
) {
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
        has: overrides.permissionHas ?? (() => false),
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
    t.mock.method(spacebarUtil.Guild, "findOneOrFail", async () => ({ id: "guild_id" }));
    const createMessageMock = t.mock.method(spacebarUtil.Message, "create", (input: Record<string, unknown>) => ({
        ...input,
        flags: (input.flags as number | undefined) ?? 0,
        attachments: (input.attachments as unknown[] | undefined) ?? [],
        embeds: (input.embeds as unknown[] | undefined) ?? [],
        mentions: (input.mentions as unknown[] | undefined) ?? [],
        mention_roles: [],
        save: async () => undefined,
    }));
    t.mock.method(spacebarUtil.Message, "findOne", async () => overrides.referencedMessage ?? null);
    t.mock.method(spacebarUtil.Message, "findOneOrFail", async () => overrides.referencedMessage ?? { id: "referenced_message_id" });
    t.mock.method(spacebarUtil.User, "findOneOrFail", async () => ({
        id: "author_id",
        clean_data: () => undefined,
    }));
    t.mock.method(spacebarUtil.User, "findOne", async ({ where }: { where: { id: string } }) => overrides.usersById?.[where.id] ?? null);
    t.mock.method(spacebarUtil.Role, "findOneOrFail", async ({ where }: { where: { id: string } }) => {
        const role = overrides.rolesById?.[where.id];
        if (!role) throw new Error("Role not found");
        return role;
    });
    t.mock.method(spacebarUtil.Role, "findOne", async ({ where }: { where: { id: string } }) => overrides.rolesById?.[where.id] ?? null);
    t.mock.method(spacebarUtil.Member, "find", async () => []);
    t.mock.method(spacebarUtil.Session, "find", async () => []);
    t.mock.method(spacebarUtil.ReadState, "findBy", async () => []);
    t.mock.method(spacebarUtil.ReadState, "create", (value: Record<string, unknown>) => ({
        ...value,
        save: async () => value,
    }));
    const readStateRepository = {
        update: t.mock.fn(async () => undefined),
        increment: t.mock.fn(async () => undefined),
    };
    t.mock.method(spacebarUtil.ReadState, "getRepository", () => readStateRepository);
    t.mock.method(permissionsModule, "getPermission", async () => permission);
    t.mock.method(rightsModule, "getRights", async () => rights);

    const { handleMessage } = (await import("./Message.js")) as typeof import("./Message");
    return { handleMessage, createMessageMock, readStateRepository };
}

describe("handleMessage", () => {
    test("preserves supplied reactions when reconstructing an edited message", async (t) => {
        const { handleMessage, createMessageMock } = await setupHandleMessage(t);
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

    test("stores only explicitly allowed user mentions when parse users is omitted", async (t) => {
        const allowedUser = { id: "100", username: "allowed" };
        const disallowedUser = { id: "200", username: "disallowed" };
        const { handleMessage } = await setupHandleMessage(t, {
            usersById: {
                "100": allowedUser,
                "200": disallowedUser,
            },
        });

        const message = await handleMessage({
            id: "message_id",
            channel_id: "channel_id",
            author_id: "author_id",
            content: "hello <@100> <@200>",
            allowed_mentions: { users: ["100"] },
        });

        assert.deepEqual(message.mentions, [allowedUser]);
    });

    test("stores all content user mentions when allowed mentions parses users", async (t) => {
        const firstUser = { id: "100", username: "first" };
        const secondUser = { id: "200", username: "second" };
        const { handleMessage } = await setupHandleMessage(t, {
            usersById: {
                "100": firstUser,
                "200": secondUser,
            },
        });

        const message = await handleMessage({
            id: "message_id",
            channel_id: "channel_id",
            author_id: "author_id",
            content: "hello <@100> <@200>",
            allowed_mentions: { parse: ["users"], users: ["100"] },
        });

        assert.deepEqual(message.mentions, [firstUser, secondUser]);
    });

    test("stores only explicitly allowed role mentions when parse roles is omitted", async (t) => {
        const allowedRole = { id: "300", guild_id: "guild_id", mentionable: true };
        const disallowedRole = { id: "400", guild_id: "guild_id", mentionable: true };
        const { handleMessage } = await setupHandleMessage(t, {
            rolesById: {
                "300": allowedRole,
                "400": disallowedRole,
            },
        });

        const message = await handleMessage({
            id: "message_id",
            channel_id: "channel_id",
            author_id: "author_id",
            content: "hello <@&300> <@&400>",
            allowed_mentions: { roles: ["300"] },
        });

        assert.deepEqual(message.mention_roles, [allowedRole]);
    });

    test("does not set mention_everyone when everyone parsing is disabled", async (t) => {
        const { handleMessage, readStateRepository } = await setupHandleMessage(t, {
            permissionHas: (permission) => permission === "MENTION_EVERYONE",
        });

        const message = await handleMessage({
            id: "message_id",
            channel_id: "channel_id",
            author_id: "author_id",
            content: "hello @everyone @here",
            allowed_mentions: { parse: [] },
        });

        assert.equal(message.mention_everyone, false);
        assert.equal(readStateRepository.increment.mock.callCount(), 0);
    });

    test("sets mention_everyone when everyone parsing is enabled", async (t) => {
        const { handleMessage } = await setupHandleMessage(t, {
            permissionHas: (permission) => permission === "MENTION_EVERYONE",
        });

        const message = await handleMessage({
            id: "message_id",
            channel_id: "channel_id",
            author_id: "author_id",
            content: "hello @everyone",
            allowed_mentions: { parse: ["everyone"] },
        });

        assert.equal(message.mention_everyone, true);
    });

    test("does not mention replied user when reply mentions are disabled", async (t) => {
        const referencedAuthor = {
            id: "referenced_author_id",
            toPublicUser() {
                return { id: this.id };
            },
        };
        const { handleMessage } = await setupHandleMessage(t, {
            referencedMessage: {
                id: "referenced_message_id",
                author_id: "referenced_author_id",
                channel_id: "channel_id",
                guild_id: "guild_id",
            },
            usersById: {
                referenced_author_id: referencedAuthor,
            },
        });

        const message = await handleMessage({
            id: "message_id",
            channel_id: "channel_id",
            author_id: "author_id",
            content: "reply",
            allowed_mentions: { replied_user: false },
            message_reference: {
                message_id: "referenced_message_id",
                channel_id: "channel_id",
                guild_id: "guild_id",
            },
        });

        assert.deepEqual(message.mentions, []);
    });

    test("mentions replied user when reply mentions are enabled", async (t) => {
        const referencedAuthor = {
            id: "referenced_author_id",
            toPublicUser() {
                return { id: this.id };
            },
        };
        const { handleMessage } = await setupHandleMessage(t, {
            referencedMessage: {
                id: "referenced_message_id",
                author_id: "referenced_author_id",
                channel_id: "channel_id",
                guild_id: "guild_id",
            },
            usersById: {
                referenced_author_id: referencedAuthor,
            },
        });

        const message = await handleMessage({
            id: "message_id",
            channel_id: "channel_id",
            author_id: "author_id",
            content: "reply",
            allowed_mentions: { replied_user: true },
            message_reference: {
                message_id: "referenced_message_id",
                channel_id: "channel_id",
                guild_id: "guild_id",
            },
        });

        assert.deepEqual(message.mentions, [{ id: "referenced_author_id" }]);
    });
});
