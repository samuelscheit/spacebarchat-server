/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTIBILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { describe, test } from "node:test";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "@spacebar/api";
import express from "express";
import {
    createApplicationRoleConnectionsRouter,
    getCurrentUserApplicationRoleConnections,
    type ApplicationRoleConnectionsProvider,
} from "../../src/api/routes/users/@me/applications/role-connections";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestIds = ["api:http:GET:/users/@me/applications/role-connections/"];
const assignedPath = "/users/@me/applications/role-connections";
const assignedRouteName = "GET_USERS__ME_APPLICATIONS_ROLE_CONNECTIONS";

type JsonSchema = {
    $ref?: string;
    additionalProperties?: boolean | JsonSchema;
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    type?: string | string[];
};

describe("GET /users/@me/applications/role-connections", () => {
    test("documents the assigned manifest id and stays behind bearer auth", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/users/@me/applications/role-connections/"]);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/users/@me/applications/role-connections"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/users/@me/applications/role-connections"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/users/@me/applications/100000000000000007/role-connection"), false);

        const response = await requestJson(createAuthenticatedApp(), "/users/@me/applications/role-connections");

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("returns the locally backed current user role connection list", async () => {
        let providerUserId: string | undefined;
        const provider: ApplicationRoleConnectionsProvider = (userId) => {
            providerUserId = userId;
            return [
                {
                    platform_name: "Example",
                    platform_username: "viewer",
                    metadata: {
                        level: "10",
                    },
                },
            ];
        };

        const response = await requestJson(createRouteApp(provider), "/users/@me/applications/role-connections");

        assert.equal(response.status, 200);
        assert.equal(providerUserId, "viewer");
        assert.deepEqual(response.body, [
            {
                platform_name: "Example",
                platform_username: "viewer",
                metadata: {
                    level: "10",
                },
            },
        ]);
    });

    test("does not fabricate Discord-only role connection state without durable local backing", () => {
        const first = getCurrentUserApplicationRoleConnections("viewer");
        const second = getCurrentUserApplicationRoleConnections("viewer");

        assert.deepEqual(first, []);
        assert.deepEqual(second, []);
        assert.notEqual(first, second, "callers should receive a fresh response array");
    });

    test("declares source-backed metadata and generated artifacts for the exact owned path", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "users", "@me", "applications", "role-connections.ts"), "utf8");
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonSchema>;
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            components?: {
                schemas?: Record<string, JsonSchema>;
            };
            paths?: Record<
                string,
                {
                    get?: {
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                }
            >;
        };
        const manifest = JSON.parse(readFileSync(join(process.cwd(), "assets", "testing-manifest.json"), "utf8")) as {
            entries?: {
                id?: string;
                path?: string;
                sourceFile?: string;
                authMode?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
            }[];
        };
        const sourceCatalog = JSON.parse(
            readFileSync(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"), "utf8"),
        ) as {
            method?: string;
            route?: string;
            route_name?: string;
            source?: string;
            response_schema_refs?: string[];
        }[];
        const missingRoutes = JSON.parse(readFileSync(join(process.cwd(), "packages", "missing-routes", "missing.json"), "utf8")) as {
            missing_entries?: { method?: string; route?: string; route_name?: string }[];
        };
        const contractTests = JSON.parse(readFileSync(join(process.cwd(), "test", "generated", "http-contracts.json"), "utf8")) as {
            contracts?: {
                manifestId?: string;
                authMode?: string;
                routeMetadata?: {
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
        };

        assert.match(routeSource, /summary:\s*"Get User Application Role Connections"/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"ApplicationRoleConnectionsResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);

        assert.equal(schemas.ApplicationRoleConnectionsResponse.type, "array");
        assert.equal(schemas.ApplicationRoleConnectionsResponse.items?.$ref, "#/definitions/ApplicationRoleConnectionResponse");
        assert.deepEqual(schemas.ApplicationRoleConnectionResponse.properties?.platform_name?.type, ["null", "string"]);
        assert.deepEqual(schemas.ApplicationRoleConnectionResponse.properties?.platform_username?.type, ["null", "string"]);
        assert.equal(openapi.components?.schemas?.ApplicationRoleConnectionsResponse?.items?.$ref, "#/components/schemas/ApplicationRoleConnectionResponse");

        const route = openapi.paths?.["/users/@me/applications/role-connections/"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ApplicationRoleConnectionsResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.path, "/users/@me/applications/role-connections/");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/users/@me/applications/role-connections.ts");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("ApplicationRoleConnectionsResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === assignedPath);
        assert.equal(catalogEntry?.route_name, assignedRouteName);
        assert.equal(catalogEntry?.source, "src/api/routes/users/@me/applications/role-connections.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "ApplicationRoleConnectionsResponse"]);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === assignedPath && entry.route_name === assignedRouteName),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.route === "/users/@me/applications/{param}/role-connection"),
            true,
        );

        const contract = contractTests.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse", "ApplicationRoleConnectionsResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [200, 401]);
    });
});

function createRouteApp(provider: ApplicationRoleConnectionsProvider = getCurrentUserApplicationRoleConnections) {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/users/@me/applications/role-connections", createApplicationRoleConnectionsRouter(provider));
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp() {
    const app = express();

    app.use(Authentication);
    app.use("/users/@me/applications/role-connections", createApplicationRoleConnectionsRouter());
    app.use(ErrorHandler);

    return app;
}

async function requestJson(app: express.Express, path: string) {
    const server = await new Promise<ReturnType<express.Express["listen"]>>((resolve) => {
        const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });

    try {
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
        const response = await fetch(`http://127.0.0.1:${(address as AddressInfo).port}${path}`);

        return {
            status: response.status,
            body: (await response.json()) as unknown,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}
