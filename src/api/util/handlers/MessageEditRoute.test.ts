import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";

const requireModule = require;

describe("PATCH /channels/:channel_id/messages/:message_id", () => {
    test("passes persisted reactions from the loaded message into handleMessage", async (t) => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost/spacebar_test";

        const spacebarUtil = requireModule("@spacebar/util") as typeof import("@spacebar/util");
        const permissionsModule = requireModule("../../../util/util/Permissions") as typeof import("../../../util/util/Permissions");
        const rightsModule = requireModule("../../../util/util/Rights") as typeof import("../../../util/util/Rights");
        const eventModule = requireModule("../../../util/util/Event") as typeof import("../../../util/util/Event");
        const messageHandlerModule = requireModule("./Message") as typeof import("./Message");
        const { patchMessage } = requireModule("./MessageEditRoute") as typeof import("./MessageEditRoute");

        const reactions = [{ count: 1, emoji: { name: "thumb" }, user_ids: ["reacting_user_id"] }];
        const persistedMessage = {
            id: "message_id",
            author_id: "author_id",
            channel_id: "channel_id",
            content: "before",
            embeds: [],
            attachments: [],
            reactions,
            message_reference: undefined,
        };
        const newMessage = {
            ...persistedMessage,
            content: "after",
            edited_timestamp: new Date("2026-01-02T03:04:05.000Z"),
            member: undefined,
            author: undefined,
            mention_roles: [],
            mention_everyone: false,
            mention_channels: undefined,
            pinned: false,
            timestamp: new Date("2026-01-01T03:04:05.000Z"),
            type: 0,
            save: async () => undefined,
            toJSON: () => ({
                ...persistedMessage,
                content: "after",
                reactions,
            }),
        };
        const permission = {
            hasThrow: () => undefined,
        };
        const rights = {
            has: () => true,
            hasThrow: () => undefined,
        };

        let handleMessageOptions: Record<string, unknown> | undefined;

        t.mock.method(spacebarUtil.Message, "findOneOrFail", async () => persistedMessage);
        t.mock.method(permissionsModule, "getPermission", async () => permission);
        t.mock.method(rightsModule, "getRights", async () => rights);
        t.mock.method(eventModule, "emitEvent", async () => undefined);
        t.mock.method(messageHandlerModule, "postHandleMessage", async () => undefined);
        t.mock.method(messageHandlerModule, "handleMessage", async (options: Record<string, unknown>) => {
            handleMessageOptions = options;
            return newMessage;
        });

        const req = {
            user_id: "author_id",
            params: {
                channel_id: "channel_id",
                message_id: "message_id",
            },
            body: {
                content: "after",
            },
        } as unknown as Request;
        const res = {
            json: t.mock.fn((value: unknown) => value),
        } as unknown as Response;

        await patchMessage(req, res);

        assert.ok(handleMessageOptions);
        assert.equal(handleMessageOptions.reactions, reactions);
        assert.equal(handleMessageOptions.content, "after");
        assert.equal(handleMessageOptions.author_id, "author_id");
        assert.equal(handleMessageOptions.channel_id, "channel_id");
        assert.equal(handleMessageOptions.id, "message_id");
        assert.ok(handleMessageOptions.edited_timestamp instanceof Date);
        assert.equal((res.json as unknown as { mock: { calls: unknown[] } }).mock.calls.length, 1);
    });
});
