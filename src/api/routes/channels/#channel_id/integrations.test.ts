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
import { ChannelType } from "@spacebar/schemas";

const requireModule = require;
const routeModulePath = require.resolve("./integrations");

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("GET /channels/:channel_id/integrations", () => {
    test("declares authenticated private-channel integration response metadata", (t) => {
        const harness = setupChannelIntegrationsRoute(t, {});

        assert.deepEqual(harness.routeOptions[0], {
            summary: "Get Channel Integrations",
            description: "Returns a list of integration objects for the private channel.",
            responses: {
                200: {
                    body: "APIIntegrationArray",
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

    test("rejects invalid channel IDs before database lookup", async (t) => {
        const harness = setupChannelIntegrationsRoute(t, {});

        const response = await requestJson(harness.app, "/channels/not-a-snowflake/integrations");

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: 10003,
            message: "Unknown channel",
        });
        assert.equal(harness.channelFindOptions.length, 0);
    });

    test("maps missing channels to Discord's unknown-channel error", async (t) => {
        const harness = setupChannelIntegrationsRoute(t, { channel: null });

        const response = await requestJson(harness.app, "/channels/133713371337133713/integrations");

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: 10003,
            message: "Unknown channel",
        });
        assert.deepEqual(harness.channelFindOptions, [
            {
                where: { id: "133713371337133713" },
                relations: { recipients: true },
            },
        ]);
    });

    test("rejects non-private channel types", async (t) => {
        const harness = setupChannelIntegrationsRoute(t, {
            channel: {
                type: ChannelType.GUILD_TEXT,
                recipients: [{ user_id: "viewer", closed: false }],
            },
        });

        const response = await requestJson(harness.app, "/channels/133713371337133713/integrations");

        assert.equal(response.status, 400);
        assert.deepEqual(response.body, {
            code: 50024,
            message: "Cannot execute action on this channel type",
        });
    });

    test("requires the token user to be an active private-channel recipient", async (t) => {
        const harness = setupChannelIntegrationsRoute(t, {
            channel: {
                type: ChannelType.GROUP_DM,
                recipients: [
                    { user_id: "viewer", closed: true },
                    { user_id: "other-user", closed: false },
                ],
            },
        });

        const response = await requestJson(harness.app, "/channels/133713371337133713/integrations");

        assert.equal(response.status, 403);
        assert.equal((response.body as { code?: unknown }).code, 50013);
    });

    test("returns an empty integration list for accessible private channels", async (t) => {
        const harness = setupChannelIntegrationsRoute(t, {
            channel: {
                type: ChannelType.DM,
                recipients: [
                    { user_id: "viewer", closed: false },
                    { user_id: "other-user", closed: true },
                ],
            },
        });

        const response = await requestJson(harness.app, "/channels/133713371337133713/integrations");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
    });
});

type TestChannel = {
    type: ChannelType;
    recipients?: { user_id: string; closed?: boolean }[];
};

type SetupOptions = {
    channel?: TestChannel | null;
    userId?: string;
};

function setupChannelIntegrationsRoute(t: TestContext, options: SetupOptions) {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../util/handlers/route");
    const errorHandlerModule = requireModule(distModulePath("api", "middlewares", "ErrorHandler.js")) as typeof import("../../../middlewares/ErrorHandler");
    const util = requireModule("@spacebar/util") as typeof import("@spacebar/util");

    const routeOptions: unknown[] = [];
    const channelFindOptions: unknown[] = [];
    const channel =
        options.channel === undefined
            ? {
                  type: ChannelType.DM,
                  recipients: [
                      { user_id: "viewer", closed: false },
                      { user_id: "other-user", closed: true },
                  ],
              }
            : options.channel;

    t.mock.method(routeHandler, "route", (routeOption: unknown) => {
        routeOptions.push(routeOption);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });
    t.mock.method(util.Channel, "findOne", async (findOptions: unknown) => {
        channelFindOptions.push(findOptions);
        return channel;
    });

    delete require.cache[routeModulePath];
    const router = (requireModule(routeModulePath) as typeof import("./integrations")).default as express.Router;
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = options.userId ?? "viewer";
        next();
    });
    app.use("/channels/:channel_id/integrations", router);
    app.use(errorHandlerModule.ErrorHandler);

    return {
        app,
        get channelFindOptions() {
            return channelFindOptions;
        },
        get routeOptions() {
            return routeOptions;
        },
    };
}

async function requestJson(app: express.Express, requestPath: string): Promise<{ status: number; body: unknown }> {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`);

        return {
            status: response.status,
            body: (await response.json()) as unknown,
        };
    } finally {
        server.close();
    }
}
