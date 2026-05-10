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

describe("DELETE /friend-suggestions/:user_id", () => {
    test("declares authenticated friend suggestion removal metadata", (t) => {
        const harness = setupFriendSuggestionsRoute(t);

        assert.deepEqual(harness.routeOptions[1], {
            summary: "Remove Friend Suggestion",
            responses: {
                204: {},
                401: {
                    body: "APIErrorResponse",
                },
            },
        });
        assert.equal(harness.isNoAuthorizationRoute("DELETE", "/friend-suggestions/852892297661906993"), false);
    });

    test("acknowledges deletion and emits the documented client invalidation", async (t) => {
        const harness = setupFriendSuggestionsRoute(t);

        await harness.routeModule.deleteFriendSuggestion("authorized-user", "852892297661906993", (event) => {
            harness.emittedEvents.push(event);
        });

        assert.deepEqual(harness.emittedEvents.pop(), {
            event: "FRIEND_SUGGESTION_DELETE",
            user_id: "authorized-user",
            data: {
                suggested_user_id: "852892297661906993",
            },
        });

        const response = await requestRoute(harness.app, "/friend-suggestions/852892297661906993", "DELETE");

        assert.equal(response.status, 204);
        assert.equal(response.text, "");
        assert.deepEqual(harness.emittedEvents, [
            {
                event: "FRIEND_SUGGESTION_DELETE",
                user_id: "authorized-user",
                data: {
                    suggested_user_id: "852892297661906993",
                },
            },
        ]);
    });
});

function setupFriendSuggestionsRoute(t: TestContext) {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../util/handlers/route");
    const errorHandlerModule = requireModule(distModulePath("api", "middlewares", "ErrorHandler.js")) as typeof import("../middlewares/ErrorHandler");
    const noAuthorizationRoutes = requireModule(distModulePath("api", "middlewares", "NoAuthorizationRoutes.js")) as typeof import("../middlewares/NoAuthorizationRoutes");
    const eventModule = requireModule(distModulePath("util", "util", "Event.js")) as typeof import("../../util/util/Event");

    const routeOptions: unknown[] = [];
    const emittedEvents: unknown[] = [];

    t.mock.method(routeHandler, "route", (options: unknown) => {
        routeOptions.push(options);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });
    t.mock.method(eventModule, "emitEvent", async (event: unknown) => {
        emittedEvents.push(event);
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
        emittedEvents,
        isNoAuthorizationRoute: noAuthorizationRoutes.isNoAuthorizationRoute,
        get routeOptions() {
            return routeOptions;
        },
    };
}

async function requestJson(app: express.Express, requestPath: string): Promise<{ status: number; body: unknown }> {
    const response = await requestRoute(app, requestPath, "GET");

    return {
        status: response.status,
        body: response.text ? JSON.parse(response.text) : undefined,
    };
}

async function requestRoute(app: express.Express, requestPath: string, method: "DELETE" | "GET"): Promise<{ status: number; text: string }> {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`, {
            method,
        });

        return {
            status: response.status,
            text: await response.text(),
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}
