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
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { describe, test } from "node:test";
import express from "express";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../src/api/middlewares";
import harvestRouter, {
    USER_HARVEST_CREATE_UNSUPPORTED_MESSAGE,
    createCurrentUserHarvest,
    createUserHarvestCreateUnsupportedError,
    getCurrentUserHarvest,
} from "../../src/api/routes/users/@me/harvest";

const getManifestId = "api:http:GET:/users/@me/harvest/";
const postManifestId = "api:http:POST:/users/@me/harvest/";

describe("GET and POST /users/@me/harvest", () => {
    test("returns 204 when no durable user data harvest request exists", async () => {
        assert.equal(getCurrentUserHarvest("1044657759066525777"), null);

        const response = await requestRoute(createRouteApp(), "/users/@me/harvest");

        assert.equal(response.status, 204);
        assert.equal(response.text, "");
        assert.equal(response.body, undefined);
    });

    test("stays behind bearer authentication for reads and creation", async () => {
        assert.equal(isNoAuthorizationRoute("GET", "/users/@me/harvest"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/users/@me/harvest"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/users/@me/harvest"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v10/users/@me/harvest"), false);

        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "users", "@me", "harvest.ts"), "utf-8");
        assert.match(routeSource, /summary:\s*"Get User Harvest"/);
        assert.match(routeSource, /summary:\s*"Create User Harvest"/);
        assert.match(routeSource, /requestBody:\s*"UserHarvestCreateSchema"/);
        assert.match(routeSource, /204:\s*\{\}/s);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /501:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /router\.head\(/);
        assert.doesNotMatch(routeSource, /router\.options\(/);

        const getResponse = await requestRoute(createRouteApp({ authentication: true }), "/users/@me/harvest");
        const postResponse = await requestRoute(createRouteApp({ authentication: true }), "/users/@me/harvest", {
            method: "POST",
            body: JSON.stringify({ backends: ["Messages"] }),
            headers: { "content-type": "application/json" },
        });

        assert.equal(getResponse.status, 401);
        assert.match((getResponse.body as { message?: string }).message ?? "", /Missing Authorization Header/);
        assert.equal(postResponse.status, 401);
        assert.match((postResponse.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("validates documented creation bodies and fails closed without fabricating export state", async () => {
        const unsupportedError = createUserHarvestCreateUnsupportedError();
        assert.equal(unsupportedError.httpStatus, 501);
        assert.equal(unsupportedError.code, 0);
        assert.equal(unsupportedError.message, USER_HARVEST_CREATE_UNSUPPORTED_MESSAGE);

        assert.throws(
            () => createCurrentUserHarvest("1044657759066525777", { backends: ["Messages"], email: "user@example.com" }),
            (error) =>
                typeof error === "object" &&
                error !== null &&
                "httpStatus" in error &&
                error.httpStatus === 501 &&
                "message" in error &&
                error.message === USER_HARVEST_CREATE_UNSUPPORTED_MESSAGE,
        );

        const unsupportedResponse = await requestRoute(createRouteApp(), "/users/@me/harvest", {
            method: "POST",
            body: JSON.stringify({ backends: ["Accounts", "Messages"], email: "user@example.com" }),
            headers: { "content-type": "application/json" },
        });
        assert.equal(unsupportedResponse.status, 501);
        assert.deepEqual(unsupportedResponse.body, {
            code: 0,
            message: USER_HARVEST_CREATE_UNSUPPORTED_MESSAGE,
        });

        const invalidResponse = await requestRoute(createRouteApp(), "/users/@me/harvest", {
            method: "POST",
            body: JSON.stringify({ backends: "Messages" }),
            headers: { "content-type": "application/json" },
        });
        assert.equal(invalidResponse.status, 400);
        assert.equal((invalidResponse.body as { code?: unknown }).code, 50035);
        assert.equal((invalidResponse.body as { message?: unknown }).message, "Invalid Form Body");
    });

    test("is present in regenerated route artifacts for only GET and POST", () => {
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    get?: {
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                        summary?: string;
                    };
                    post?: {
                        requestBody?: {
                            content?: Record<string, { schema?: { $ref?: string } }>;
                            required?: boolean;
                        };
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                        summary?: string;
                    };
                    head?: unknown;
                    options?: unknown;
                }
            >;
        }>(path.join("assets", "openapi.json"));
        const sourceCatalog = readJson<
            {
                method?: string;
                request_schema_ref?: string;
                response_schema_refs?: string[];
                route?: string;
                route_name?: string;
                source?: string;
            }[]
        >(path.join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<{ missing_entries?: { method?: string; route?: string; route_name?: string }[] }>(path.join("packages", "missing-routes", "missing.json"));
        const manifest = readJson<{
            entries?: {
                authMode?: string;
                id?: string;
                routeMetadata?: {
                    requestBody?: string;
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
                sourceFile?: string;
            }[];
        }>(path.join("assets", "testing-manifest.json"));
        const contracts = readJson<{
            contracts?: {
                authMode?: string;
                manifestId?: string;
                path?: string;
                routeMetadata?: {
                    requestBody?: string;
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>(path.join("test", "generated", "http-contracts.json"));
        const suiteCoverage = readJson<{ groups?: { suites?: { id?: string; manifestIds?: string[] }[] }[] }>(path.join("test", "generated", "suite-coverage.json"));

        const openapiRoute = openapi.paths?.["/users/@me/harvest/"];
        assert.equal(openapiRoute?.get?.summary, "Get User Harvest");
        assert.deepEqual(openapiRoute?.get?.security, [{ bearer: [] }]);
        assert.equal(openapiRoute?.get?.responses?.["204"]?.content, undefined);
        assert.equal(openapiRoute?.get?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapiRoute?.post?.summary, "Create User Harvest");
        assert.deepEqual(openapiRoute?.post?.security, [{ bearer: [] }]);
        assert.equal(openapiRoute?.post?.requestBody?.required, true);
        assert.equal(openapiRoute?.post?.requestBody?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/UserHarvestCreateSchema");
        assert.equal(openapiRoute?.post?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapiRoute?.post?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapiRoute?.post?.responses?.["501"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapiRoute?.head, undefined);
        assert.equal(openapiRoute?.options, undefined);

        assert.deepEqual(
            sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/users/@me/harvest"),
            {
                method: "GET",
                response_schema_refs: ["APIErrorResponse"],
                route: "/users/@me/harvest",
                route_name: "GET_USERS__ME_HARVEST",
                source: "src/api/routes/users/@me/harvest.ts",
            },
        );
        assert.deepEqual(
            sourceCatalog.find((entry) => entry.method === "POST" && entry.route === "/users/@me/harvest"),
            {
                method: "POST",
                request_schema_ref: "UserHarvestCreateSchema",
                response_schema_refs: ["APIErrorResponse"],
                route: "/users/@me/harvest",
                route_name: "POST_USERS__ME_HARVEST",
                source: "src/api/routes/users/@me/harvest.ts",
            },
        );

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/users/@me/harvest"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === "/users/@me/harvest"),
            false,
        );

        const getManifestEntry = manifest.entries?.find((entry) => entry.id === getManifestId);
        assert.equal(getManifestEntry?.authMode, "bearer");
        assert.equal(getManifestEntry?.sourceFile, "src/api/routes/users/@me/harvest.ts");
        assert.deepEqual(getManifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse"]);
        assert.deepEqual(getManifestEntry?.routeMetadata?.responseStatuses, [204, 401]);

        const postManifestEntry = manifest.entries?.find((entry) => entry.id === postManifestId);
        assert.equal(postManifestEntry?.authMode, "bearer");
        assert.equal(postManifestEntry?.sourceFile, "src/api/routes/users/@me/harvest.ts");
        assert.equal(postManifestEntry?.routeMetadata?.requestBody, "UserHarvestCreateSchema");
        assert.deepEqual(postManifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse"]);
        assert.deepEqual(postManifestEntry?.routeMetadata?.responseStatuses, [400, 401, 501]);

        const getContract = contracts.contracts?.find((entry) => entry.manifestId === getManifestId);
        assert.equal(getContract?.authMode, "bearer");
        assert.equal(getContract?.path, "/users/@me/harvest/");
        assert.deepEqual(getContract?.routeMetadata?.responses, ["APIErrorResponse"]);
        assert.deepEqual(getContract?.routeMetadata?.responseStatuses, [204, 401]);

        const postContract = contracts.contracts?.find((entry) => entry.manifestId === postManifestId);
        assert.equal(postContract?.authMode, "bearer");
        assert.equal(postContract?.path, "/users/@me/harvest/");
        assert.equal(postContract?.routeMetadata?.requestBody, "UserHarvestCreateSchema");
        assert.deepEqual(postContract?.routeMetadata?.responses, ["APIErrorResponse"]);
        assert.deepEqual(postContract?.routeMetadata?.responseStatuses, [400, 401, 501]);

        const usersSuite = suiteCoverage.groups?.flatMap((group) => group.suites ?? []).find((suite) => suite.id === "users");
        assert.ok(usersSuite?.manifestIds?.includes(getManifestId));
        assert.ok(usersSuite?.manifestIds?.includes(postManifestId));
    });
});

function createRouteApp(options: { authentication?: boolean } = {}) {
    const app = express();
    app.use(express.json());

    if (options.authentication) {
        app.use(Authentication);
    } else {
        app.use((req, _res, next) => {
            req.user_id = "1044657759066525777";
            next();
        });
    }
    app.use("/users/@me/harvest", harvestRouter);
    app.use(ErrorHandler);

    return app;
}

function readJson<T>(relativePath: string): T {
    return JSON.parse(readFileSync(path.join(process.cwd(), relativePath), "utf-8")) as T;
}

async function requestRoute(app: express.Express, requestPath: string, init: RequestInit = {}): Promise<{ status: number; body: unknown; text: string }> {
    const { server, baseUrl } = await listen(app);
    try {
        const response = await fetch(`${baseUrl}${requestPath}`, init);
        const text = await response.text();

        return {
            status: response.status,
            body: text ? JSON.parse(text) : undefined,
            text,
        };
    } finally {
        await close(server);
    }
}

async function listen(app: express.Express) {
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.once("listening", () => resolve());
    });

    const address = server.address();
    assert(address && typeof address === "object");

    return {
        server,
        baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}`,
    };
}

async function close(server: Server) {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}
