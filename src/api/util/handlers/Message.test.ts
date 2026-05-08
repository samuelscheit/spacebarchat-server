import { describe, test, type TestContext } from "node:test";
import assert from "node:assert/strict";

const requireModule = require;

function mockHandleMessageDependencies(t: TestContext, messageLimits: Record<string, number> = { maxCharacters: 2000 }) {
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

describe("message embed payload validation", () => {
    test("accepts embeds at configured string and aggregate limits", async () => {
        const { validateMessageEmbeds } = (await import("./Message.js")) as typeof import("./Message");

        assert.doesNotThrow(() =>
            validateMessageEmbeds(
                [
                    {
                        title: "12345",
                        description: "12345",
                        footer: { text: "12345" },
                        author: { name: "12345" },
                        fields: [{ name: "12345", value: "12345" }],
                    },
                ],
                {
                    maxEmbeds: 1,
                    maxEmbedTitle: 5,
                    maxEmbedDescription: 5,
                    maxEmbedFields: 1,
                    maxEmbedFieldName: 5,
                    maxEmbedFieldValue: 5,
                    maxEmbedFooterText: 5,
                    maxEmbedAuthorName: 5,
                    maxEmbedCharacters: 30,
                },
            ),
        );
    });

    test("rejects embeds over configured field, count, and aggregate limits", async () => {
        const { validateMessageEmbeds } = (await import("./Message.js")) as typeof import("./Message");

        assert.throws(
            () =>
                validateMessageEmbeds(
                    [
                        {
                            title: "123456",
                            description: "123456",
                            footer: { text: "123456" },
                            author: { name: "123456" },
                            fields: [
                                { name: "123456", value: "123456" },
                                { name: "ok", value: "ok" },
                            ],
                        },
                        { title: "extra" },
                    ],
                    {
                        maxEmbeds: 1,
                        maxEmbedTitle: 5,
                        maxEmbedDescription: 5,
                        maxEmbedFields: 1,
                        maxEmbedFieldName: 5,
                        maxEmbedFieldValue: 5,
                        maxEmbedFooterText: 5,
                        maxEmbedAuthorName: 5,
                        maxEmbedCharacters: 10,
                    },
                ),
            (error: unknown) => {
                assert(error && typeof error === "object");
                const fieldError = error as { code?: unknown; errors?: Record<string, unknown> };
                assert.equal(fieldError.code, 50035);
                assert.ok(fieldError.errors?.embeds);
                assert.ok(fieldError.errors?.["embeds[0].title"]);
                assert.ok(fieldError.errors?.["embeds[0].description"]);
                assert.ok(fieldError.errors?.["embeds[0].footer.text"]);
                assert.ok(fieldError.errors?.["embeds[0].author.name"]);
                assert.ok(fieldError.errors?.["embeds[0].fields"]);
                assert.ok(fieldError.errors?.["embeds[0].fields[0].name"]);
                assert.ok(fieldError.errors?.["embeds[0].fields[0].value"]);
                return true;
            },
        );
    });
});

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

    test("rejects content over the configured message character limit", async (t) => {
        const { createMessageMock, findChannelMock } = mockHandleMessageDependencies(t, { maxCharacters: 5 });

        const { handleMessage } = (await import("./Message.js")) as typeof import("./Message");

        await assert.rejects(
            () =>
                handleMessage({
                    id: "message_id",
                    channel_id: "channel_id",
                    author_id: "author_id",
                    content: "123456",
                }),
            /Content length over max character limit/,
        );
        assert.equal(findChannelMock.mock.callCount(), 0);
        assert.equal(createMessageMock.mock.callCount(), 0);
    });

    test("rejects explicit embeds over configured limits before persisting", async (t) => {
        const { createMessageMock, findChannelMock } = mockHandleMessageDependencies(t, {
            maxCharacters: 2000,
            maxEmbeds: 1,
            maxEmbedDescription: 5,
            maxEmbedCharacters: 5,
        });

        const { handleMessage } = (await import("./Message.js")) as typeof import("./Message");

        await assert.rejects(
            () =>
                handleMessage({
                    id: "message_id",
                    channel_id: "channel_id",
                    author_id: "author_id",
                    embeds: [{ description: "123456" }],
                }),
            (error: unknown) => {
                assert(error && typeof error === "object");
                const fieldError = error as { code?: unknown; errors?: Record<string, unknown> };
                assert.equal(fieldError.code, 50035);
                assert.ok(fieldError.errors?.["embeds[0].description"]);
                return true;
            },
        );
        assert.equal(findChannelMock.mock.callCount(), 0);
        assert.equal(createMessageMock.mock.callCount(), 0);
    });
});
