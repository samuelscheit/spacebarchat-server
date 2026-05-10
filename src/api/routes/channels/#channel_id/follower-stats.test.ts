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
import { afterEach, describe, test, type TestContext } from "node:test";
import type { AddressInfo } from "node:net";
import path from "node:path";
import express from "express";
import { ChannelType, WebhookType } from "@spacebar/schemas";

const requireModule = require;
const routeModulePath = require.resolve("./follower-stats");

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("GET /channels/:channel_id/follower-stats", () => {
    test("returns follower stats backed by channel follower webhooks", async (t) => {
        const harness = setupFollowerStatsRoute(t);

        const response = await requestJson(harness.app, "/channels/source-channel/follower-stats");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            channels_following: 2,
            guild_members: 42,
            guilds_following: 2,
            users_seen_ever: 0,
            subscribers_gained_since_last_post: 0,
            subscribers_lost_since_last_post: 0,
        });
        assert.deepEqual(harness.channelFindOptions, [
            {
                where: { id: "source-channel" },
                select: {
                    id: true,
                    guild_id: true,
                    type: true,
                },
            },
        ]);
        assert.deepEqual(harness.webhookFindOptions, [
            {
                where: {
                    source_channel_id: "source-channel",
                    type: WebhookType.ChannelFollower,
                },
                select: {
                    channel_id: true,
                    guild_id: true,
                },
            },
        ]);
        assert.equal(harness.memberCountCalls.length, 1);
    });

    test("declares VIEW_CHANNEL metadata and compatibility response schemas", (t) => {
        const harness = setupFollowerStatsRoute(t);

        assert.deepEqual(harness.routeOptions[0], {
            permission: "VIEW_CHANNEL",
            responses: {
                200: {
                    body: "ChannelFollowerStatsResponse",
                },
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
            },
        });
    });
});

function setupFollowerStatsRoute(t: TestContext) {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../util/handlers/route");
    const util = requireModule("@spacebar/util") as typeof import("@spacebar/util");

    const routeOptions: unknown[] = [];
    const channelFindOptions: unknown[] = [];
    const webhookFindOptions: unknown[] = [];
    const memberCountCalls: unknown[] = [];

    t.mock.method(routeHandler, "route", (options: unknown) => {
        routeOptions.push(options);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });
    t.mock.method(util.Channel, "findOneOrFail", async (options: unknown) => {
        channelFindOptions.push(options);

        return {
            id: "source-channel",
            guild_id: "source-guild",
            type: ChannelType.GUILD_NEWS,
        };
    });
    t.mock.method(util.Webhook, "find", async (options: unknown) => {
        webhookFindOptions.push(options);

        return [
            { channel_id: "target-channel-a", guild_id: "target-guild-a" },
            { channel_id: "target-channel-a", guild_id: "target-guild-a" },
            { channel_id: "target-channel-b", guild_id: "target-guild-b" },
        ];
    });
    t.mock.method(util.Member, "count", async (options: unknown) => {
        memberCountCalls.push(options);
        return 42;
    });

    delete require.cache[routeModulePath];
    const router = (requireModule(routeModulePath) as typeof import("./follower-stats")).default as express.Router;
    const app = express();
    app.use("/channels/:channel_id/follower-stats", router);

    return {
        app,
        get routeOptions() {
            return routeOptions;
        },
        get channelFindOptions() {
            return channelFindOptions;
        },
        get webhookFindOptions() {
            return webhookFindOptions;
        },
        get memberCountCalls() {
            return memberCountCalls;
        },
    };
}

async function requestJson(app: express.Express, requestPath: string): Promise<{ status: number; body: Record<string, unknown> }> {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`);

        return {
            status: response.status,
            body: (await response.json()) as Record<string, unknown>,
        };
    } finally {
        server.close();
    }
}
