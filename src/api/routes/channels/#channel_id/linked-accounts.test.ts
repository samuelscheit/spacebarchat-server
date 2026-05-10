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
const routeModulePath = require.resolve("./linked-accounts");

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("GET /channels/:channel_id/linked-accounts", () => {
    test("declares OAuth scoped linked-account response metadata", (t) => {
        const harness = setupLinkedAccountsRoute(t, {});

        assert.deepEqual(harness.linkedAccountsRouteOptions, {
            query: {
                user_ids: {
                    type: "array",
                    description: "User IDs to get linked accounts for",
                },
            },
            responses: {
                200: {
                    body: "ChannelLinkedAccountsResponse",
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

    test("requires the dm_channels.read OAuth scope before channel lookup", async (t) => {
        const harness = setupLinkedAccountsRoute(t, {
            token: { scope: "identify" },
        });

        const response = await requestJson(harness.app, "/channels/group-dm/linked-accounts");

        assert.equal(response.status, 400);
        assert.equal(response.body.code, 50026);
        assert.equal(response.body.message, "Missing required OAuth2 scope");
        assert.equal(harness.channelFindOptions.length, 0);
        assert.equal(harness.connectedAccountFindOptions.length, 0);
    });

    test("rejects non-group-DM channels", async (t) => {
        const harness = setupLinkedAccountsRoute(t, {
            channel: {
                type: 1,
                recipients: [{ user_id: "viewer", closed: false }],
            },
        });

        const response = await requestJson(harness.app, "/channels/dm/linked-accounts");

        assert.equal(response.status, 400);
        assert.equal(response.body.code, 50024);
        assert.equal(response.body.message, "Cannot execute action on this channel type");
        assert.equal(harness.connectedAccountFindOptions.length, 0);
    });

    test("requires the token user to be an active group-DM recipient", async (t) => {
        const harness = setupLinkedAccountsRoute(t, {
            channel: {
                type: 3,
                recipients: [
                    { user_id: "viewer", closed: true },
                    { user_id: "other-user", closed: false },
                ],
            },
        });

        const response = await requestJson(harness.app, "/channels/group-dm/linked-accounts");

        assert.equal(response.status, 403);
        assert.equal(response.body.code, 50013);
        assert.equal(harness.connectedAccountFindOptions.length, 0);
    });

    test("returns visible linked accounts for requested active recipients only", async (t) => {
        const harness = setupLinkedAccountsRoute(t, {
            accounts: [
                { external_id: "external-a", user_id: "user-a", name: "Alice" },
                { external_id: "external-b", user_id: "user-b", name: "Closed" },
                { external_id: "external-viewer", user_id: "viewer", name: "Viewer" },
            ],
            channel: {
                type: 3,
                recipients: [
                    { user_id: "viewer", closed: false },
                    { user_id: "user-a", closed: false },
                    { user_id: "user-b", closed: true },
                    { user_id: "user-c", closed: false },
                ],
            },
        });

        const response = await requestJson(harness.app, "/channels/group-dm/linked-accounts?user_ids=user-a,user-b&user_ids=user-c");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            linked_accounts: {
                "user-a": [{ id: "external-a", name: "Alice" }],
                "user-c": [],
            },
        });
        assert.equal(harness.connectedAccountFindOptions.length, 1);
    });
});

type TestChannel = {
    type: number;
    recipients?: { user_id: string; closed?: boolean }[];
};

type TestAccount = {
    external_id: string;
    user_id: string;
    name: string;
};

type SetupOptions = {
    accounts?: TestAccount[];
    channel?: TestChannel;
    token?: Record<string, unknown>;
    userId?: string;
};

function setupLinkedAccountsRoute(t: TestContext, options: SetupOptions) {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../util/handlers/route");
    const errorHandlerModule = requireModule(distModulePath("api", "middlewares", "ErrorHandler.js")) as typeof import("../../../middlewares/ErrorHandler");
    const util = requireModule("@spacebar/util") as typeof import("@spacebar/util");

    const routeOptions: unknown[] = [];
    const channelFindOptions: unknown[] = [];
    const connectedAccountFindOptions: unknown[] = [];
    const channel = options.channel ?? {
        type: 3,
        recipients: [
            { user_id: "viewer", closed: false },
            { user_id: "user-a", closed: false },
        ],
    };
    const accounts = options.accounts ?? [];

    t.mock.method(routeHandler, "route", (routeOption: unknown) => {
        routeOptions.push(routeOption);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });
    t.mock.method(util.Channel, "findOneOrFail", async (findOptions: unknown) => {
        channelFindOptions.push(findOptions);
        return channel;
    });
    t.mock.method(util.ConnectedAccount, "find", async (findOptions: unknown) => {
        connectedAccountFindOptions.push(findOptions);
        return accounts;
    });

    delete require.cache[routeModulePath];
    const router = (requireModule(routeModulePath) as typeof import("./linked-accounts")).default as express.Router;
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = options.userId ?? "viewer";
        req.token = (options.token ?? { scope: "identify dm_channels.read" }) as never;
        next();
    });
    app.use("/channels/:channel_id/linked-accounts", router);
    app.use(errorHandlerModule.ErrorHandler);

    return {
        app,
        get channelFindOptions() {
            return channelFindOptions;
        },
        get connectedAccountFindOptions() {
            return connectedAccountFindOptions;
        },
        get linkedAccountsRouteOptions() {
            return routeOptions[0];
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
