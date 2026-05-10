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
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { afterEach, describe, test, type TestContext } from "node:test";
import express, { type NextFunction, type Request, type Response } from "express";

const requireModule = require;
const routeModulePath = require.resolve("./checkpoint");

afterEach(() => {
    delete require.cache[routeModulePath];
});

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

function createProvider() {
    const ranges: { messages?: unknown; guilds?: unknown } = {};

    return {
        ranges,
        provider: {
            now: () => new Date("2026-05-10T12:34:56.000Z"),
            countMessagesSent: async (_userId: string, range: unknown) => {
                ranges.messages = range;
                return 42;
            },
            countGuildsJoined: async (_userId: string, range: unknown) => {
                ranges.guilds = range;
                return 3;
            },
        },
    };
}

function setupRouteMetadataHarness(t: TestContext) {
    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../util/handlers/route");
    const routeOptions: unknown[] = [];

    t.mock.method(routeHandler, "route", (options: unknown) => {
        routeOptions.push(options);
        return (_req: Request, _res: Response, next: NextFunction) => next();
    });

    delete require.cache[routeModulePath];
    requireModule(routeModulePath);

    return routeOptions;
}

function createApp(router: express.Router) {
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = "user-123";
        next();
    });
    app.use("/checkpoint", router);

    return app;
}

async function requestJson(app: express.Express, requestPath: string) {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address() as AddressInfo;

    try {
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`);
        return {
            status: response.status,
            body: (await response.json()) as unknown,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

describe("GET /checkpoint", () => {
    test("declares authenticated checkpoint response metadata", (t) => {
        assert.deepEqual(setupRouteMetadataHarness(t), [
            {
                summary: "Get Checkpoint",
                responses: {
                    200: {
                        body: "CheckpointResponse",
                    },
                    401: {
                        body: "APIErrorResponse",
                    },
                },
            },
        ]);
    });

    test("builds a current-year checkpoint from backed Spacebar statistics", async () => {
        const { provider, ranges } = createProvider();
        const routeModule = requireModule(routeModulePath) as typeof import("./checkpoint");
        const response = await routeModule.buildCheckpointResponse("user-123", provider);

        assert.deepEqual(response, {
            avatar_decoration: null,
            messages: {
                num_messages_sent: 42,
                num_messages_sent_percentile: null,
                top_month: null,
            },
            guilds: {
                num_guilds_joined: 3,
                guilds: [],
            },
            users: [],
        });
        assert.deepEqual(ranges.messages, {
            start: new Date("2026-01-01T00:00:00.000Z"),
            end: new Date("2026-05-10T12:34:56.000Z"),
        });
        assert.deepEqual(ranges.guilds, ranges.messages);
    });

    test("returns the checkpoint JSON payload for the authenticated user", async () => {
        const { provider } = createProvider();
        const routeModule = requireModule(routeModulePath) as typeof import("./checkpoint");
        const response = await requestJson(createApp(routeModule.createCheckpointRouter(provider)), "/checkpoint");

        assert.deepEqual(response, {
            status: 200,
            body: {
                avatar_decoration: null,
                messages: {
                    num_messages_sent: 42,
                    num_messages_sent_percentile: null,
                    top_month: null,
                },
                guilds: {
                    num_guilds_joined: 3,
                    guilds: [],
                },
                users: [],
            },
        });
    });
});
