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
import { DiscordApiErrors } from "@spacebar/util";
import express from "express";
import { ErrorHandler } from "../../../middlewares/ErrorHandler";
import { isNoAuthorizationRoute } from "../../../middlewares/NoAuthorizationRoutes";
import type { UserScheduledMessagesDependencies } from "./scheduled-messages";

const requireModule = require;
const routeModulePath = require.resolve("./scheduled-messages");
const patchCoveredManifestId = "api:http:PATCH:/users/@me/scheduled-messages/:param";

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("GET /users/@me/scheduled-messages", () => {
    test("declares authenticated user scheduled-messages metadata", (t) => {
        const routeOptions = captureRouteOptions(t);

        assert.deepEqual(routeOptions[0], {
            summary: "Get User Scheduled Messages",
            description:
                "Returns the current user's scheduled messages. Spacebar does not currently persist user scheduled-message state, so the local representation is empty until that backing state exists.",
            responses: {
                200: {
                    body: "ScheduledMessagesResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        });
        assert.deepEqual(routeOptions[1], {
            summary: "Update User Scheduled Message",
            description:
                "Discord exposes this client route for mutating a current user's scheduled message. Spacebar does not currently persist user scheduled-message state, so this compatibility endpoint validates the route identifier and fails closed instead of fabricating or mutating message data.",
            responses: {
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
                501: {
                    body: "APIErrorResponse",
                },
            },
        });
    });

    test("returns the documented empty local representation for authenticated users", async (t) => {
        const harness = setupUserScheduledMessagesRoute(t);

        const response = await requestJson(harness.app, "/users/@me/scheduled-messages");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
        assert.deepEqual(harness.calls, ["viewer"]);
    });

    test("stays on the authenticated route boundary", () => {
        assert.equal(isNoAuthorizationRoute("GET", "/users/@me/scheduled-messages"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/users/@me/scheduled-messages"), false);
        assert.equal(isNoAuthorizationRoute("PATCH", "/users/@me/scheduled-messages/123456789012345678"), false);
        assert.equal(isNoAuthorizationRoute("PATCH", "/api/v9/users/@me/scheduled-messages/123456789012345678"), false);
    });

    test("PATCH validates the scheduled message id and fails closed without mutating unsupported state", async (t) => {
        const routeModule = loadRouteModule();
        const unsupportedError = routeModule.createUserScheduledMessageUpdateUnsupportedError();
        const harness = setupUserScheduledMessagesRoute(t);

        assert.equal(routeModule.parseUserScheduledMessageId("123456789012345678"), "123456789012345678");
        assert.throws(
            () => routeModule.parseUserScheduledMessageId("not-a-snowflake"),
            (error) => {
                assert.equal((error as { code?: unknown }).code, DiscordApiErrors.INVALID_FORM_BODY.code);
                return true;
            },
        );
        assert.equal(unsupportedError.httpStatus, 501);
        assert.equal(unsupportedError.code, 0);
        assert.equal(unsupportedError.message, routeModule.USER_SCHEDULED_MESSAGE_UPDATE_UNSUPPORTED_MESSAGE);

        const invalidResponse = await requestJson(harness.app, "/users/@me/scheduled-messages/not-a-snowflake", { method: "PATCH" });
        assert.equal(invalidResponse.status, 400);
        assert.equal((invalidResponse.body as { code?: unknown }).code, DiscordApiErrors.INVALID_FORM_BODY.code);

        const response = await requestJson(harness.app, "/users/@me/scheduled-messages/123456789012345678", { method: "PATCH" });
        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: 0,
            message: routeModule.USER_SCHEDULED_MESSAGE_UPDATE_UNSUPPORTED_MESSAGE,
        });
        assert.deepEqual(harness.calls, []);
    });

    test("generated artifacts own the source-backed GET and assigned PATCH scheduled-messages routes", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "users", "@me", "scheduled-messages.ts"), "utf8");
        const schemas = readJson<Record<string, { type?: string; items?: unknown }>>(path.join("assets", "schemas.json"));
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    get?: {
                        parameters?: unknown[];
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                    post?: unknown;
                    patch?: {
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
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
                path?: string;
                sourceFile?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                    hasQuery?: boolean;
                };
            }[];
        }>(path.join("assets", "testing-manifest.json"));
        const contractMatrix = readJson<{
            contracts?: {
                manifestId?: string;
                sourceFile?: string;
                routeMetadata?: {
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>(path.join("test", "generated", "http-contracts.json"));
        const suiteCoverage = readJson<{ groups?: { suites?: { testFiles?: string[]; manifestIds?: string[] }[] }[] }>(path.join("test", "generated", "suite-coverage.json"));

        assert.match(routeSource, /router\.get\(\s*["']\/["']/);
        assert.match(routeSource, /router\.patch\(\s*["']\/:param["']/);
        assert.match(routeSource, /body:\s*"ScheduledMessagesResponse"/);
        assert.match(routeSource, /501:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /router\.(post|delete)\(/);

        assert.equal(schemas.ScheduledMessagesResponse?.type, "array");
        assert.deepEqual(schemas.ScheduledMessagesResponse?.items, {});

        const openapiRoute = openapi.paths?.["/users/@me/scheduled-messages/"]?.get;
        assert.equal(openapiRoute?.parameters, undefined);
        assert.equal(openapiRoute?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ScheduledMessagesResponse");
        assert.equal(openapiRoute?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(openapiRoute?.security, [{ bearer: [] }]);
        assert.equal(openapi.paths?.["/users/@me/scheduled-messages/"]?.post, undefined);

        const openapiPatchRoute = openapi.paths?.["/users/@me/scheduled-messages/{param}"]?.patch;
        assert.equal(openapiPatchRoute?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapiPatchRoute?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapiPatchRoute?.responses?.["501"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(openapiPatchRoute?.security, [{ bearer: [] }]);
        assert.equal(openapi.paths?.["/users/@me/scheduled-messages/{param}"]?.delete, undefined);

        const sourceRoute = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/users/@me/scheduled-messages");
        assert.equal(sourceRoute?.route_name, "GET_USERS__ME_SCHEDULED_MESSAGES");
        assert.equal(sourceRoute?.source, "src/api/routes/users/@me/scheduled-messages.ts");
        assert.equal(sourceRoute?.response_schema_refs?.includes("ScheduledMessagesResponse"), true);
        assert.equal(sourceRoute?.response_schema_refs?.includes("APIErrorResponse"), true);
        const patchSourceRoute = sourceCatalog.find((entry) => entry.method === "PATCH" && entry.route === "/users/@me/scheduled-messages/{param}");
        assert.equal(patchSourceRoute?.route_name, "PATCH_USERS__ME_SCHEDULED_MESSAGES_PARAM");
        assert.equal(patchSourceRoute?.source, "src/api/routes/users/@me/scheduled-messages.ts");
        assert.deepEqual(patchSourceRoute?.response_schema_refs, ["APIErrorResponse"]);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/users/@me/scheduled-messages"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === "/users/@me/scheduled-messages"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "PATCH" && entry.route === "/users/@me/scheduled-messages/{param}"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "DELETE" && entry.route === "/users/@me/scheduled-messages/{param}"),
            true,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === "api:http:GET:/users/@me/scheduled-messages/");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/users/@me/scheduled-messages.ts");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("ScheduledMessagesResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [200, 401]);
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, false);
        const patchManifestEntry = manifest.entries?.find((entry) => entry.id === patchCoveredManifestId);
        assert.equal(patchManifestEntry?.authMode, "bearer");
        assert.equal(patchManifestEntry?.path, "/users/@me/scheduled-messages/:param");
        assert.equal(patchManifestEntry?.sourceFile, "src/api/routes/users/@me/scheduled-messages.ts");
        assert.equal(patchManifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(patchManifestEntry?.routeMetadata?.responseStatuses, [400, 401, 501]);
        assert.equal(patchManifestEntry?.routeMetadata?.hasQuery, false);

        assert.equal(
            contractMatrix.contracts?.some((contract) => contract.manifestId === "api:http:GET:/users/@me/scheduled-messages/"),
            true,
        );
        const patchContractEntry = contractMatrix.contracts?.find((contract) => contract.manifestId === patchCoveredManifestId);
        assert.equal(patchContractEntry?.sourceFile, "src/api/routes/users/@me/scheduled-messages.ts");
        assert.equal(patchContractEntry?.routeMetadata?.responses?.includes("APIErrorResponse"), true);
        assert.deepEqual(patchContractEntry?.routeMetadata?.responseStatuses, [400, 401, 501]);
        assert.equal(
            suiteCoverage.groups?.some((group) => group.suites?.some((suite) => suite.manifestIds?.includes("api:http:GET:/users/@me/scheduled-messages/"))),
            true,
        );
        assert.equal(
            suiteCoverage.groups?.some((group) => group.suites?.some((suite) => suite.manifestIds?.includes(patchCoveredManifestId))),
            true,
        );
    });
});

function loadRouteModule(): typeof import("./scheduled-messages") {
    delete require.cache[routeModulePath];
    return requireModule(routeModulePath) as typeof import("./scheduled-messages");
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

function setupUserScheduledMessagesRoute(t: TestContext, options: { userId?: string } = {}) {
    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../util/handlers/route");
    const routeOptions: unknown[] = [];
    const calls: string[] = [];

    t.mock.method(routeHandler, "route", (routeOption: unknown) => {
        routeOptions.push(routeOption);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });

    const dependencies: UserScheduledMessagesDependencies = {
        listUserScheduledMessages: async (userId) => {
            calls.push(userId);
            return [];
        },
    };

    const router = loadRouteModule().createUserScheduledMessagesRouter(dependencies);
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = options.userId ?? "viewer";
        next();
    });
    app.use("/users/@me/scheduled-messages", router);
    app.use(ErrorHandler);

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

async function requestJson(app: express.Express, requestPath: string, options: { method?: string; body?: unknown } = {}): Promise<{ status: number; body: unknown }> {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`, {
            method: options.method,
            headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
            body: options.body === undefined ? undefined : JSON.stringify(options.body),
        });

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
