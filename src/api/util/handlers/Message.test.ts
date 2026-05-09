import { describe, test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import type { ApiError } from "../../../util/util/ApiError";

const requireModule = require;

describe("createPollFromMessageOptions", () => {
    test("converts request poll creation options to stored poll shape", async () => {
        const { createPollFromMessageOptions } = (await import("./Message.js")) as typeof import("./Message");
        const now = new Date("2026-05-08T00:00:00.000Z");

        const poll = createPollFromMessageOptions(
            {
                question: { text: "Deploy?" },
                answers: [{ poll_media: { text: "Yes" } }, { poll_media: { text: "No" } }],
                duration: 2,
            },
            now,
        );

        assert.deepEqual(poll, {
            question: { text: "Deploy?" },
            answers: [
                { answer_id: 1, poll_media: { text: "Yes" } },
                { answer_id: 2, poll_media: { text: "No" } },
            ],
            expiry: new Date("2026-05-08T02:00:00.000Z"),
            allow_multiselect: false,
            layout_type: 1,
        });
    });

    test("ignores client-supplied answer ids and preserves requested layout", async () => {
        const { createPollFromMessageOptions } = (await import("./Message.js")) as typeof import("./Message");
        const now = new Date("2026-05-08T00:00:00.000Z");

        const poll = createPollFromMessageOptions(
            {
                question: { text: "Deploy?" },
                answers: [{ answer_id: 99, poll_media: { text: "Yes" } }],
                layout_type: 1,
            } as unknown as Parameters<typeof createPollFromMessageOptions>[0],
            now,
        );

        assert.deepEqual(poll?.answers, [{ answer_id: 1, poll_media: { text: "Yes" } }]);
        assert.equal(poll?.layout_type, 1);
        assert.equal(poll?.expiry.getTime(), new Date("2026-05-09T00:00:00.000Z").getTime());
    });

    test("preserves stored poll objects", async () => {
        const { createPollFromMessageOptions } = (await import("./Message.js")) as typeof import("./Message");
        const storedPoll = {
            question: { text: "Deploy?" },
            answers: [{ answer_id: 1, poll_media: { text: "Yes" } }],
            expiry: new Date("2026-05-09T00:00:00.000Z"),
            allow_multiselect: true,
            layout_type: 1,
        };

        assert.deepEqual(createPollFromMessageOptions(storedPoll), storedPoll);
    });
});

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

type MessageLimitMock = {
    maxCharacters: number;
    maxTTSCharacters: number;
    maxEmbeds: number;
    maxEmbedDescription?: number;
    maxEmbedCharacters?: number;
};

type HandleMessageTestOptions = {
    channel?: Partial<MockChannel>;
    messageFindOneResult?: unknown;
    messageLimits?: number | MessageLimitMock;
    permissionHas?: (name: string) => boolean;
    users?: MockUser[];
    memberFindResult?: { id: string }[];
    sessionFindResult?: { user_id: string }[];
    referencedMessage?: { id: string; author_id: string; channel_id: string; guild_id?: string | null };
};

type HandleMessageTestContext = Awaited<ReturnType<typeof setupHandleMessageTest>>;

async function setupHandleMessageTest(t: TestContext, options: HandleMessageTestOptions = {}) {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost/spacebar_test";
    const messageLimits =
        typeof options.messageLimits === "number"
            ? { maxCharacters: options.messageLimits, maxTTSCharacters: options.messageLimits, maxEmbeds: 20 }
            : (options.messageLimits ?? { maxCharacters: 2000, maxTTSCharacters: 160, maxEmbeds: 20 });

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
            message: messageLimits,
        },
    }));
    const findChannelMock = t.mock.method(spacebarUtil.Channel, "findOneOrFail", async () => channel);
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
    const findOneMock = t.mock.method(spacebarUtil.Message, "findOne", async () =>
        options.messageFindOneResult !== undefined ? options.messageFindOneResult : options.referencedMessage ? { ...options.referencedMessage } : null,
    );
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
    const getPermissionMock = t.mock.method(permissionsModule, "getPermission", async () => permission);
    t.mock.method(rightsModule, "getRights", async () => ({ hasThrow: () => undefined }));

    const { handleMessage } = (await import("./Message.js")) as typeof import("./Message");

    return {
        channel,
        createMessageMock,
        createdReadStates,
        findChannelMock,
        findOneMock,
        findByCalls,
        getPermissionMock,
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

    test("parse users allows all content user mention-count notifications", async (t) => {
        const context = await setupHandleMessageTest(t);

        await context.handleMessage({
            id: "message_id",
            channel_id: "channel_id",
            author_id: "author_id",
            content: "hello <@111> <@222> <@&444>",
            allowed_mentions: { parse: ["users"], users: [], roles: [] },
        });

        assert.equal(context.incrementCalls.length, 1);
        assert.equal(context.memberFindCalls.length, 0);
        assert.match(incrementCondition(context), /111/);
        assert.match(incrementCondition(context), /222/);
        assert.doesNotMatch(incrementCondition(context), /role_member_id/);
    });

    test("parse roles allows role mention-count notifications", async (t) => {
        const context = await setupHandleMessageTest(t);

        await context.handleMessage({
            id: "message_id",
            channel_id: "channel_id",
            author_id: "author_id",
            content: "hello <@111> <@&444>",
            allowed_mentions: { parse: ["roles"], users: [], roles: [] },
        });

        assert.equal(context.incrementCalls.length, 1);
        assert.equal(context.memberFindCalls.length, 1);
        assert.match(JSON.stringify(context.memberFindCalls), /444/);
        assert.match(incrementCondition(context), /role_member_id/);
        assert.doesNotMatch(incrementCondition(context), /111/);
    });

    test("explicit allowed role ids limit role mention-count notifications", async (t) => {
        const context = await setupHandleMessageTest(t);

        await context.handleMessage({
            id: "message_id",
            channel_id: "channel_id",
            author_id: "author_id",
            content: "hello <@&444> <@&555>",
            allowed_mentions: { parse: [], users: [], roles: ["444"] },
        });

        assert.equal(context.incrementCalls.length, 1);
        assert.equal(context.memberFindCalls.length, 1);
        assert.match(JSON.stringify(context.memberFindCalls), /444/);
        assert.doesNotMatch(JSON.stringify(context.memberFindCalls), /555/);
        assert.match(incrementCondition(context), /role_member_id/);
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

    test("parse everyone allows everyone mention-count notifications for all guild members", async (t) => {
        const context = await setupHandleMessageTest(t, {
            memberFindResult: [{ id: "guild_member_1" }, { id: "guild_member_2" }],
        });

        await context.handleMessage({
            id: "message_id",
            channel_id: "channel_id",
            author_id: "author_id",
            content: "hello @everyone",
            allowed_mentions: { parse: ["everyone"], users: [], roles: [] },
        });

        assert.equal(context.incrementCalls.length, 1);
        assert.equal(context.updateCalls.length, 1);
        assert.deepEqual(context.createdReadStates.map((state) => state.user_id).sort(), ["guild_member_1", "guild_member_2"]);
        assert.doesNotMatch(incrementCondition(context), /user_id/);
    });

    test("passes stored poll shape to Message.create", async (t) => {
        const context = await setupHandleMessageTest(t);
        const start = Date.now();

        await context.handleMessage({
            id: "message_id",
            channel_id: "channel_id",
            author_id: "author_id",
            poll: {
                question: { text: "Deploy?" },
                answers: [{ poll_media: { text: "Yes" } }],
                duration: 2,
            },
        });

        const end = Date.now();
        const poll = (context.createMessageMock.mock.calls[0].arguments[0] as Record<string, unknown>).poll as {
            question: unknown;
            answers: unknown;
            expiry: Date;
            allow_multiselect: boolean;
            layout_type: number;
            duration?: number;
        };

        assert.deepEqual(poll.question, { text: "Deploy?" });
        assert.deepEqual(poll.answers, [{ answer_id: 1, poll_media: { text: "Yes" } }]);
        assert.equal(poll.allow_multiselect, false);
        assert.equal(poll.layout_type, 1);
        assert.equal("duration" in poll, false);
        assert.ok(poll.expiry.getTime() >= start + 2 * 60 * 60 * 1000);
        assert.ok(poll.expiry.getTime() <= end + 2 * 60 * 60 * 1000);
    });

    test("rejects content longer than the configured message character limit", async (t) => {
        const context = await setupHandleMessageTest(t, { messageLimits: 5 });

        await assert.rejects(
            () =>
                context.handleMessage({
                    id: "message_id",
                    channel_id: "channel_id",
                    author_id: "author_id",
                    content: "too long",
                }),
            (error: unknown) => {
                assert.equal((error as { code?: unknown }).code, 50035);
                assert.deepEqual((error as { errors?: Record<string, unknown> }).errors?.content, {
                    _errors: [{ code: "BASE_TYPE_MAX_LENGTH", message: "Must be 5 or fewer in length." }],
                });
                return true;
            },
        );
        assert.equal(context.findChannelMock.mock.callCount(), 0);
        assert.equal(context.createMessageMock.mock.callCount(), 0);
    });

    test("rejects TTS content longer than the configured TTS character limit before side effects", async (t) => {
        const context = await setupHandleMessageTest(t, { messageLimits: { maxCharacters: 100, maxTTSCharacters: 3, maxEmbeds: 20 } });

        await assert.rejects(
            () =>
                context.handleMessage({
                    id: "message_id",
                    channel_id: "channel_id",
                    author_id: "author_id",
                    content: "1234",
                    tts: true,
                }),
            (error: unknown) => {
                assert.equal((error as { code?: unknown }).code, 50035);
                assert.deepEqual((error as { errors?: Record<string, unknown> }).errors?.content, {
                    _errors: [{ code: "BASE_TYPE_MAX_LENGTH", message: "TTS messages must be 3 or fewer in length." }],
                });
                return true;
            },
        );
        assert.equal(context.findChannelMock.mock.callCount(), 0);
        assert.equal(context.createMessageMock.mock.callCount(), 0);
    });

    test("rejects embed arrays over the configured embed count before side effects", async (t) => {
        const context = await setupHandleMessageTest(t, { messageLimits: { maxCharacters: 100, maxTTSCharacters: 100, maxEmbeds: 1 } });

        await assert.rejects(
            () =>
                context.handleMessage({
                    id: "message_id",
                    channel_id: "channel_id",
                    author_id: "author_id",
                    embeds: [{}, {}],
                }),
            (error: unknown) => {
                assert.equal((error as { code?: unknown }).code, 50035);
                assert.deepEqual((error as { errors?: Record<string, unknown> }).errors?.embeds, {
                    _errors: [{ code: "BASE_TYPE_MAX_ITEMS", message: "Must contain 1 or fewer items." }],
                });
                return true;
            },
        );
        assert.equal(context.findChannelMock.mock.callCount(), 0);
        assert.equal(context.createMessageMock.mock.callCount(), 0);
    });

    test("rejects embed text over configured limits before side effects", async (t) => {
        const context = await setupHandleMessageTest(t, {
            messageLimits: { maxCharacters: 100, maxTTSCharacters: 100, maxEmbeds: 1, maxEmbedDescription: 5, maxEmbedCharacters: 5 },
        });

        await assert.rejects(
            () =>
                context.handleMessage({
                    id: "message_id",
                    channel_id: "channel_id",
                    author_id: "author_id",
                    embeds: [{ description: "123456" }],
                }),
            (error: unknown) => {
                assert.equal((error as { code?: unknown }).code, 50035);
                assert.ok((error as { errors?: Record<string, unknown> }).errors?.["embeds[0].description"]);
                return true;
            },
        );
        assert.equal(context.findChannelMock.mock.callCount(), 0);
        assert.equal(context.createMessageMock.mock.callCount(), 0);
    });

    test("rejects a new user message inside channel slowmode", async (t) => {
        const context = await setupHandleMessageTest(t, {
            channel: { rate_limit_per_user: 10 },
            messageFindOneResult: { timestamp: new Date() },
            permissionHas: () => false,
        });

        await assert.rejects(
            () =>
                context.handleMessage({
                    id: "message_id",
                    channel_id: "channel_id",
                    author_id: "author_id",
                    content: "too soon",
                }),
            (error: unknown) => (error as ApiError).code === 20016,
        );

        assert.equal(context.createMessageMock.mock.callCount(), 0);
        assert.equal(context.getPermissionMock.mock.callCount(), 1);
        assert.deepEqual(context.findOneMock.mock.calls[0].arguments[0], {
            where: { channel_id: context.channel.id, author_id: "author_id" },
            select: { timestamp: true },
            order: { timestamp: "DESC" },
        });
    });

    test("allows channel slowmode bypass permissions", async (t) => {
        const context = await setupHandleMessageTest(t, {
            channel: { rate_limit_per_user: 10 },
            messageFindOneResult: { timestamp: new Date() },
            permissionHas: (permissionName: string) => permissionName === "BYPASS_SLOWMODE",
        });

        const message = await context.handleMessage({
            id: "message_id",
            channel_id: "channel_id",
            author_id: "author_id",
            content: "allowed by bypass",
        });

        assert.equal(message.content, "allowed by bypass");
        assert.equal(context.createMessageMock.mock.callCount(), 1);
    });

    test("does not apply channel slowmode to message edits", async (t) => {
        const context = await setupHandleMessageTest(t, {
            channel: { rate_limit_per_user: 10 },
            messageFindOneResult: { timestamp: new Date() },
            permissionHas: () => false,
        });

        const message = await context.handleMessage({
            id: "message_id",
            channel_id: "channel_id",
            author_id: "author_id",
            content: "edited content",
            is_edit: true,
        });

        assert.equal(message.content, "edited content");
        assert.equal(context.findOneMock.mock.callCount(), 0);
    });
});
