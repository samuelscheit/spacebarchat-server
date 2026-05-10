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
const routeModulePath = require.resolve("./friend-suggestions");

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("GET /friend-suggestions", () => {
    test("declares authenticated friend suggestion response metadata", (t) => {
        const harness = setupFriendSuggestionsRoute(t);

        assert.deepEqual(harness.routeOptions[0], {
            summary: "Get Friend Suggestions",
            responses: {
                200: {
                    body: "FriendSuggestionsResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        });
        assert.equal(harness.isNoAuthorizationRoute("GET", "/friend-suggestions"), false);
    });

    test("returns a conservative empty response until friend suggestion persistence exists", async (t) => {
        const harness = setupFriendSuggestionsRoute(t);

        assert.deepEqual(harness.routeModule.buildFriendSuggestionsResponse("user-id"), []);

        const response = await requestJson(harness.app, "/friend-suggestions");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
    });
});

function setupFriendSuggestionsRoute(t: TestContext) {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../util/handlers/route");
    const errorHandlerModule = requireModule(distModulePath("api", "middlewares", "ErrorHandler.js")) as typeof import("../middlewares/ErrorHandler");
    const noAuthorizationRoutes = requireModule(distModulePath("api", "middlewares", "NoAuthorizationRoutes.js")) as typeof import("../middlewares/NoAuthorizationRoutes");

    const routeOptions: unknown[] = [];

    t.mock.method(routeHandler, "route", (options: unknown) => {
        routeOptions.push(options);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });

    delete require.cache[routeModulePath];
    const routeModule = requireModule(routeModulePath) as typeof import("./friend-suggestions");

    const app = express();
    app.use((req, _res, next) => {
        req.user_id = "authorized-user";
        next();
    });
    app.use("/friend-suggestions", routeModule.default);
    app.use(errorHandlerModule.ErrorHandler);

    return {
        app,
        routeModule,
        isNoAuthorizationRoute: noAuthorizationRoutes.isNoAuthorizationRoute,
        get routeOptions() {
            return routeOptions;
        },
    };
}

async function requestJson(app: express.Express, requestPath: string): Promise<{ status: number; body: unknown }> {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`, {
            method: "GET",
        });

        return {
            status: response.status,
            body: await response.json(),
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}
