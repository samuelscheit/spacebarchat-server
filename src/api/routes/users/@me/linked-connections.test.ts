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
const routeModulePath = require.resolve("./linked-connections");

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("GET /users/@me/linked-connections", () => {
    test("parses OAuth connection scopes and application claims", () => {
        const routeModule = requireModule(routeModulePath) as typeof import("./linked-connections");

        assert.deepEqual(routeModule.getOAuthLinkedConnectionScopes({ scope: "identify connections", scopes: ["email", "connections"], scp: "guilds,identify" }), [
            "identify",
            "connections",
            "email",
            "guilds",
        ]);
        assert.equal(routeModule.getOAuthLinkedConnectionsApplicationId({ client_id: "app-client" }), "app-client");
        assert.equal(routeModule.getOAuthLinkedConnectionsApplicationId({ application: { id: "nested-app" } }), "nested-app");
    });

    test("declares OAuth linked-connection response metadata", (t) => {
        const harness = setupLinkedConnectionsRoute(t, {});

        assert.deepEqual(harness.linkedConnectionsRouteOptions, {
            summary: "Get User Linked Connections",
            responses: {
                200: {
                    body: "LinkedConnectionsResponse",
                },
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        });
    });

    test("requires an OAuth2 token with the connections scope", async (t) => {
        const harness = setupLinkedConnectionsRoute(t, {
            token: { scope: "identify", client_id: "application-id" },
        });

        const response = await requestJson(harness.app, "/users/@me/linked-connections");
        const body = response.body as Record<string, unknown>;

        assert.equal(response.status, 400);
        assert.equal(body.code, 50026);
        assert.equal(body.message, "Missing required OAuth2 scope");
    });

    test("requires an application claim after validating the scope", async (t) => {
        const harness = setupLinkedConnectionsRoute(t, {
            token: { scope: "identify connections" },
        });

        const response = await requestJson(harness.app, "/users/@me/linked-connections");
        const body = response.body as Record<string, unknown>;

        assert.equal(response.status, 400);
        assert.equal(body.code, 50025);
        assert.equal(body.message, "Invalid OAuth2 access token provided");
    });

    test("fails closed when Spacebar lacks application-scoped linked connection grants", async (t) => {
        const harness = setupLinkedConnectionsRoute(t, {
            token: { scope: "identify connections", client_id: "application-id" },
        });

        const response = await requestJson(harness.app, "/users/@me/linked-connections");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
    });
});

type SetupOptions = {
    token?: Record<string, unknown>;
    userId?: string;
};

function setupLinkedConnectionsRoute(t: TestContext, options: SetupOptions) {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../util/handlers/route");
    const errorHandlerModule = requireModule(distModulePath("api", "middlewares", "ErrorHandler.js")) as typeof import("../../../middlewares/ErrorHandler");

    const routeOptions: unknown[] = [];

    t.mock.method(routeHandler, "route", (routeOption: unknown) => {
        routeOptions.push(routeOption);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });

    delete require.cache[routeModulePath];
    const router = (requireModule(routeModulePath) as typeof import("./linked-connections")).default as express.Router;
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = options.userId ?? "viewer";
        req.token = (options.token ?? { scope: "identify connections", client_id: "application-id" }) as never;
        next();
    });
    app.use("/users/@me/linked-connections", router);
    app.use(errorHandlerModule.ErrorHandler);

    return {
        app,
        get linkedConnectionsRouteOptions() {
            return routeOptions[0];
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
