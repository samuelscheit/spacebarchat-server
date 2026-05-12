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
import path from "node:path";
import { afterEach, describe, test, type TestContext } from "node:test";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../middlewares";
import { requestJson } from "../../tests/helpers/UserRouteTestHelpers";
import express from "express";

const requireModule = require;
const routeModulePath = require.resolve("./find-friends");
const manifestId = "api:http:POST:/friend-finder/find-friends/";

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("POST /friend-finder/find-friends", () => {
    test("declares authenticated fail-closed friend finder metadata", (t) => {
        const routeOptions = captureRouteOptions(t);

        assert.deepEqual(routeOptions[0], {
            summary: "Find Friends",
            description:
                "Discord's friend finder route uploads contact data and returns provider-backed friend or invite suggestions. Spacebar does not persist contact-sync state or the eligibility model needed to safely create those suggestions, so this compatibility endpoint fails closed instead of fabricating matches or invites.",
            responses: {
                401: {
                    body: "APIErrorResponse",
                },
                501: {
                    body: "APIErrorResponse",
                },
            },
        });
    });

    test("stays behind bearer authentication", async () => {
        const app = express();
        app.use(express.json());
        app.use(Authentication);
        app.use("/friend-finder/find-friends", loadRouteModule().default);
        app.use(ErrorHandler);

        assert.equal(isNoAuthorizationRoute("POST", "/friend-finder/find-friends"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/friend-finder/find-friends"), false);

        const response = await requestJson(app, "/friend-finder/find-friends", {
            method: "POST",
            body: {
                modified_contacts: {
                    contact: [1, "", ""],
                },
                phone_contact_methods_count: 1,
            },
        });

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("fails closed instead of fabricating contact matches or invite suggestions", async () => {
        const routeModule = loadRouteModule();
        const unsupportedError = routeModule.createFriendFinderUnsupportedError();
        const app = express();
        app.use(express.json());
        app.use((req, _res, next) => {
            req.user_id = "100000000000000001";
            next();
        });
        app.use("/friend-finder/find-friends", routeModule.default);
        app.use(ErrorHandler);

        assert.equal(unsupportedError.httpStatus, 501);
        assert.equal(unsupportedError.code, 0);
        assert.equal(unsupportedError.message, routeModule.FRIEND_FINDER_UNSUPPORTED_MESSAGE);

        const response = await requestJson(app, "/friend-finder/find-friends", {
            method: "POST",
            body: {
                modified_contacts: {
                    contact: [1, "", ""],
                },
                phone_contact_methods_count: 1,
            },
        });

        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: 0,
            message: routeModule.FRIEND_FINDER_UNSUPPORTED_MESSAGE,
        });
    });

    test("generated artifacts own only the assigned POST friend finder route", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "friend-finder", "find-friends.ts"), "utf8");
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    post?: {
                        requestBody?: unknown;
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                    get?: unknown;
                    put?: unknown;
                    patch?: unknown;
                    delete?: unknown;
                    options?: unknown;
                }
            >;
        }>(path.join("assets", "openapi.json"));
        const sourceCatalog = readJson<
            {
                method?: string;
                route?: string;
                route_name?: string;
                source?: string;
                request_schema_ref?: string;
                response_schema_refs?: string[];
            }[]
        >(path.join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<{ routes?: string[]; missing_entries?: { method?: string; route?: string; route_name?: string }[] }>(
            path.join("packages", "missing-routes", "missing.json"),
        );
        const manifest = readJson<{
            entries?: {
                id?: string;
                authMode?: string;
                sourceFile?: string;
                routeMetadata?: {
                    requestBody?: string;
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>(path.join("assets", "testing-manifest.json"));
        const contractMatrix = readJson<{
            contracts?: {
                manifestId?: string;
                sourceFile?: string;
                routeMetadata?: {
                    requestBody?: string;
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>(path.join("test", "generated", "http-contracts.json"));

        assert.match(routeSource, /router\.post\(\s*["']\/["']/);
        assert.match(routeSource, /501:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /router\.(get|put|patch|delete|options)\(/);
        assert.doesNotMatch(routeSource, /\bcreateUserInvite\b/);

        const openapiRoute = openapi.paths?.["/friend-finder/find-friends/"]?.post;
        assert.equal(openapiRoute?.requestBody, undefined);
        assert.equal(openapiRoute?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapiRoute?.responses?.["501"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(openapiRoute?.security, [{ bearer: [] }]);
        assert.equal(openapi.paths?.["/friend-finder/find-friends/"]?.get, undefined);
        assert.equal(openapi.paths?.["/friend-finder/find-friends/"]?.put, undefined);
        assert.equal(openapi.paths?.["/friend-finder/find-friends/"]?.patch, undefined);
        assert.equal(openapi.paths?.["/friend-finder/find-friends/"]?.delete, undefined);
        assert.equal(openapi.paths?.["/friend-finder/find-friends/"]?.options, undefined);

        const sourceRoute = sourceCatalog.find((entry) => entry.method === "POST" && entry.route === "/friend-finder/find-friends");
        assert.equal(sourceRoute?.route_name, "POST_FRIEND_FINDER_FIND_FRIENDS");
        assert.equal(sourceRoute?.source, "src/api/routes/friend-finder/find-friends.ts");
        assert.equal(sourceRoute?.request_schema_ref, undefined);
        assert.deepEqual(sourceRoute?.response_schema_refs, ["APIErrorResponse"]);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === "/friend-finder/find-friends"),
            false,
        );
        assert.equal(missingRoutes.routes?.includes("/friend-finder/find-friends"), false);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === manifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/friend-finder/find-friends.ts");
        assert.equal(manifestEntry?.routeMetadata?.requestBody, undefined);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [401, 501]);

        const contractEntry = contractMatrix.contracts?.find((contract) => contract.manifestId === manifestId);
        assert.equal(contractEntry?.sourceFile, "src/api/routes/friend-finder/find-friends.ts");
        assert.equal(contractEntry?.routeMetadata?.requestBody, undefined);
        assert.deepEqual(contractEntry?.routeMetadata?.responses, ["APIErrorResponse"]);
        assert.deepEqual(contractEntry?.routeMetadata?.responseStatuses, [401, 501]);
    });
});

function loadRouteModule(): typeof import("./find-friends") {
    delete require.cache[routeModulePath];
    return requireModule(routeModulePath) as typeof import("./find-friends");
}

function captureRouteOptions(t: TestContext) {
    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../util/handlers/route");
    const routeOptions: unknown[] = [];

    t.mock.method(routeHandler, "route", (routeOption: unknown) => {
        routeOptions.push(routeOption);
        return (_req: unknown, _res: unknown, next: () => void) => next();
    });

    loadRouteModule();

    return routeOptions;
}

function readJson<T>(file: string): T {
    return JSON.parse(readFileSync(file, "utf8")) as T;
}
