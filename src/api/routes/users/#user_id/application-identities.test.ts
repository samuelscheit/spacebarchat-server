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
const routeModulePath = require.resolve("./application-identities");

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("GET /users/:user_id/application-identities", () => {
    test("declares authenticated user application identity metadata", (t) => {
        const harness = setupUserApplicationIdentitiesRoute(t);

        assert.deepEqual(harness.routeOptions[0], {
            summary: "Get User Application Identities",
            query: {
                with_profiles: {
                    type: "boolean",
                    description: "Whether to include application profile information",
                },
            },
            responses: {
                200: {
                    body: "UserApplicationIdentitiesResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
                404: {
                    body: "APIErrorResponse",
                },
            },
        });
    });

    test("resolves @me and returns only locally backed identities", async (t) => {
        const harness = setupUserApplicationIdentitiesRoute(t);

        assert.equal(harness.routeModule.resolveApplicationIdentityUserId("@me", "authorized-user"), "authorized-user");
        assert.equal(harness.routeModule.resolveApplicationIdentityUserId("target-user", "authorized-user"), "target-user");

        const response = await harness.routeModule.getUserApplicationIdentitiesResponse("target-user", {
            userRepository: {
                async findOneOrFail(options: unknown) {
                    assert.deepEqual(options, {
                        where: { id: "target-user" },
                        select: { id: true },
                    });
                },
            },
        });

        assert.deepEqual(response, { identities: [] });
    });

    test("validates the target user before returning the conservative empty response", async (t) => {
        let userLookup: unknown;
        const harness = setupUserApplicationIdentitiesRoute(t, {
            onFindUser: async (options) => {
                userLookup = options;
            },
        });

        const response = await requestJson(harness.app, "/users/@me/application-identities?with_profiles=true");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, { identities: [] });
        assert.deepEqual(userLookup, {
            where: { id: "authorized-user" },
            select: { id: true },
        });
    });
});

type SetupOptions = {
    onFindUser?: (options: unknown) => Promise<void>;
};

function setupUserApplicationIdentitiesRoute(t: TestContext, options: SetupOptions = {}) {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../util/handlers/route");
    const errorHandlerModule = requireModule(distModulePath("api", "middlewares", "ErrorHandler.js")) as typeof import("../../../middlewares/ErrorHandler");
    const utilModule = requireModule(distModulePath("util", "index.js")) as typeof import("../../../../util");

    const routeOptions: unknown[] = [];

    t.mock.method(routeHandler, "route", (routeOptionsValue: unknown) => {
        routeOptions.push(routeOptionsValue);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });

    t.mock.method(utilModule.User, "findOneOrFail", async (findOptions: unknown) => {
        await options.onFindUser?.(findOptions);
        return { id: "target-user" };
    });

    delete require.cache[routeModulePath];
    const routeModule = requireModule(routeModulePath) as typeof import("./application-identities");

    const app = express();
    app.use((req, _res, next) => {
        req.user_id = "authorized-user";
        next();
    });
    app.use("/users/:user_id/application-identities", routeModule.default);
    app.use(errorHandlerModule.ErrorHandler);

    return {
        app,
        routeModule,
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
            body: await response.json(),
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}
