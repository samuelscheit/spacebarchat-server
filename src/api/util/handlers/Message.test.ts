import { describe, test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

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

async function setupHandleMessageTest(t: TestContext) {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost/spacebar_test";

    const spacebarUtil = requireModule("@spacebar/util") as typeof import("@spacebar/util");
    const utilDistPath = path.dirname(requireModule.resolve("@spacebar/util"));
    const permissionsModule = requireModule(path.join(utilDistPath, "util", "Permissions.js")) as typeof import("../../../util/util/Permissions");
    const rightsModule = requireModule(path.join(utilDistPath, "util", "Rights.js")) as typeof import("../../../util/util/Rights");

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
    return { createMessageMock, handleMessage };
}

describe("handleMessage", () => {
    test("preserves supplied reactions when reconstructing an edited message", async (t) => {
        const { createMessageMock, handleMessage } = await setupHandleMessageTest(t);
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

    test("passes stored poll shape to Message.create", async (t) => {
        const { createMessageMock, handleMessage } = await setupHandleMessageTest(t);
        const start = Date.now();

        await handleMessage({
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
        const poll = (createMessageMock.mock.calls[0].arguments[0] as Record<string, unknown>).poll as {
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
});
