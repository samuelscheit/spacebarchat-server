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
const routeModulePath = require.resolve("./dev-portal-csat-survey-response");

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("POST /dev-portal-csat-survey-response", () => {
    test("declares authenticated strict request metadata", (t) => {
        const harness = setupDevPortalCsatSurveyResponseRoute(t);

        assert.deepEqual(harness.postRouteOptions, {
            summary: "Submit Developer Portal CSAT Survey",
            description:
                "Submits a customer satisfaction survey response for the developer portal. Spacebar validates and acknowledges the authenticated user's response without fabricating Discord's private CSAT persistence.",
            requestBody: "DevPortalCsatSurveyResponseSchema",
            coerceRequestBody: false,
            responses: {
                204: {},
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
                403: {
                    body: "APIErrorResponse",
                },
            },
        });
    });

    test("validates user ID and CSAT score request bodies without scalar coercion", () => {
        const schemas = requireModule("@spacebar/schemas") as typeof import("@spacebar/schemas");
        const validate = schemas.nonCoercingAjv.getSchema("DevPortalCsatSurveyResponseSchema");
        assert.ok(validate);

        assert.equal(validate({ user_id: "133713371337133713", csat_response: 1 }), true);
        assert.equal(validate({ user_id: "133713371337133713", csat_response: 5 }), true);
        assert.equal(validate({ user_id: "133713371337133713", csat_response: 0 }), false);
        assert.equal(validate({ user_id: "133713371337133713", csat_response: 6 }), false);
        assert.equal(validate({ user_id: "133713371337133713", csat_response: 3.5 }), false);
        assert.equal(validate({ user_id: "133713371337133713", csat_response: "5" }), false);
        assert.equal(validate({ user_id: "not-a-snowflake", csat_response: 5 }), false);
        assert.equal(validate({ csat_response: 5 }), false);
    });

    test("acknowledges a response for the authenticated user", async (t) => {
        const harness = setupDevPortalCsatSurveyResponseRoute(t);

        const response = await requestText(harness.app, "/dev-portal-csat-survey-response", {
            method: "POST",
            body: JSON.stringify({ user_id: "133713371337133713", csat_response: 5 }),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 204);
        assert.equal(response.body, "");
    });

    test("rejects responses submitted for a different user", async (t) => {
        const harness = setupDevPortalCsatSurveyResponseRoute(t);

        const response = await requestText(harness.app, "/dev-portal-csat-survey-response", {
            method: "POST",
            body: JSON.stringify({ user_id: "733173317331733173", csat_response: 5 }),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 403);
        assert.deepEqual(JSON.parse(response.body), {
            code: 50001,
            message: "Missing Access",
        });
    });
});

function setupDevPortalCsatSurveyResponseRoute(t: TestContext) {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../util/handlers/route");
    const errorHandlerModule = requireModule(distModulePath("api", "middlewares", "ErrorHandler.js")) as typeof import("../middlewares/ErrorHandler");

    const routeOptions: unknown[] = [];

    t.mock.method(routeHandler, "route", (routeOption: unknown) => {
        routeOptions.push(routeOption);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });

    delete require.cache[routeModulePath];
    const router = (requireModule(routeModulePath) as typeof import("./dev-portal-csat-survey-response")).default as express.Router;
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "133713371337133713";
        next();
    });
    app.use("/dev-portal-csat-survey-response", router);
    app.use(errorHandlerModule.ErrorHandler);

    return {
        app,
        get postRouteOptions() {
            return routeOptions[0];
        },
    };
}

async function requestText(app: express.Express, requestPath: string, init: RequestInit): Promise<{ status: number; body: string }> {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`, init);

        return {
            status: response.status,
            body: await response.text(),
        };
    } finally {
        server.close();
    }
}
