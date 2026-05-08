import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { describe, test } from "node:test";
import express from "express";
import { Channel, Config, DiscordApiErrors, Guild, type ObjectErrorContent, Tag } from "@spacebar/util";
import { type ForumTagPersistenceManager, getAvailableTagsModifyError, replaceForumAvailableTags, requireAvailableTag } from "./ForumTags";

let saved: string[] = [];
let removed: string[] = [];

function tag(id: string): Tag {
    return { id } as Tag;
}

function readSource(path: string): string {
    return readFileSync(join(process.cwd(), path), "utf8");
}

function createTag(overrides: Partial<Tag> = {}) {
    const tag = new Tag();
    Object.assign(tag, {
        id: overrides.id ?? `tag-${Math.random()}`,
        name: overrides.name ?? "tag",
        moderated: overrides.moderated ?? false,
        emoji_id: overrides.emoji_id,
        emoji_name: overrides.emoji_name,
        save: async function save(this: Tag) {
            saved.push(this.id);
            return this;
        },
        remove: async function remove(this: Tag) {
            removed.push(this.id);
            return this;
        },
        ...overrides,
    });
    return tag;
}

function createForumChannel(tags: Tag[]) {
    const channel = new Channel();
    channel.id = "forum-id";
    channel.available_tags = tags;
    channel.isForum = () => true;
    return channel;
}

function createPersistenceManager(): ForumTagPersistenceManager {
    return {
        save: (async (entity: unknown) => {
            const tag = entity as Tag;
            saved.push(tag.id);
            return tag;
        }) as ForumTagPersistenceManager["save"],
        remove: (async (entity: unknown) => {
            const tag = entity as Tag;
            removed.push(tag.id);
            return tag;
        }) as ForumTagPersistenceManager["remove"],
    } as ForumTagPersistenceManager;
}

describe("forum tag helpers", () => {
    test("returns the requested tag from the channel available tags", () => {
        const expected = tag("tag-2");

        assert.equal(
            requireAvailableTag(
                {
                    available_tags: [tag("tag-1"), expected],
                },
                "tag-2",
            ),
            expected,
        );
    });

    test("throws the typed unknown tag API error when the channel does not contain the tag", () => {
        assert.throws(
            () =>
                requireAvailableTag(
                    {
                        available_tags: [tag("tag-1")],
                    },
                    "tag-2",
                ),
            (error) => error === DiscordApiErrors.UNKNOWN_TAG,
        );
    });

    test("throws the typed unknown tag API error when channel tags were not loaded", () => {
        assert.throws(
            () => requireAvailableTag({}, "tag-2"),
            (error) => error === DiscordApiErrors.UNKNOWN_TAG,
        );
    });

    test("forum tag routes resolve tags through the channel-scoped helper", () => {
        const source = readSource("src/api/routes/channels/#channel_id/tags.ts");

        assert.equal(source.includes("TODO better error"), false);
        assert.equal(source.includes('new HTTPError("Tag not found")'), false);
        assert.equal(source.includes("Tag.findOneByOrFail"), false);
        assert.equal(source.match(/requireAvailableTag\(channel, tag_id\)/g)?.length, 2);
    });
});

describe("forum available tag replacement", () => {
    test("updates existing tags, creates new tags, removes omitted tags, and awaits persistence", async () => {
        saved = [];
        removed = [];
        const originalCreate = Tag.create;
        const createdTag = createTag({ id: "new-tag" });
        Tag.create = ((payload: Partial<Tag>) => Object.assign(createdTag, payload)) as typeof Tag.create;

        try {
            const keep = createTag({ id: "keep", name: "old", moderated: false, emoji_id: "old-emoji" });
            const remove = createTag({ id: "remove" });
            const channel = createForumChannel([keep, remove]);

            await replaceForumAvailableTags(
                channel,
                [
                    { id: "keep", name: "updated", moderated: true, emoji_name: "🔥" },
                    { name: "created", moderated: null, emoji_id: null, emoji_name: null },
                ],
                createPersistenceManager(),
            );

            assert.deepEqual(
                channel.available_tags?.map((tag) => tag.id),
                ["keep", "new-tag"],
            );
            assert.equal(keep.name, "updated");
            assert.equal(keep.moderated, true);
            assert.equal(keep.emoji_id, undefined);
            assert.equal(keep.emoji_name, "🔥");
            assert.equal(createdTag.channel, channel);
            assert.equal(createdTag.channel_id, "forum-id");
            assert.equal(createdTag.name, "created");
            assert.equal(createdTag.moderated, false);
            assert.deepEqual(saved.sort(), ["keep", "new-tag"].sort());
            assert.deepEqual(removed, ["remove"]);
        } finally {
            Tag.create = originalCreate;
        }
    });

    test("reports unknown and duplicate tag ids", () => {
        const channel = createForumChannel([createTag({ id: "known" })]);

        const unknownErrors = getAvailableTagsModifyError(channel, [{ id: "missing", name: "bad" }]);
        assert.deepEqual((unknownErrors?.available_tags as ObjectErrorContent | undefined)?._errors[0], {
            code: "BASE_TYPE_BAD_VALUE",
            message: "Unknown tag missing",
        });

        const duplicateErrors = getAvailableTagsModifyError(channel, [
            { id: "known", name: "one" },
            { id: "known", name: "two" },
        ]);
        assert.deepEqual((duplicateErrors?.available_tags as ObjectErrorContent | undefined)?._errors[0], {
            code: "BASE_TYPE_BAD_VALUE",
            message: "Duplicate tag id known",
        });
    });

    test("rejects available tag modification for non-forum channels", () => {
        const channel = new Channel();
        channel.isForum = () => false;

        const errors = getAvailableTagsModifyError(channel, [{ name: "tag" }]);

        assert.deepEqual((errors?.available_tags as ObjectErrorContent | undefined)?._errors[0], {
            code: "BASE_TYPE_BAD_VALUE",
            message: "Available tags can only be set on forum channels",
        });
    });

    test("does not persist available tag replacement when later channel validation fails", async (t) => {
        saved = [];
        removed = [];

        const routeHandler = require(`${process.cwd()}/dist/api/util/handlers/route`) as {
            route: () => express.RequestHandler;
        };
        const routeModulePath = require.resolve(join(process.cwd(), "dist", "api", "routes", "channels", "#channel_id", "index.js"));

        t.mock.method(routeHandler, "route", () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next());
        t.mock.method(Config, "get", () => ({ limits: { channel: { maxName: 4, maxTopic: 100 } } }));
        t.mock.method(Guild, "findOneOrFail", async () => ({ features: [] }));

        const keep = createTag({ id: "keep", name: "keep" });
        const remove = createTag({ id: "remove", name: "remove" });
        const channel = createForumChannel([keep, remove]);
        channel.guild_id = "guild-id";
        channel.type = 15;
        channel.save = async () => {
            throw new Error("channel.save should not run for an invalid payload");
        };

        t.mock.method(Channel, "findOneOrFail", async () => channel);
        delete require.cache[routeModulePath];

        try {
            const router = require(routeModulePath).default as express.Router;
            const app = createChannelRouteApp(router);

            const { response, json } = await patchJson(app, "/channels/forum-id/", {
                available_tags: [{ id: "keep", name: "updated" }],
                name: "name-too-long",
            });

            assert.equal(response.status, 400);
            assert.deepEqual(json.errors.name._errors[0], {
                code: "BASE_TYPE_BAD_LENGTH",
                message: "Channel name must be between 1 and 4 characters",
            });
            assert.deepEqual(saved, []);
            assert.deepEqual(removed, []);
            assert.deepEqual(
                channel.available_tags?.map((tag) => tag.id),
                ["keep", "remove"],
            );
        } finally {
            delete require.cache[routeModulePath];
        }
    });

    test("persists route tag replacement and channel update in one database transaction", async (t) => {
        saved = [];
        removed = [];

        const routeHandler = require(`${process.cwd()}/dist/api/util/handlers/route`) as {
            route: () => express.RequestHandler;
        };
        const databaseModule = require(`${process.cwd()}/dist/util/util/Database`) as typeof import("../../../util/util/Database");
        const eventModule = require(`${process.cwd()}/dist/util/util/Event`) as typeof import("../../../util/util/Event");
        const routeModulePath = require.resolve(join(process.cwd(), "dist", "api", "routes", "channels", "#channel_id", "index.js"));
        const transactionCalls: string[] = [];
        const manager = {
            save: async (entity: { id?: string }) => {
                transactionCalls.push(`save:${entity instanceof Channel ? "channel" : entity.id}`);
                return entity;
            },
            remove: async (entity: { id?: string }) => {
                transactionCalls.push(`remove:${entity.id}`);
                return entity;
            },
        };

        t.mock.method(routeHandler, "route", () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next());
        t.mock.method(Config, "get", () => ({ limits: { channel: { maxName: 100, maxTopic: 100 } } }));
        t.mock.method(databaseModule, "getDatabase", () => ({
            transaction: async (callback: (transactionManager: typeof manager) => Promise<void>) => {
                transactionCalls.push("begin");
                await callback(manager);
                transactionCalls.push("commit");
            },
        }));

        const keep = createTag({ id: "keep", name: "keep" });
        const remove = createTag({ id: "remove", name: "remove" });
        const channel = createForumChannel([keep, remove]);
        channel.type = 15;
        channel.toJSON = (() => ({
            id: channel.id,
            available_tags: channel.available_tags?.map((tag) => tag.toJSON()),
        })) as Channel["toJSON"];
        t.mock.method(Channel, "findOneOrFail", async () => channel);
        t.mock.method(eventModule, "emitEvent", async () => undefined);
        delete require.cache[routeModulePath];

        try {
            const router = require(routeModulePath).default as express.Router;
            const app = createChannelRouteApp(router);

            const { response } = await patchJson(app, "/channels/forum-id/", {
                available_tags: [{ id: "keep", name: "updated" }],
            });

            assert.equal(response.status, 200);
            assert.deepEqual(transactionCalls, ["begin", "save:keep", "remove:remove", "save:channel", "commit"]);
            assert.deepEqual(saved, []);
            assert.deepEqual(removed, []);
            assert.equal(keep.name, "updated");
            assert.deepEqual(
                channel.available_tags?.map((tag) => tag.id),
                ["keep"],
            );
        } finally {
            delete require.cache[routeModulePath];
        }
    });
});

function createChannelRouteApp(router: express.Router) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        const request = req as express.Request & { user_id: string };
        const authRequest = req as unknown as {
            user: { id: string };
            permission: { hasThrow: () => true };
        };
        request.user_id = "user-id";
        authRequest.user = { id: "user-id" };
        authRequest.permission = { hasThrow: () => true };
        next();
    });
    app.use("/channels/:channel_id", router);
    app.use((error: { code?: number | string; message?: string; errors?: unknown }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        const status = error.code === 400 || error.code === 50035 ? 400 : 500;
        res.status(status).json({ code: error.code, message: error.message, errors: error.errors });
    });

    return app;
}

async function patchJson(app: express.Express, path: string, body: object) {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
    const port = (address as AddressInfo).port;

    try {
        const response = await fetch(`http://127.0.0.1:${port}${path}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
        });
        const json = (await response.json()) as { errors: { name: ObjectErrorContent } };

        return { response, json };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}
