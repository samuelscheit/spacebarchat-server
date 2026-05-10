/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { afterEach, describe, test, type TestContext } from "node:test";
import express from "express";

const requireModule = require;
const routeModulePath = require.resolve("./hide-guild-feed");

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("DELETE /channels/:channel_id/messages/:message_id/hide-guild-feed", () => {
    test("declares authenticated guild-feed unhide metadata", (t) => {
        const harness = setupGuildFeedVisibilityRoute(t, {});

        assert.deepEqual(harness.deleteRouteOptions, {
            permission: "VIEW_CHANNEL",
            summary: "Unhide Message from Guild Feed",
            description: "Unhides a message from the feed of the guild the channel belongs to.",
            event: "MESSAGE_UPDATE",
            responses: emptyResponseMetadata(),
        });
    });

    test("clears the guild-feed hidden flag and emits a message update", async (t) => {
        const hiddenFlag = getGuildFeedHiddenFlag();
        const harness = setupGuildFeedVisibilityRoute(t, {
            message: testMessage({
                flags: hiddenFlag | 4,
            }),
        });

        const response = await requestText(harness.app, "DELETE");

        assert.equal(response.status, 204);
        assert.equal(response.body, "");
        assert.equal(harness.message?.flags, 4);
        assert.deepEqual(harness.saveCalls, [4]);
        assert.deepEqual(harness.emitEventCalls, [
            {
                event: "MESSAGE_UPDATE",
                channel_id: "111111111111111111",
                data: {
                    id: "222222222222222222",
                    channel_id: "111111111111111111",
                    author_id: "viewer",
                    flags: 4,
                    nonce: undefined,
                },
            },
        ]);
    });
});

describe("POST /channels/:channel_id/messages/:message_id/hide-guild-feed", () => {
    test("declares authenticated guild-feed hide metadata", (t) => {
        const harness = setupGuildFeedVisibilityRoute(t, {});

        assert.deepEqual(harness.postRouteOptions, {
            permission: "VIEW_CHANNEL",
            summary: "Hide Message from Guild Feed",
            description: "Hides a message from the feed of the guild the channel belongs to.",
            event: "MESSAGE_UPDATE",
            responses: emptyResponseMetadata(),
        });
    });

    test("sets the guild-feed hidden flag and emits a message update", async (t) => {
        const hiddenFlag = getGuildFeedHiddenFlag();
        const harness = setupGuildFeedVisibilityRoute(t, {
            message: testMessage({ flags: 4 }),
        });

        const response = await requestText(harness.app, "POST");

        assert.equal(response.status, 204);
        assert.equal(response.body, "");
        assert.equal(harness.message?.flags, hiddenFlag | 4);
        assert.deepEqual(harness.channelFindOptions, [
            {
                where: {
                    id: "111111111111111111",
                },
                select: {
                    id: true,
                    guild_id: true,
                },
            },
        ]);
        assert.deepEqual(harness.messageFindOptions, [
            {
                where: {
                    id: "222222222222222222",
                    channel_id: "111111111111111111",
                },
                relations: getMessagePublicWithThreadRelations(),
            },
        ]);
        assert.deepEqual(harness.permissionChecks, ["VIEW_CHANNEL"]);
        assert.deepEqual(harness.saveCalls, [hiddenFlag | 4]);
        assert.deepEqual(harness.emitEventCalls, [
            {
                event: "MESSAGE_UPDATE",
                channel_id: "111111111111111111",
                data: {
                    id: "222222222222222222",
                    channel_id: "111111111111111111",
                    author_id: "viewer",
                    flags: hiddenFlag | 4,
                    nonce: undefined,
                },
            },
        ]);
    });

    test("returns unknown message without saving or emitting when the message is absent", async (t) => {
        const harness = setupGuildFeedVisibilityRoute(t, { message: null });

        const response = await requestText(harness.app, "POST");

        assert.equal(response.status, 404);
        assert.deepEqual(JSON.parse(response.body), {
            code: 10008,
            message: "Unknown message",
        });
        assert.equal(harness.saveCalls.length, 0);
        assert.equal(harness.emitEventCalls.length, 0);
    });

    test("rejects non-guild channels before message lookup", async (t) => {
        const harness = setupGuildFeedVisibilityRoute(t, {
            channel: {
                id: "111111111111111111",
                guild_id: null,
            },
        });

        const response = await requestText(harness.app, "POST");

        assert.equal(response.status, 400);
        assert.deepEqual(JSON.parse(response.body), {
            code: 50024,
            message: "Cannot execute action on this channel type",
        });
        assert.equal(harness.messageFindOptions.length, 0);
        assert.equal(harness.emitEventCalls.length, 0);
    });

    test("requires manage messages when hiding another user's message", async (t) => {
        const harness = setupGuildFeedVisibilityRoute(t, {
            message: testMessage({
                author_id: "other-user",
            }),
            missingPermissions: ["MANAGE_MESSAGES"],
        });

        const response = await requestText(harness.app, "POST");

        assert.equal(response.status, 403);
        assert.equal(JSON.parse(response.body).code, 50013);
        assert.deepEqual(harness.permissionChecks, ["VIEW_CHANNEL", "MANAGE_MESSAGES"]);
        assert.equal(harness.saveCalls.length, 0);
        assert.equal(harness.emitEventCalls.length, 0);
    });
});

type TestChannel = {
    id: string;
    guild_id: string | null;
};

type TestMessage = {
    id: string;
    channel_id: string;
    author_id: string;
    flags: number;
    save: () => Promise<void>;
    toJSON: () => Record<string, unknown>;
};

type SetupOptions = {
    channel?: TestChannel | null;
    message?: TestMessage | null;
    missingPermissions?: string[];
};

function setupGuildFeedVisibilityRoute(t: TestContext, options: SetupOptions) {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../../../util/handlers/route");
    const errorHandlerModule = requireModule(distModulePath("api", "middlewares", "ErrorHandler.js")) as typeof import("../../../../../middlewares/ErrorHandler");
    const eventModule = requireModule(distModulePath("util", "util", "Event.js")) as typeof import("../../../../../../util/util/Event");
    const permissionsModule = requireModule(distModulePath("util", "util", "Permissions.js")) as typeof import("../../../../../../util/util/Permissions");
    const util = requireModule("@spacebar/util") as typeof import("@spacebar/util");

    const routeOptions: unknown[] = [];
    const channelFindOptions: unknown[] = [];
    const messageFindOptions: unknown[] = [];
    const permissionChecks: string[] = [];
    const saveCalls: number[] = [];
    const emitEventCalls: unknown[] = [];
    const missingPermissions = new Set(options.missingPermissions ?? []);
    const channel =
        options.channel === undefined
            ? {
                  id: "111111111111111111",
                  guild_id: "333333333333333333",
              }
            : options.channel;
    const message = options.message === undefined ? testMessage() : options.message;
    if (message) {
        message.save = async () => {
            saveCalls.push(message.flags);
        };
    }

    t.mock.method(routeHandler, "route", (routeOption: unknown) => {
        routeOptions.push(routeOption);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });
    t.mock.method(util.Channel, "findOne", async (findOptions: unknown) => {
        channelFindOptions.push(findOptions);
        return channel;
    });
    t.mock.method(util.Message, "findOne", async (findOptions: unknown) => {
        messageFindOptions.push(findOptions);
        return message;
    });
    t.mock.method(permissionsModule, "getPermission", async () => ({
        hasThrow(permission: string) {
            permissionChecks.push(permission);
            if (missingPermissions.has(permission)) throw util.DiscordApiErrors.MISSING_PERMISSIONS.withParams(permission);
        },
    }));
    t.mock.method(eventModule, "emitEvent", async (event: unknown) => {
        emitEventCalls.push(event);
    });

    delete require.cache[routeModulePath];
    const router = (requireModule(routeModulePath) as typeof import("./hide-guild-feed")).default as express.Router;
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/channels/:channel_id/messages/:message_id/hide-guild-feed", router);
    app.use(errorHandlerModule.ErrorHandler);

    return {
        app,
        get channelFindOptions() {
            return channelFindOptions;
        },
        get deleteRouteOptions() {
            return routeOptions[0];
        },
        get emitEventCalls() {
            return emitEventCalls;
        },
        get message() {
            return message;
        },
        get messageFindOptions() {
            return messageFindOptions;
        },
        get permissionChecks() {
            return permissionChecks;
        },
        get postRouteOptions() {
            return routeOptions[1];
        },
        get saveCalls() {
            return saveCalls;
        },
    };
}

function emptyResponseMetadata() {
    return {
        204: {},
        400: {
            body: "APIErrorResponse",
        },
        401: {
            body: "APIErrorResponse",
        },
        403: {
            body: "APIErrorResponse",
        },
        404: {
            body: "APIErrorResponse",
        },
    };
}

function getGuildFeedHiddenFlag() {
    const util = requireModule("@spacebar/util") as typeof import("@spacebar/util");
    return Number(util.MessageFlags.FLAGS.GUILD_FEED_HIDDEN);
}

function getMessagePublicWithThreadRelations() {
    const util = requireModule("@spacebar/util") as typeof import("@spacebar/util");
    return util.messagePublicWithThreadRelations;
}

function testMessage(overrides: Partial<Omit<TestMessage, "save" | "toJSON">> = {}): TestMessage {
    const message = {
        id: "222222222222222222",
        channel_id: "111111111111111111",
        author_id: "viewer",
        flags: 0,
        ...overrides,
    } as TestMessage;

    message.save = async () => {};
    message.toJSON = () => ({
        id: message.id,
        channel_id: message.channel_id,
        author_id: message.author_id,
        flags: message.flags,
        nonce: "client-nonce",
    });

    return message;
}

async function requestText(app: express.Express, method: "DELETE" | "POST"): Promise<{ status: number; body: string }> {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}/channels/111111111111111111/messages/222222222222222222/hide-guild-feed`, { method });

        return {
            status: response.status,
            body: await response.text(),
        };
    } finally {
        server.close();
    }
}
