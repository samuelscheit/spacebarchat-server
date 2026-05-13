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
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { afterEach, describe, test, type TestContext } from "node:test";
import express from "express";

const requireModule = require;
const routeModulePath = require.resolve("./#classification_id");
const routeDescription =
    "Requests a review for a Safety Hub classification when durable classification and appeal persistence are available. Spacebar does not currently persist Safety Hub classifications or appeals, so this compatibility endpoint validates the authenticated request and fails closed with 501 instead of fabricating an appeal.";

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("PUT /safety-hub/request-review/:classification_id", () => {
    test("declares authenticated request-review metadata", (t) => {
        const harness = setupSafetyHubRequestReviewRoute(t);

        assert.deepEqual(harness.putRouteOptions, {
            requestBody: "SafetyHubRequestReviewSchema",
            coerceRequestBody: false,
            summary: "Request Classification Review",
            description: routeDescription,
            responses: requestReviewResponses(),
        });
    });

    test("validates request and response schemas without scalar coercion", () => {
        const schemas = requireModule("@spacebar/schemas") as typeof import("@spacebar/schemas");
        const validateRequest = schemas.nonCoercingAjv.getSchema("SafetyHubRequestReviewSchema");
        const validateResponse = schemas.nonCoercingAjv.getSchema("SafetyHubRequestReviewResponse");
        assert.ok(validateRequest);
        assert.ok(validateResponse);

        assert.equal(validateRequest(requestReviewBody()), true, JSON.stringify(validateRequest.errors));
        assert.equal(validateRequest(requestReviewBody({ signal: 3, user_input: "" })), true, JSON.stringify(validateRequest.errors));
        assert.equal(validateRequest(requestReviewBody({ signal: 4 })), false);
        assert.equal(validateRequest(requestReviewBody({ signal: 1.5 })), false);
        assert.equal(validateRequest(requestReviewBody({ user_input: "x".repeat(1001) })), false);
        assert.equal(validateRequest(requestReviewBody({ user_input: 123 })), false);
        assert.equal(validateRequest({}), false);

        assert.equal(validateResponse({ appeal_id: "222222222222222222" }), true, JSON.stringify(validateResponse.errors));
        assert.equal(validateResponse({ appeal_id: "not-a-snowflake" }), false);
    });

    test("fails closed for locally unsupported durable Safety Hub appeals", async (t) => {
        const harness = setupSafetyHubRequestReviewRoute(t);

        const response = await requestText(harness.app, "/safety-hub/request-review/111111111111111111", {
            method: "PUT",
            body: JSON.stringify(requestReviewBody()),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 501);
        assert.deepEqual(JSON.parse(response.body), {
            code: 0,
            message: harness.routeModule.SAFETY_HUB_REQUEST_REVIEW_UNSUPPORTED_MESSAGE,
        });
    });

    test("rejects malformed classification IDs before unsupported appeal handling", async (t) => {
        const harness = setupSafetyHubRequestReviewRoute(t);

        const response = await requestText(harness.app, "/safety-hub/request-review/not-a-snowflake", {
            method: "PUT",
            body: JSON.stringify(requestReviewBody()),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 404);
        assert.deepEqual(JSON.parse(response.body), {
            code: 0,
            message: harness.routeModule.UNKNOWN_SAFETY_HUB_CLASSIFICATION_MESSAGE,
        });
    });
});

describe("generated route artifacts for /safety-hub/request-review/{classification_id}", () => {
    test("source catalog, missing report, manifest, and contract matrix include the assigned PUT route", () => {
        const catalogPath = path.join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json");
        const missingPath = path.join(process.cwd(), "packages", "missing-routes", "missing.json");
        const manifestPath = path.join(process.cwd(), "assets", "testing-manifest.json");
        const contractsPath = path.join(process.cwd(), "test", "generated", "http-contracts.json");

        const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as Array<{
            method: string;
            route: string;
            request_schema_ref?: string;
            response_schema_refs?: string[];
            source: string;
        }>;
        const missing = JSON.parse(readFileSync(missingPath, "utf8")) as {
            missing_entries?: Array<{ method: string; route: string; route_name: string }>;
            routes?: string[];
        };
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { entries: Array<{ id: string; sourceFile?: string }> };
        const contracts = JSON.parse(readFileSync(contractsPath, "utf8")) as { contracts: Array<{ manifestId: string; sourceFile?: string }> };

        const sourceRoute = catalog.find((entry) => entry.method === "PUT" && entry.route === "/safety-hub/request-review/{classification_id}");
        assert.equal(sourceRoute?.source, "src/api/routes/safety-hub/request-review/#classification_id.ts");
        assert.equal(sourceRoute?.request_schema_ref, "SafetyHubRequestReviewSchema");
        assert.deepEqual(sourceRoute?.response_schema_refs?.sort(), ["APIErrorResponse", "SafetyHubRequestReviewResponse"]);

        assert.equal(
            missing.missing_entries?.some(
                (entry) => entry.method === "PUT" && entry.route === "/safety-hub/request-review/{param}" && entry.route_name === "PUT_SAFETY_HUB_REQUEST_REVIEW_CLASSIFICATION_ID",
            ),
            false,
        );
        assert.equal(missing.routes?.includes("/safety-hub/request-review/{param}"), false);

        const manifestEntry = manifest.entries.find((entry) => entry.id === "api:http:PUT:/safety-hub/request-review/:classification_id/");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/safety-hub/request-review/#classification_id.ts");

        const contractEntry = contracts.contracts.find((entry) => entry.manifestId === "api:http:PUT:/safety-hub/request-review/:classification_id/");
        assert.equal(contractEntry?.sourceFile, "src/api/routes/safety-hub/request-review/#classification_id.ts");
    });
});

type SetupHarness = {
    app: express.Express;
    putRouteOptions: unknown;
    routeModule: typeof import("./#classification_id");
};

function setupSafetyHubRequestReviewRoute(t: TestContext): SetupHarness {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../util/handlers/route");
    const errorHandlerModule = requireModule(distModulePath("api", "middlewares", "ErrorHandler.js")) as typeof import("../../../middlewares/ErrorHandler");

    const routeOptions: unknown[] = [];
    t.mock.method(routeHandler, "route", (routeOption: unknown) => {
        routeOptions.push(routeOption);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });

    delete require.cache[routeModulePath];
    const routeModule = requireModule(routeModulePath) as typeof import("./#classification_id");
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/safety-hub/request-review/:classification_id", routeModule.default as express.Router);
    app.use(errorHandlerModule.ErrorHandler);

    return {
        app,
        putRouteOptions: routeOptions[0],
        routeModule,
    };
}

function requestReviewResponses() {
    return {
        200: {
            body: "SafetyHubRequestReviewResponse",
        },
        400: {
            body: "APIErrorResponse",
        },
        401: {
            body: "APIErrorResponse",
        },
        404: {
            body: "APIErrorResponse",
        },
        501: {
            body: "APIErrorResponse",
        },
    };
}

function requestReviewBody(overrides: Record<string, unknown> = {}) {
    return {
        signal: 0,
        user_input: "Please review this classification.",
        ...overrides,
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
