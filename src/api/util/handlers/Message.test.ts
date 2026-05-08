import { describe, test, type TestContext } from "node:test";
import assert from "node:assert/strict";

const requireModule = require;

type MessageLimitMock = {
    maxCharacters: number;
    maxTTSCharacters: number;
    maxEmbeds: number;
};

function setupHandleMessageMocks(t: TestContext, limits: number | MessageLimitMock) {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost/spacebar_test";
    const messageLimits = typeof limits === "number" ? { maxCharacters: limits, maxTTSCharacters: limits, maxEmbeds: 20 } : limits;

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

    return { createMessageMock, findChannelMock };
}

describe("handleMessage", () => {
    test("preserves supplied reactions when reconstructing an edited message", async (t) => {
        const { createMessageMock } = setupHandleMessageMocks(t, 2000);

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

    test("rejects content longer than the configured message character limit", async (t) => {
        const { createMessageMock, findChannelMock } = setupHandleMessageMocks(t, 5);

        const { handleMessage } = (await import("./Message.js")) as typeof import("./Message");

        await assert.rejects(
            () =>
                handleMessage({
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
        assert.equal(findChannelMock.mock.callCount(), 0);
        assert.equal(createMessageMock.mock.callCount(), 0);
    });

    test("rejects TTS content longer than the configured TTS character limit before side effects", async (t) => {
        const { createMessageMock, findChannelMock } = setupHandleMessageMocks(t, { maxCharacters: 100, maxTTSCharacters: 3, maxEmbeds: 20 });

        const { handleMessage } = (await import("./Message.js")) as typeof import("./Message");

        await assert.rejects(
            () =>
                handleMessage({
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
        assert.equal(findChannelMock.mock.callCount(), 0);
        assert.equal(createMessageMock.mock.callCount(), 0);
    });

    test("rejects embed arrays over the configured embed count before side effects", async (t) => {
        const { createMessageMock, findChannelMock } = setupHandleMessageMocks(t, { maxCharacters: 100, maxTTSCharacters: 100, maxEmbeds: 1 });

        const { handleMessage } = (await import("./Message.js")) as typeof import("./Message");

        await assert.rejects(
            () =>
                handleMessage({
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
        assert.equal(findChannelMock.mock.callCount(), 0);
        assert.equal(createMessageMock.mock.callCount(), 0);
    });
});
