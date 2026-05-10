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
import express, { type NextFunction, type Request, type Response } from "express";
import { ErrorHandler } from "../../../middlewares";

const requireModule = require;
const routeModulePath = require.resolve("./devices");

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("GET /consoles/:connection_type/devices", () => {
    test("returns an empty console devices compatibility response for supported PlayStation connection types", async (t) => {
        const harness = setupConsoleDevicesRoute(t);

        for (const connectionType of ["playstation", "playstation-stg"]) {
            const response = await requestJson(harness.app, `/consoles/${connectionType}/devices`);

            assert.equal(response.status, 200);
            assert.deepEqual(response.body, { devices: [] });
        }
    });

    test("rejects unsupported connection types with the supported PlayStation choices", async (t) => {
        const harness = setupConsoleDevicesRoute(t);

        const response = await requestJson(harness.app, "/consoles/xbox/devices");

        assert.equal(response.status, 400);
        assert.deepEqual(response.body, {
            code: 50035,
            message: "Invalid Form Body",
            errors: {
                connection_type: {
                    _errors: [
                        {
                            code: "BASE_TYPE_CHOICES",
                            message: "Must be one of playstation, playstation-stg",
                        },
                    ],
                },
            },
        });
    });

    test("declares response schemas for the authenticated console devices route", (t) => {
        const harness = setupConsoleDevicesRoute(t);

        assert.deepEqual(harness.routeOptions[0], {
            summary: "Get Console Devices",
            responses: {
                200: {
                    body: "ConsoleDevicesResponse",
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
});

function setupConsoleDevicesRoute(t: TestContext) {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../util/handlers/route");

    const routeOptions: unknown[] = [];

    t.mock.method(routeHandler, "route", (options: unknown) => {
        routeOptions.push(options);
        return (_req: Request, _res: Response, next: NextFunction) => next();
    });

    delete require.cache[routeModulePath];
    const router = (requireModule(routeModulePath) as typeof import("./devices")).default as express.Router;
    const app = express();
    app.use((req: Request, _res: Response, next: NextFunction) => {
        req.user_id = "user-id";
        req.t = ((_key: string, options?: { types?: string }) => `Must be one of ${options?.types ?? ""}`) as Request["t"];
        next();
    });
    app.use("/consoles/:connection_type/devices", router);
    app.use(ErrorHandler);

    return {
        app,
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
