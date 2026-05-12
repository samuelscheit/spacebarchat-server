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
import type { ApplicationBranchesRepositories } from "./branches";

const requireModule = require;
const routeModulePath = require.resolve("./branches");

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("POST /branches", () => {
    test("declares authenticated branch lookup metadata", (t) => {
        const harness = setupApplicationBranchesLookupRoute(t);

        assert.deepEqual(harness.routeOptions[0], {
            summary: "Get Application Branch Live Build IDs",
            description:
                "Returns branch records for requested application branch IDs. Spacebar does not currently persist application branch build metadata, so the default provider returns no branch records.",
            requestBody: "ApplicationBranchesSchema",
            coerceRequestBody: false,
            responses: {
                200: {
                    body: "ApplicationBranchesResponse",
                },
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        });
        assert.equal(harness.isNoAuthorizationRoute("POST", "/branches"), false);
    });

    test("returns an empty compatibility response without branch persistence", async (t) => {
        const harness = setupApplicationBranchesLookupRoute(t);

        assert.deepEqual(await harness.routeModule.getApplicationBranchesByIds(["100000000000000001"], "authorized-user"), []);

        const response = await requestJson(harness.app, "/branches", {
            branch_ids: ["100000000000000001"],
        });

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
    });

    test("passes unique branch ids and user id to an injected branch repository", async (t) => {
        const branchRepository = {
            findBranchesByIds: t.mock.fn(async (_options: unknown) => [
                {
                    id: "100000000000000002",
                    live_build_id: "100000000000000003",
                    name: "main",
                },
                {
                    id: "999999999999999999",
                    live_build_id: "999999999999999998",
                },
            ]),
        };
        const harness = setupApplicationBranchesLookupRoute(t, {
            branchRepository,
        });

        const response = await requestJson(harness.app, "/branches", {
            branch_ids: ["100000000000000002", "100000000000000002"],
        });

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, [
            {
                id: "100000000000000002",
                live_build_id: "100000000000000003",
                name: "main",
            },
        ]);
        assert.deepEqual(branchRepository.findBranchesByIds.mock.calls[0].arguments[0], {
            branchIds: ["100000000000000002"],
            userId: "authorized-user",
        });
    });
});

function setupApplicationBranchesLookupRoute(t: TestContext, repositories: ApplicationBranchesRepositories = {}) {
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
    const routeModule = requireModule(routeModulePath) as typeof import("./branches");

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "authorized-user";
        next();
    });
    app.use("/branches", routeModule.createApplicationBranchesLookupRouter(repositories));
    app.use(errorHandlerModule.ErrorHandler);

    return {
        app,
        routeModule,
        get routeOptions() {
            return routeOptions;
        },
        isNoAuthorizationRoute: noAuthorizationRoutes.isNoAuthorizationRoute,
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
