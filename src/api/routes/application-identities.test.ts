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
import { DiscordApiErrors } from "@spacebar/util";
import express from "express";

const requireModule = require;
const routeModulePath = require.resolve("./application-identities");

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("POST /application-identities", () => {
    test("declares authenticated bulk identity metadata", (t) => {
        const harness = setupApplicationIdentitiesRoute(t);

        assert.deepEqual(harness.routeOptions[0], {
            summary: "Get Bulk Application Identities",
            requestBody: "ApplicationIdentitiesSchema",
            coerceRequestBody: false,
            responses: {
                200: {
                    body: "ApplicationIdentitiesResponse",
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

    test("normalizes requested user ids by ignoring invalid ids and duplicates", (t) => {
        const harness = setupApplicationIdentitiesRoute(t);

        assert.deepEqual(harness.routeModule.normalizeApplicationIdentityUserIds(["123", "not-a-snowflake", "123", "456"]), ["123", "456"]);
        assert.equal(harness.routeModule.getOAuthApplicationId({ application: { id: "application-id" } }), "application-id");
    });

    test("requires an OAuth application token claim", async (t) => {
        const harness = setupApplicationIdentitiesRoute(t, {
            token: { scope: "identify" },
        });

        const response = await requestJson(harness.app, "/application-identities", {
            user_ids: ["123"],
        });

        assert.equal(response.status, 400);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.INVALID_OAUTH_TOKEN.code,
            message: DiscordApiErrors.INVALID_OAUTH_TOKEN.message,
        });
    });

    test("returns a conservative empty compatibility response", async (t) => {
        const harness = setupApplicationIdentitiesRoute(t);

        const response = await requestJson(harness.app, "/application-identities", {
            user_ids: ["123", "not-a-snowflake", "456"],
        });

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
    });
});

type SetupOptions = {
    token?: Record<string, unknown>;
};

function setupApplicationIdentitiesRoute(t: TestContext, options: SetupOptions = {}) {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../util/handlers/route");
    const errorHandlerModule = requireModule(distModulePath("api", "middlewares", "ErrorHandler.js")) as typeof import("../middlewares/ErrorHandler");

    const routeOptions: unknown[] = [];

    t.mock.method(routeHandler, "route", (options: unknown) => {
        routeOptions.push(options);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });

    delete require.cache[routeModulePath];
    const routeModule = requireModule(routeModulePath) as typeof import("./application-identities");

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "authorized-user";
        req.token = (options.token ?? { scope: "identify", client_id: "application-id" }) as never;
        next();
    });
    app.use("/application-identities", routeModule.default);
    app.use(errorHandlerModule.ErrorHandler);

    return {
        app,
        routeModule,
        get routeOptions() {
            return routeOptions;
        },
    };
}

async function requestJson(app: express.Express, requestPath: string, body: unknown): Promise<{ status: number; body: unknown }> {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
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
