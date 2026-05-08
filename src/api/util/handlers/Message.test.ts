import { describe, test, type TestContext } from "node:test";
import assert from "node:assert/strict";

const requireModule = require;

type MockUser = {
    id: string;
    clean_data?: () => void;
    toPublicUser?: () => { id: string };
};

type MockChannel = {
    id: string;
    guild_id: string | null;
    type: number;
    rate_limit_per_user: number;
    recipients: { user_id: string }[];
    save: () => Promise<void>;
};

type HandleMessageTestOptions = {
    channel?: Partial<MockChannel>;
    permissionHas?: (name: string) => boolean;
    users?: MockUser[];
    memberFindResult?: { id: string }[];
    sessionFindResult?: { user_id: string }[];
    referencedMessage?: { id: string; author_id: string; channel_id: string; guild_id?: string | null };
};

type HandleMessageTestContext = Awaited<ReturnType<typeof setupHandleMessageTest>>;

async function setupHandleMessageTest(t: TestContext, options: HandleMessageTestOptions = {}) {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost/spacebar_test";

    const path = requireModule("node:path") as typeof import("node:path");
    const spacebarUtil = requireModule("@spacebar/util") as typeof import("@spacebar/util");
    const utilRoot = path.dirname(requireModule.resolve("@spacebar/util"));
    const permissionsModule = requireModule(path.join(utilRoot, "util", "Permissions.js")) as typeof import("../../../util/util/Permissions");
    const rightsModule = requireModule(path.join(utilRoot, "util", "Rights.js")) as typeof import("../../../util/util/Rights");

    const channel: MockChannel = {
        id: "channel_id",
        guild_id: "guild_id",
        type: 0,
        rate_limit_per_user: 0,
        recipients: [],
        save: async () => undefined,
        ...options.channel,
    };
    const permission = {
        cache: {},
        has: options.permissionHas ?? ((name: string) => name === "MENTION_EVERYONE" || name === "MANAGE_ROLES"),
        hasThrow: () => undefined,
    };
    const defaultUsers: MockUser[] = [
        { id: "author_id", clean_data: () => undefined },
        { id: "111" },
        { id: "222" },
        { id: "333" },
        { id: "reply_author", toPublicUser: () => ({ id: "reply_author" }) },
    ];
    const users = new Map([...defaultUsers, ...(options.users ?? [])].map((user) => [user.id, user]));
    const incrementCalls: unknown[][] = [];
    const updateCalls: unknown[][] = [];
    const findByCalls: unknown[][] = [];
    const memberFindCalls: unknown[][] = [];
    const createdReadStates: Record<string, unknown>[] = [];

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
    t.mock.method(spacebarUtil.Message, "findOneOrFail", async () =>
        options.referencedMessage
            ? {
                  ...options.referencedMessage,
              }
            : { id: "referenced_message_id", channel_id: channel.id, guild_id: channel.guild_id },
    );
    t.mock.method(spacebarUtil.Message, "findOne", async () => (options.referencedMessage ? { ...options.referencedMessage } : null));
    t.mock.method(spacebarUtil.Guild, "findOneOrFail", async () => ({ id: channel.guild_id }));
    t.mock.method(spacebarUtil.User, "findOneOrFail", async ({ where }: { where?: { id?: string } } = {}) => {
        const id = where?.id ?? "author_id";
        return users.get(id) ?? { id, clean_data: () => undefined };
    });
    t.mock.method(spacebarUtil.User, "findOne", async ({ where }: { where: { id: string } }) => users.get(where.id) ?? null);
    t.mock.method(spacebarUtil.Role, "findOneOrFail", async ({ where }: { where: { id: string; guild_id?: string | null } }) => ({
        id: where.id,
        guild_id: where.guild_id ?? channel.guild_id,
        mentionable: true,
    }));
    t.mock.method(spacebarUtil.Role, "findOne", async ({ where }: { where: { id: string; guild_id?: string | null } }) => ({
        id: where.id,
        guild_id: where.guild_id ?? channel.guild_id,
        mentionable: true,
    }));
    t.mock.method(spacebarUtil.Member, "find", async (...args: unknown[]) => {
        memberFindCalls.push(args);
        return options.memberFindResult ?? [{ id: "role_member_id" }];
    });
    t.mock.method(spacebarUtil.Session, "find", async () => options.sessionFindResult ?? []);
    t.mock.method(spacebarUtil.ReadState, "findBy", async (...args: unknown[]) => {
        findByCalls.push(args);
        return [];
    });
    t.mock.method(spacebarUtil.ReadState, "create", (value: Record<string, unknown>) => ({
        ...value,
        save: async () => {
            createdReadStates.push(value);
            return value;
        },
    }));
    t.mock.method(spacebarUtil.ReadState, "getRepository", () => ({
        update: async (...args: unknown[]) => {
            updateCalls.push(args);
        },
        increment: async (...args: unknown[]) => {
            incrementCalls.push(args);
        },
    }));
    t.mock.method(permissionsModule, "getPermission", async () => permission);
    t.mock.method(rightsModule, "getRights", async () => ({ hasThrow: () => undefined }));

    const { handleMessage } = (await import("./Message.js")) as typeof import("./Message");

    return {
        channel,
        createMessageMock,
        createdReadStates,
        findByCalls,
        handleMessage,
        incrementCalls,
        memberFindCalls,
        updateCalls,
    };
}

function incrementCondition(context: HandleMessageTestContext, index = 0) {
    return JSON.stringify(context.incrementCalls[index]?.[0] ?? {});
}

describe("handleMessage", () => {
    test("preserves supplied reactions when reconstructing an edited message", async (t) => {
        const context = await setupHandleMessageTest(t, {
            permissionHas: () => false,
        });
        const reactions = [{ count: 1, emoji: { name: "thumb" }, user_ids: ["user_id"] }];

        const message = await context.handleMessage({
            id: "message_id",
            channel_id: "channel_id",
            author_id: "author_id",
            content: "edited content",
            reactions,
        });

        assert.equal(message.reactions, reactions);
        assert.equal((context.createMessageMock.mock.calls[0].arguments[0] as Record<string, unknown>).reactions, reactions);
    });

    test("allowed_mentions controls mention-count notification targets", async (t) => {
        const context = await setupHandleMessageTest(t);

        await context.handleMessage({
            id: "message_id",
            channel_id: "channel_id",
            author_id: "author_id",
            content: "hello <@111> <@222> <@&444>",
            allowed_mentions: { parse: [], users: ["222"], roles: [] },
        });

        assert.equal(context.incrementCalls.length, 1);
        assert.equal(context.findByCalls.length, 1);
        assert.equal(context.memberFindCalls.length, 0);
        assert.match(incrementCondition(context), /222/);
        assert.doesNotMatch(incrementCondition(context), /111|role_member_id/);
    });

    test("allowed_mentions suppresses user, role, everyone, and reply notifications when parse is empty", async (t) => {
        const context = await setupHandleMessageTest(t, {
            referencedMessage: { id: "referenced_message_id", author_id: "reply_author", channel_id: "channel_id", guild_id: "guild_id" },
            sessionFindResult: [{ user_id: "online_here_member" }],
        });

        await context.handleMessage({
            id: "message_id",
            channel_id: "channel_id",
            author_id: "author_id",
            content: "hello @everyone @here <@111> <@&444>",
            message_reference: { message_id: "referenced_message_id" },
            allowed_mentions: { parse: [], users: [], roles: [], replied_user: false },
        });

        assert.equal(context.incrementCalls.length, 0);
    });

    test("absent allowed_mentions keeps legacy mention notification behavior", async (t) => {
        const context = await setupHandleMessageTest(t, {
            permissionHas: (name: string) => name === "MANAGE_ROLES",
        });

        await context.handleMessage({
            id: "message_id",
            channel_id: "channel_id",
            author_id: "author_id",
            content: "hello <@111> <@&444>",
        });

        assert.equal(context.incrementCalls.length, 1);
        assert.match(incrementCondition(context), /111/);
        assert.match(incrementCondition(context), /role_member_id/);
    });

    test("edits recalculate mentions without incrementing mention-count notifications", async (t) => {
        const context = await setupHandleMessageTest(t);

        await context.handleMessage({
            id: "message_id",
            channel_id: "channel_id",
            author_id: "author_id",
            content: "edited hello <@111> <@&444> @everyone",
            allowed_mentions: { parse: ["users", "roles", "everyone"], replied_user: true },
            is_edit: true,
        });

        assert.equal(context.incrementCalls.length, 0);
    });

    test("replied_user true allows reply mention-count notifications", async (t) => {
        const context = await setupHandleMessageTest(t, {
            referencedMessage: { id: "referenced_message_id", author_id: "reply_author", channel_id: "channel_id", guild_id: "guild_id" },
        });

        await context.handleMessage({
            id: "message_id",
            channel_id: "channel_id",
            author_id: "author_id",
            content: "replying",
            message_reference: { message_id: "referenced_message_id" },
            allowed_mentions: { parse: [], users: [], roles: [], replied_user: true },
        });

        assert.equal(context.incrementCalls.length, 1);
        assert.match(incrementCondition(context), /reply_author/);
    });

    test("parse everyone allows here mention-count notifications for online members", async (t) => {
        const context = await setupHandleMessageTest(t, {
            memberFindResult: [{ id: "online_here_member" }, { id: "offline_member" }],
            sessionFindResult: [{ user_id: "online_here_member" }],
        });

        await context.handleMessage({
            id: "message_id",
            channel_id: "channel_id",
            author_id: "author_id",
            content: "hello @here",
            allowed_mentions: { parse: ["everyone"], users: [], roles: [] },
        });

        assert.equal(context.incrementCalls.length, 1);
        assert.match(incrementCondition(context), /online_here_member/);
    });
});
