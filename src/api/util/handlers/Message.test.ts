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
    test("allowed_mentions controls mention-count notification targets", async (t) => {
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
            has: (name: string) => name === "MENTION_EVERYONE" || name === "MANAGE_ROLES",
            hasThrow: () => undefined,
        };
        const rights = {
            hasThrow: () => undefined,
        };
        const incrementCalls: unknown[][] = [];
        const findByCalls: unknown[][] = [];
        const memberFindCalls: unknown[][] = [];
        const users = new Map([
            ["111", { id: "111" }],
            ["222", { id: "222" }],
            ["333", { id: "333" }],
        ]);

        t.mock.method(spacebarUtil.Config, "get", () => ({
            limits: {
                message: {
                    maxCharacters: 2000,
                },
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
        t.mock.method(spacebarUtil.User, "findOneOrFail", async () => ({
            id: "author_id",
            clean_data: () => undefined,
        }));
        t.mock.method(spacebarUtil.User, "findOne", async ({ where }: { where: { id: string } }) => users.get(where.id) ?? null);
        t.mock.method(spacebarUtil.Role, "findOneOrFail", async ({ where }: { where: { id: string } }) => ({ id: where.id, guild_id: "guild_id", mentionable: true }));
        t.mock.method(spacebarUtil.Role, "findOne", async ({ where }: { where: { id: string } }) => ({ id: where.id, guild_id: "guild_id", mentionable: true }));
        t.mock.method(spacebarUtil.Member, "find", async (...args: unknown[]) => {
            memberFindCalls.push(args);
            return [{ id: "role_member_id" }];
        });
        t.mock.method(spacebarUtil.Session, "find", async () => []);
        t.mock.method(spacebarUtil.ReadState, "findBy", async (...args: unknown[]) => {
            findByCalls.push(args);
            return [];
        });
        t.mock.method(spacebarUtil.ReadState, "create", (value: Record<string, unknown>) => ({
            ...value,
            save: async () => value,
        }));
        t.mock.method(spacebarUtil.ReadState, "getRepository", () => ({
            update: async () => undefined,
            increment: async (...args: unknown[]) => {
                incrementCalls.push(args);
            },
        }));
        t.mock.method(permissionsModule, "getPermission", async () => permission);
        t.mock.method(rightsModule, "getRights", async () => rights);

        const { handleMessage } = (await import("./Message.js")) as typeof import("./Message");

        await handleMessage({
            id: "message_id",
            channel_id: "channel_id",
            author_id: "author_id",
            content: "hello <@111> <@222> <@&444>",
            allowed_mentions: { parse: [], users: ["222"], roles: [] },
        });

        assert.equal(incrementCalls.length, 1);
        assert.equal(findByCalls.length, 1);
        assert.equal(memberFindCalls.length, 0);
        assert.match(JSON.stringify(incrementCalls[0][0]), /222/);
        assert.doesNotMatch(JSON.stringify(incrementCalls[0][0]), /111|role_member_id/);
    });

    test("allowed_mentions suppresses user, role, everyone, and reply notifications when parse is empty", async (t) => {
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
            has: (name: string) => name === "MENTION_EVERYONE" || name === "MANAGE_ROLES",
            hasThrow: () => undefined,
        };
        const rights = {
            hasThrow: () => undefined,
        };
        const incrementCalls: unknown[][] = [];
        const users = new Map([
            ["111", { id: "111" }],
            ["reply_author", { id: "reply_author", toPublicUser: () => ({ id: "reply_author" }) }],
        ]);

        t.mock.method(spacebarUtil.Config, "get", () => ({ limits: { message: { maxCharacters: 2000 } } }));
        t.mock.method(spacebarUtil.Channel, "findOneOrFail", async () => channel);
        t.mock.method(spacebarUtil.Message, "create", (input: Record<string, unknown>) => ({
            ...input,
            flags: (input.flags as number | undefined) ?? 0,
            attachments: [],
            embeds: [],
            mentions: [],
            mention_roles: [],
            save: async () => undefined,
        }));
        t.mock.method(spacebarUtil.Message, "findOneOrFail", async () => ({ id: "referenced_message_id", channel_id: "channel_id", guild_id: "guild_id" }));
        t.mock.method(spacebarUtil.Message, "findOne", async () => ({ id: "referenced_message_id", author_id: "reply_author", channel_id: "channel_id" }));
        t.mock.method(spacebarUtil.Guild, "findOneOrFail", async () => ({ id: "guild_id" }));
        t.mock.method(spacebarUtil.User, "findOneOrFail", async () => ({ id: "author_id", clean_data: () => undefined }));
        t.mock.method(spacebarUtil.User, "findOne", async ({ where }: { where: { id: string } }) => users.get(where.id) ?? null);
        t.mock.method(spacebarUtil.Role, "findOneOrFail", async ({ where }: { where: { id: string } }) => ({ id: where.id, guild_id: "guild_id", mentionable: true }));
        t.mock.method(spacebarUtil.Role, "findOne", async ({ where }: { where: { id: string } }) => ({ id: where.id, guild_id: "guild_id", mentionable: true }));
        t.mock.method(spacebarUtil.Member, "find", async () => [{ id: "role_or_everyone_member" }]);
        t.mock.method(spacebarUtil.Session, "find", async () => [{ user_id: "online_here_member" }]);
        t.mock.method(spacebarUtil.ReadState, "findBy", async () => []);
        t.mock.method(spacebarUtil.ReadState, "create", (value: Record<string, unknown>) => ({ ...value, save: async () => value }));
        t.mock.method(spacebarUtil.ReadState, "getRepository", () => ({
            update: async () => undefined,
            increment: async (...args: unknown[]) => {
                incrementCalls.push(args);
            },
        }));
        t.mock.method(permissionsModule, "getPermission", async () => permission);
        t.mock.method(rightsModule, "getRights", async () => rights);

        const { handleMessage } = (await import("./Message.js")) as typeof import("./Message");

        await handleMessage({
            id: "message_id",
            channel_id: "channel_id",
            author_id: "author_id",
            content: "hello @everyone @here <@111> <@&444>",
            message_reference: { message_id: "referenced_message_id" },
            allowed_mentions: { parse: [], users: [], roles: [], replied_user: false },
        });

        assert.equal(incrementCalls.length, 0);
    });

    test("absent allowed_mentions keeps legacy mention notification behavior", async (t) => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost/spacebar_test";

        const spacebarUtil = requireModule("@spacebar/util") as typeof import("@spacebar/util");
        const permissionsModule = requireModule("../../../util/util/Permissions") as typeof import("../../../util/util/Permissions");
        const rightsModule = requireModule("../../../util/util/Rights") as typeof import("../../../util/util/Rights");

        const channel = { id: "channel_id", guild_id: "guild_id", type: 0, rate_limit_per_user: 0, recipients: [], save: async () => undefined };
        const permission = { cache: {}, has: (name: string) => name === "MANAGE_ROLES", hasThrow: () => undefined };
        const incrementCalls: unknown[][] = [];

        t.mock.method(spacebarUtil.Config, "get", () => ({ limits: { message: { maxCharacters: 2000 } } }));
        t.mock.method(spacebarUtil.Channel, "findOneOrFail", async () => channel);
        t.mock.method(spacebarUtil.Message, "create", (input: Record<string, unknown>) => ({
            ...input,
            flags: 0,
            attachments: [],
            embeds: [],
            mentions: [],
            mention_roles: [],
            save: async () => undefined,
        }));
        t.mock.method(spacebarUtil.User, "findOneOrFail", async () => ({ id: "author_id", clean_data: () => undefined }));
        t.mock.method(spacebarUtil.User, "findOne", async ({ where }: { where: { id: string } }) => ({ id: where.id }));
        t.mock.method(spacebarUtil.Role, "findOneOrFail", async ({ where }: { where: { id: string } }) => ({ id: where.id, guild_id: "guild_id", mentionable: true }));
        t.mock.method(spacebarUtil.Role, "findOne", async ({ where }: { where: { id: string } }) => ({ id: where.id, guild_id: "guild_id", mentionable: true }));
        t.mock.method(spacebarUtil.Member, "find", async () => [{ id: "role_member_id" }]);
        t.mock.method(spacebarUtil.Session, "find", async () => []);
        t.mock.method(spacebarUtil.ReadState, "findBy", async () => []);
        t.mock.method(spacebarUtil.ReadState, "create", (value: Record<string, unknown>) => ({ ...value, save: async () => value }));
        t.mock.method(spacebarUtil.ReadState, "getRepository", () => ({
            update: async () => undefined,
            increment: async (...args: unknown[]) => incrementCalls.push(args),
        }));
        t.mock.method(permissionsModule, "getPermission", async () => permission);
        t.mock.method(rightsModule, "getRights", async () => ({ hasThrow: () => undefined }));

        const { handleMessage } = (await import("./Message.js")) as typeof import("./Message");

        await handleMessage({
            id: "message_id",
            channel_id: "channel_id",
            author_id: "author_id",
            content: "hello <@111> <@&444>",
        });

        assert.equal(incrementCalls.length, 1);
        assert.match(JSON.stringify(incrementCalls[0][0]), /111/);
        assert.match(JSON.stringify(incrementCalls[0][0]), /role_member_id/);
    });
});
