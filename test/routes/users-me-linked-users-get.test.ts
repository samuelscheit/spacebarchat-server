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
import { DiscordApiErrors } from "@spacebar/util";
import express from "express";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../src/api/middlewares";
import linkedUsersRouter, { buildFamilyCenterLinkedUsersResponse, getFamilyCenterLinkedUserDeletionUnavailableError } from "../../src/api/routes/users/@me/linked-users";

const getManifestId = "api:http:GET:/users/@me/linked-users/";
const deleteManifestId = "api:http:DELETE:/users/@me/linked-users/";

type JsonSchema = {
    $ref?: string;
    type?: string;
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
    required?: string[];
};

describe("GET /users/@me/linked-users", () => {
    test("returns the conservative empty Family Center linked-users payload", async () => {
        assert.deepEqual(buildFamilyCenterLinkedUsersResponse("1044657759066525777"), {
            linked_users: [],
            users: [],
        });

        const response = await requestJson(createRouteApp(), "/users/@me/linked-users");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            linked_users: [],
            users: [],
        });
    });

    test("stays behind bearer authentication and leaves POST/PATCH linked-user mutations unimplemented", async () => {
        assert.equal(isNoAuthorizationRoute("GET", "/users/@me/linked-users"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/users/@me/linked-users"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/users/@me/linked-users"), false);
        assert.equal(isNoAuthorizationRoute("PATCH", "/users/@me/linked-users"), false);
        assert.equal(isNoAuthorizationRoute("DELETE", "/users/@me/linked-users"), false);

        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "users", "@me", "linked-users.ts"), "utf-8");
        assert.match(routeSource, /summary:\s*"Get Linked Users"/);
        assert.match(routeSource, /body:\s*"FamilyCenterLinkedUsersResponse"/);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /router\.post\(/);
        assert.doesNotMatch(routeSource, /router\.patch\(/);
        assert.match(routeSource, /router\.delete\(/);
        assert.match(routeSource, /summary:\s*"Delete Linked Users"/);

        const response = await requestJson(createRouteApp({ authentication: true }), "/users/@me/linked-users");
        const deleteResponse = await requestJson(createRouteApp({ authentication: true }), "/users/@me/linked-users", { method: "DELETE" });

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
        assert.equal(deleteResponse.status, 401);
        assert.match((deleteResponse.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("fails closed for deletion while durable Family Center links are unsupported", async () => {
        assert.equal(getFamilyCenterLinkedUserDeletionUnavailableError(), DiscordApiErrors.FEATURE_TEMPORARILY_DISABLED);

        const response = await requestJson(createRouteApp(), "/users/@me/linked-users", { method: "DELETE" });

        assert.equal(response.status, DiscordApiErrors.FEATURE_TEMPORARILY_DISABLED.httpStatus);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.FEATURE_TEMPORARILY_DISABLED.code,
            message: DiscordApiErrors.FEATURE_TEMPORARILY_DISABLED.message,
        });
    });

    test("is present in regenerated schemas, route artifacts, contracts, and suite coverage", () => {
        const schemas = readJson<Record<string, JsonSchema>>(path.join("assets", "schemas.json"));
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    get?: {
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                    delete?: {
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                    post?: unknown;
                    patch?: unknown;
                }
            >;
        }>(path.join("assets", "openapi.json"));
        const sourceCatalog = readJson<
            {
                method?: string;
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
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>(path.join("test", "generated", "http-contracts.json"));
        const suiteCoverage = readJson<{ groups?: { suites?: { id?: string; manifestIds?: string[]; testFiles?: string[] }[] }[] }>(
            path.join("test", "generated", "suite-coverage.json"),
        );

        assert.deepEqual(schemas.FamilyCenterLinkedUsersResponse?.required?.sort(), ["linked_users", "users"]);
        assert.equal(schemas.FamilyCenterLinkedUsersResponse?.properties?.linked_users?.type, "array");
        assert.equal(schemas.FamilyCenterLinkedUsersResponse?.properties?.linked_users?.items?.$ref, "#/definitions/FamilyCenterLinkedUser");
        assert.equal(schemas.FamilyCenterLinkedUsersResponse?.properties?.users?.type, "array");
        assert.equal(schemas.FamilyCenterLinkedUsersResponse?.properties?.users?.items?.$ref, "#/definitions/PartialUser");

        const openapiRoute = openapi.paths?.["/users/@me/linked-users/"];
        assert.deepEqual(openapiRoute?.get?.security, [{ bearer: [] }]);
        assert.equal(openapiRoute?.get?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/FamilyCenterLinkedUsersResponse");
        assert.equal(openapiRoute?.get?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(openapiRoute?.delete?.security, [{ bearer: [] }]);
        assert.equal(openapiRoute?.delete?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapiRoute?.delete?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapiRoute?.post, undefined);
        assert.equal(openapiRoute?.patch, undefined);

        assert.deepEqual(
            sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/users/@me/linked-users"),
            {
                method: "GET",
                response_schema_refs: ["APIErrorResponse", "FamilyCenterLinkedUsersResponse"],
                route: "/users/@me/linked-users",
                route_name: "GET_USERS__ME_LINKED_USERS",
                source: "src/api/routes/users/@me/linked-users.ts",
            },
        );
        assert.deepEqual(
            sourceCatalog.find((entry) => entry.method === "DELETE" && entry.route === "/users/@me/linked-users"),
            {
                method: "DELETE",
                response_schema_refs: ["APIErrorResponse"],
                route: "/users/@me/linked-users",
                route_name: "DELETE_USERS__ME_LINKED_USERS",
                source: "src/api/routes/users/@me/linked-users.ts",
            },
        );

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/users/@me/linked-users"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === "/users/@me/linked-users"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "PATCH" && entry.route === "/users/@me/linked-users"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "DELETE" && entry.route === "/users/@me/linked-users"),
            false,
        );

        const getManifestEntry = manifest.entries?.find((entry) => entry.id === getManifestId);
        assert.equal(getManifestEntry?.authMode, "bearer");
        assert.equal(getManifestEntry?.sourceFile, "src/api/routes/users/@me/linked-users.ts");
        assert.deepEqual(getManifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "FamilyCenterLinkedUsersResponse"]);
        assert.deepEqual(
            getManifestEntry?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [200, 401],
        );

        const deleteManifestEntry = manifest.entries?.find((entry) => entry.id === deleteManifestId);
        assert.equal(deleteManifestEntry?.authMode, "bearer");
        assert.equal(deleteManifestEntry?.sourceFile, "src/api/routes/users/@me/linked-users.ts");
        assert.deepEqual(deleteManifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse"]);
        assert.deepEqual(
            deleteManifestEntry?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [400, 401],
        );

        const getContract = contracts.contracts?.find((entry) => entry.manifestId === getManifestId);
        assert.equal(getContract?.authMode, "bearer");
        assert.equal(getContract?.path, "/users/@me/linked-users/");
        assert.deepEqual(getContract?.routeMetadata?.responses?.sort(), ["APIErrorResponse", "FamilyCenterLinkedUsersResponse"]);
        assert.deepEqual(
            getContract?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [200, 401],
        );

        const deleteContract = contracts.contracts?.find((entry) => entry.manifestId === deleteManifestId);
        assert.equal(deleteContract?.authMode, "bearer");
        assert.equal(deleteContract?.path, "/users/@me/linked-users/");
        assert.deepEqual(deleteContract?.routeMetadata?.responses?.sort(), ["APIErrorResponse"]);
        assert.deepEqual(
            deleteContract?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [400, 401],
        );

        const usersSuite = suiteCoverage.groups?.flatMap((group) => group.suites ?? []).find((suite) => suite.id === "users");
        assert.ok(usersSuite?.manifestIds?.includes(getManifestId));
        assert.ok(usersSuite?.manifestIds?.includes(deleteManifestId));
        assert.ok(usersSuite?.testFiles?.includes("test/scenarios/users-profile-settings.test.ts"));
    });
});

function createRouteApp(options: { authentication?: boolean } = {}) {
    const app = express();

    if (options.authentication) {
        app.use(Authentication);
    } else {
        app.use((req, _res, next) => {
            req.user_id = "1044657759066525777";
            next();
        });
    }
    app.use("/users/@me/linked-users", linkedUsersRouter);
    app.use(ErrorHandler);

    return app;
}

function readJson<T>(relativePath: string): T {
    return JSON.parse(readFileSync(path.join(process.cwd(), relativePath), "utf-8")) as T;
}

async function requestJson(app: express.Express, requestPath: string, options: { method?: string } = {}): Promise<{ status: number; body: unknown }> {
    const { server, baseUrl } = await listen(app);
    try {
        const response = await fetch(`${baseUrl}${requestPath}`, { method: options.method });

        return {
            status: response.status,
            body: await response.json(),
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
