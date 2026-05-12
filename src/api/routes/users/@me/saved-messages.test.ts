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
import { isNoAuthorizationRoute } from "../../../middlewares/NoAuthorizationRoutes";
import type { UserSavedMessagesDependencies } from "./saved-messages";

const requireModule = require;
const routeModulePath = require.resolve("./saved-messages");

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("GET /users/@me/saved-messages", () => {
    test("declares authenticated user saved-messages metadata", (t) => {
        const routeOptions = captureRouteOptions(t);

        assert.deepEqual(routeOptions[0], {
            summary: "Get Saved Messages",
            description:
                "Returns the current user's saved message bookmarks and reminders. Spacebar does not currently persist saved-message state, so the local representation is empty until that backing state exists.",
            responses: {
                200: {
                    body: "SavedMessagesResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        });
    });

    test("returns the documented empty local representation for authenticated users", async (t) => {
        const harness = setupUserSavedMessagesRoute(t);

        const response = await requestJson(harness.app, "/users/@me/saved-messages");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, { results: [] });
        assert.deepEqual(harness.calls, ["viewer"]);
    });

    test("stays on the authenticated route boundary", () => {
        assert.equal(isNoAuthorizationRoute("GET", "/users/@me/saved-messages"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/users/@me/saved-messages"), false);
    });

    test("generated artifacts own only the source-backed GET saved-messages route", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "users", "@me", "saved-messages.ts"), "utf8");
        const schemas = readJson<Record<string, { type?: string; properties?: Record<string, { type?: string; items?: { $ref?: string } }> }>>(path.join("assets", "schemas.json"));
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    get?: {
                        parameters?: unknown[];
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                    put?: unknown;
                    delete?: unknown;
                }
            >;
        }>(path.join("assets", "openapi.json"));
        const sourceCatalog = readJson<
            {
                method?: string;
                route?: string;
                route_name?: string;
                source?: string;
                response_schema_refs?: string[];
            }[]
        >(path.join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<{ missing_entries?: { method?: string; route?: string; route_name?: string }[] }>(path.join("packages", "missing-routes", "missing.json"));
        const manifest = readJson<{
            entries?: {
                id?: string;
                authMode?: string;
                sourceFile?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                    hasQuery?: boolean;
                };
            }[];
        }>(path.join("assets", "testing-manifest.json"));
        const contractMatrix = readJson<{ contracts?: { manifestId?: string }[] }>(path.join("test", "generated", "http-contracts.json"));
        const suiteCoverage = readJson<{ groups?: { suites?: { testFiles?: string[]; manifestIds?: string[] }[] }[] }>(path.join("test", "generated", "suite-coverage.json"));

        assert.match(routeSource, /router\.get\(\s*["']\/["']/);
        assert.match(routeSource, /body:\s*"SavedMessagesResponse"/);
        assert.doesNotMatch(routeSource, /router\.(post|put|patch|delete)\(/);

        assert.equal(schemas.SavedMessagesResponse?.type, "object");
        assert.equal(schemas.SavedMessagesResponse?.properties?.results?.type, "array");
        assert.equal(schemas.SavedMessagesResponse?.properties?.results?.items?.$ref, "#/definitions/SavedMessageResponse");

        const openapiRoute = openapi.paths?.["/users/@me/saved-messages/"]?.get;
        assert.equal(openapiRoute?.parameters, undefined);
        assert.equal(openapiRoute?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/SavedMessagesResponse");
        assert.equal(openapiRoute?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(openapiRoute?.security, [{ bearer: [] }]);
        assert.equal(openapi.paths?.["/users/@me/saved-messages/"]?.put, undefined);
        assert.equal(openapi.paths?.["/users/@me/saved-messages/"]?.delete, undefined);

        const sourceRoute = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/users/@me/saved-messages");
        assert.equal(sourceRoute?.route_name, "GET_USERS__ME_SAVED_MESSAGES");
        assert.equal(sourceRoute?.source, "src/api/routes/users/@me/saved-messages.ts");
        assert.equal(sourceRoute?.response_schema_refs?.includes("SavedMessagesResponse"), true);
        assert.equal(sourceRoute?.response_schema_refs?.includes("APIErrorResponse"), true);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/users/@me/saved-messages"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "PUT" && entry.route === "/users/@me/saved-messages/{param}/{param}"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "DELETE" && entry.route === "/users/@me/saved-messages/{param}/{param}"),
            true,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === "api:http:GET:/users/@me/saved-messages/");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/users/@me/saved-messages.ts");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("SavedMessagesResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [200, 401]);
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, false);

        assert.equal(
            contractMatrix.contracts?.some((contract) => contract.manifestId === "api:http:GET:/users/@me/saved-messages/"),
            true,
        );
        assert.equal(
            suiteCoverage.groups?.some((group) => group.suites?.some((suite) => suite.manifestIds?.includes("api:http:GET:/users/@me/saved-messages/"))),
            true,
        );
    });
});

function loadRouteModule(): typeof import("./saved-messages") {
    delete require.cache[routeModulePath];
    return requireModule(routeModulePath) as typeof import("./saved-messages");
}

function captureRouteOptions(t: TestContext) {
    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../util/handlers/route");
    const routeOptions: unknown[] = [];

    t.mock.method(routeHandler, "route", (routeOption: unknown) => {
        routeOptions.push(routeOption);
        return (_req: unknown, _res: unknown, next: () => void) => next();
    });

    loadRouteModule();

    return routeOptions;
}

function setupUserSavedMessagesRoute(t: TestContext, options: { userId?: string } = {}) {
    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../util/handlers/route");
    const errorHandlerModule = requireModule(distModulePath("api", "middlewares", "ErrorHandler.js")) as typeof import("../../../middlewares/ErrorHandler");
    const routeOptions: unknown[] = [];
    const calls: string[] = [];

    t.mock.method(routeHandler, "route", (routeOption: unknown) => {
        routeOptions.push(routeOption);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });

    const dependencies: UserSavedMessagesDependencies = {
        listUserSavedMessages: async (userId) => {
            calls.push(userId);
            return { results: [] };
        },
    };

    const router = loadRouteModule().createUserSavedMessagesRouter(dependencies);
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = options.userId ?? "viewer";
        next();
    });
    app.use("/users/@me/saved-messages", router);
    app.use(errorHandlerModule.ErrorHandler);

    return {
        app,
        get calls() {
            return calls;
        },
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

function readJson<T>(filePath: string): T {
    return JSON.parse(readFileSync(path.join(process.cwd(), filePath), "utf8")) as T;
}
