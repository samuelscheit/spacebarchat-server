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
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { afterEach, describe, test, type TestContext } from "node:test";
import express from "express";
import { ChannelType } from "../../src/schemas";
import announcementsRouter, { canUseGameAnnouncementChannel, parseGameAnnouncementLimit } from "../../src/api/routes/games/#game_id/announcements";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const util = require("@spacebar/util") as typeof import("../../src/util");
const permissionsModule = require(join(process.cwd(), "dist", "util", "util", "Permissions.js")) as typeof import("../../src/util/util/Permissions");

type MutableUtil = typeof util & {
    Application: typeof import("../../src/util").Application;
};

type JsonResponse = {
    status: number;
    body: Record<string, unknown>;
};

const mutableUtil = util as MutableUtil;

afterEach(() => {
    assert.equal(typeof mutableUtil.Application.findOne, "function");
});

describe("GET /games/:game_id/announcements helpers", () => {
    test("parses the documented limit range", () => {
        assert.equal(parseGameAnnouncementLimit(undefined), 50);
        assert.equal(parseGameAnnouncementLimit(""), 50);
        assert.equal(parseGameAnnouncementLimit("1"), 1);
        assert.equal(parseGameAnnouncementLimit("50"), 50);

        for (const value of ["0", "51", "1.5", "abc"]) {
            assert.throws(() => parseGameAnnouncementLimit(value), /limit must be between 1 and 50/);
        }
    });

    test("only uses a linked guild news channel as the game announcement channel", () => {
        const application = { id: "game", guild_id: "guild", announcements_channel_id: "news" };

        assert.equal(canUseGameAnnouncementChannel(application, { id: "news", guild_id: "guild", type: ChannelType.GUILD_NEWS }), true);
        assert.equal(canUseGameAnnouncementChannel(application, { id: "text", guild_id: "guild", type: ChannelType.GUILD_TEXT }), false);
        assert.equal(canUseGameAnnouncementChannel(application, { id: "news", guild_id: "other-guild", type: ChannelType.GUILD_NEWS }), false);
        assert.equal(canUseGameAnnouncementChannel(application, null), false);
    });
});

describe("GET /games/:game_id/announcements route", () => {
    test("returns an empty payload when the game has no announcements channel configured", async (t) => {
        const harness = setupRoute(t, {
            application: { id: "game", guild_id: "guild", announcements_channel_id: null },
        });

        const response = await requestJson(harness.app, "/games/game/announcements");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, { messages: [] });
        assert.equal(harness.channelLookups, 0);
        assert.equal(harness.messageFindOptions.length, 0);
    });

    test("returns channel metadata with no messages when history permission is absent", async (t) => {
        const harness = setupRoute(t, {
            canReadHistory: false,
        });

        const response = await requestJson(harness.app, "/games/game/announcements?limit=25");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            guild_id: "guild",
            channel_id: "news",
            messages: [],
        });
        assert.equal(harness.messageFindOptions.length, 0);
    });

    test("fetches and serializes newest announcement messages with the requested limit", async (t) => {
        const harness = setupRoute(t, {
            messages: [createRouteMessage("message-1", "news", "Patch notes")],
        });

        const response = await requestJson(harness.app, "/games/game/announcements?limit=1");

        assert.equal(response.status, 200);
        assert.equal(response.body.guild_id, "guild");
        assert.equal(response.body.channel_id, "news");
        assert.equal((response.body.messages as { id?: string }[])[0]?.id, "message-1");
        assert.equal((response.body.messages as { content?: string }[])[0]?.content, "Patch notes");
        assert.equal(harness.messageFindOptions[0]?.take, 1);
        assert.deepEqual(harness.messageFindOptions[0]?.where, { channel_id: "news" });
    });

    test("does not expose messages from an invalid configured channel", async (t) => {
        const harness = setupRoute(t, {
            channel: { id: "text", guild_id: "guild", type: ChannelType.GUILD_TEXT },
            messages: [createRouteMessage("message-1", "text", "Hidden")],
        });

        const response = await requestJson(harness.app, "/games/game/announcements");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, { messages: [] });
        assert.equal(harness.permissionChecks.length, 0);
        assert.equal(harness.messageFindOptions.length, 0);
    });

    test("declares the generated response schema shape", () => {
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, { properties?: Record<string, unknown> }>;
        const response = schemas.GameAnnouncementsResponse;

        assert.ok(response);
        assert.ok(response.properties?.guild_id);
        assert.ok(response.properties?.channel_id);
        assert.deepEqual(response.properties?.messages, {
            type: "array",
            items: { $ref: "#/definitions/PublicMessage" },
        });
    });

    test("declares 200 and 401 response metadata and remains bearer-authenticated", () => {
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            paths?: Record<string, { get?: { responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>; security?: unknown } }>;
        };
        const manifest = JSON.parse(readFileSync(join(process.cwd(), "assets", "testing-manifest.json"), "utf8")) as {
            entries?: {
                id?: string;
                authMode?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
            }[];
        };

        const route = openapi.paths?.["/games/{game_id}/announcements/"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/GameAnnouncementsResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === "api:http:GET:/games/:game_id/announcements/");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("GameAnnouncementsResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(200), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(401), true);
    });
});

function setupRoute(
    t: TestContext,
    options: {
        application?: { id: string; guild_id: string | null; announcements_channel_id: string | null };
        channel?: { id: string; guild_id: string | null; type: ChannelType };
        canReadHistory?: boolean;
        messages?: ReturnType<typeof createRouteMessage>[];
    } = {},
) {
    const app = express();
    const messageFindOptions: { take?: number; where?: unknown }[] = [];
    const permissionChecks: string[] = [];
    let channelLookups = 0;

    t.mock.method(
        mutableUtil.Application,
        "findOne",
        async () =>
            options.application ?? {
                id: "game",
                guild_id: "guild",
                announcements_channel_id: "news",
            },
    );
    t.mock.method(mutableUtil.Channel, "findOne", async () => {
        channelLookups += 1;
        return options.channel ?? { id: "news", guild_id: "guild", type: ChannelType.GUILD_NEWS };
    });
    t.mock.method(mutableUtil.Message, "find", async (findOptions: { take?: number; where?: unknown }) => {
        messageFindOptions.push(findOptions);
        return options.messages ?? [];
    });
    t.mock.method(mutableUtil.Message, "fillReplies", async () => undefined);
    t.mock.method(mutableUtil.User, "getPublicUser", async (userId: string) => ({
        id: userId,
        username: "user",
        discriminator: "0000",
        avatar: null,
        public_flags: 0,
    }));
    t.mock.method(permissionsModule, "getPermission", async () => ({
        hasThrow(permission: string) {
            permissionChecks.push(permission);
        },
        has(permission: string) {
            permissionChecks.push(permission);
            return permission === "READ_MESSAGE_HISTORY" ? options.canReadHistory !== false : true;
        },
    }));

    app.use((req, _res, next) => {
        (req as express.Request & { user_id: string }).user_id = "user";
        next();
    });
    app.use("/games/:game_id/announcements", announcementsRouter);
    app.use((error: Error & { httpStatus?: number; status?: number; code?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(error.httpStatus ?? error.status ?? 500).json({
            code: error.code,
            message: error.message,
        });
    });

    return {
        app,
        get channelLookups() {
            return channelLookups;
        },
        get messageFindOptions() {
            return messageFindOptions;
        },
        get permissionChecks() {
            return permissionChecks;
        },
    };
}

function createRouteMessage(id: string, channelId: string, content: string) {
    return {
        reactions: [],
        toJSON() {
            return {
                id,
                channel_id: channelId,
                type: 0,
                content,
                timestamp: "2026-05-10T00:00:00.000Z",
                edited_timestamp: null,
                tts: false,
                mention_everyone: false,
                mentions: [],
                mention_roles: [],
                mention_channels: [],
                attachments: [],
                embeds: [],
                pinned: false,
                author: {
                    id: "author",
                    username: "Author",
                    discriminator: "0000",
                    avatar: null,
                    public_flags: 0,
                },
                flags: 0,
                components: [],
            };
        },
    } as unknown as import("../../src/util").Message;
}

async function requestJson(app: express.Express, path: string): Promise<JsonResponse> {
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.once("listening", () => resolve());
    });

    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${path}`);

        return {
            status: response.status,
            body: (await response.json()) as Record<string, unknown>,
        };
    } finally {
        await close(server);
    }
}

async function close(server: Server) {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}
