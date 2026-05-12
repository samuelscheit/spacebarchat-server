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
import { join } from "node:path";
import { describe, test } from "node:test";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "@spacebar/api";
import { DiscordApiErrors } from "@spacebar/util";
import express from "express";
import {
    APPLICATION_ROLE_CONNECTIONS_REQUIRED_SCOPE,
    assertOAuthApplicationRoleConnectionToken,
    createApplicationRoleConnectionRouter,
    getCurrentUserApplicationRoleConnection,
    getOAuthApplicationRoleConnectionApplicationId,
    getOAuthApplicationRoleConnectionScopes,
    type ApplicationRoleConnectionProvider,
} from "../../src/api/routes/users/@me/applications/#application_id/role-connection";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestIds = ["api:http:GET:/users/@me/applications/:application_id/role-connection/"];
const assignedPath = "/users/@me/applications/{application_id}/role-connection";
const assignedMissingPath = "/users/@me/applications/{param}/role-connection";
const assignedRouteName = "GET_USERS__ME_APPLICATIONS_APPLICATION_ID_ROLE_CONNECTION";
const applicationId = "100000000000000007";

type JsonSchema = {
    $ref?: string;
    additionalProperties?: boolean | JsonSchema;
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    type?: string | string[];
};

describe("GET /users/@me/applications/:application_id/role-connection", () => {
    test("documents the assigned manifest id and stays behind bearer auth", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/users/@me/applications/:application_id/role-connection/"]);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/users/@me/applications/100000000000000007/role-connection"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/users/@me/applications/100000000000000007/role-connection"), false);

        const response = await requestJson(createAuthenticatedApp(), `/users/@me/applications/${applicationId}/role-connection`);

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("requires an OAuth2 token with role_connections.write for the path application", async () => {
        assert.deepEqual(getOAuthApplicationRoleConnectionScopes({ scope: "identify role_connections.write", scopes: ["email"], scp: "guilds,identify" }), [
            "identify",
            APPLICATION_ROLE_CONNECTIONS_REQUIRED_SCOPE,
            "email",
            "guilds",
        ]);
        assert.equal(getOAuthApplicationRoleConnectionApplicationId({ client_id: applicationId }), applicationId);
        assert.equal(getOAuthApplicationRoleConnectionApplicationId({ application: { id: applicationId } }), applicationId);

        assert.throws(
            () => assertOAuthApplicationRoleConnectionToken({ scope: "identify", client_id: applicationId }, applicationId),
            DiscordApiErrors.MISSING_REQUIRED_OAUTH2_SCOPE,
        );
        assert.throws(
            () => assertOAuthApplicationRoleConnectionToken({ scope: APPLICATION_ROLE_CONNECTIONS_REQUIRED_SCOPE, client_id: "other-app" }, applicationId),
            DiscordApiErrors.INVALID_OAUTH_TOKEN,
        );

        const missingScope = await requestJson(
            createRouteApp({ token: { scope: "identify", client_id: applicationId } }),
            `/users/@me/applications/${applicationId}/role-connection`,
        );
        assert.equal(missingScope.status, 400);
        assert.equal((missingScope.body as { code?: number }).code, DiscordApiErrors.MISSING_REQUIRED_OAUTH2_SCOPE.code);

        const wrongApplication = await requestJson(
            createRouteApp({ token: { scope: APPLICATION_ROLE_CONNECTIONS_REQUIRED_SCOPE, client_id: "other-app" } }),
            `/users/@me/applications/${applicationId}/role-connection`,
        );
        assert.equal(wrongApplication.status, 400);
        assert.equal((wrongApplication.body as { code?: number }).code, DiscordApiErrors.INVALID_OAUTH_TOKEN.code);
    });

    test("returns the locally supported user application role connection projection", async () => {
        let providerUserId: string | undefined;
        let providerApplicationId: string | undefined;
        const provider: ApplicationRoleConnectionProvider = (userId, currentApplicationId) => {
            providerUserId = userId;
            providerApplicationId = currentApplicationId;
            return {
                platform_name: "Example",
                platform_username: "viewer",
                metadata: {
                    level: "10",
                },
            };
        };

        const response = await requestJson(createRouteApp({ provider }), `/users/@me/applications/${applicationId}/role-connection`);

        assert.equal(response.status, 200);
        assert.equal(providerUserId, "viewer");
        assert.equal(providerApplicationId, applicationId);
        assert.deepEqual(response.body, {
            platform_name: "Example",
            platform_username: "viewer",
            metadata: {
                level: "10",
            },
        });
    });

    test("does not fabricate platform or metadata state without durable local backing", () => {
        const first = getCurrentUserApplicationRoleConnection("viewer", applicationId);
        const second = getCurrentUserApplicationRoleConnection("viewer", applicationId);

        assert.deepEqual(first, {
            platform_name: null,
            platform_username: null,
            metadata: {},
        });
        assert.deepEqual(second, {
            platform_name: null,
            platform_username: null,
            metadata: {},
        });
        assert.notEqual(first, second, "callers should receive a fresh response object");
        assert.notEqual(first.metadata, second.metadata, "callers should receive fresh metadata maps");
        assert.equal("application" in first, false);
        assert.equal("application_metadata" in first, false);
    });

    test("declares source-backed metadata and generated artifacts for the exact owned path", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "users", "@me", "applications", "#application_id", "role-connection.ts"), "utf8");
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
                    put?: unknown;
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
        const suiteCoverage = JSON.parse(readFileSync(join(process.cwd(), "test", "generated", "suite-coverage.json"), "utf8")) as unknown;

        assert.match(routeSource, /summary:\s*"Get User Application Role Connection"/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"ApplicationRoleConnectionResponse"/s);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);

        assert.equal(schemas.ApplicationRoleConnectionResponse.type, "object");
        assert.deepEqual(schemas.ApplicationRoleConnectionResponse.properties?.platform_name?.type, ["null", "string"]);
        assert.deepEqual(schemas.ApplicationRoleConnectionResponse.properties?.platform_username?.type, ["null", "string"]);
        assert.deepEqual(schemas.ApplicationRoleConnectionResponse.required?.sort(), ["metadata", "platform_name", "platform_username"]);
        assert.equal(
            openapi.components?.schemas?.ApplicationRoleConnectionResponse?.properties?.metadata?.$ref,
            "#/components/schemas/ApplicationRoleConnectionMetadataValuesResponse",
        );

        const route = openapi.paths?.["/users/@me/applications/{application_id}/role-connection/"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ApplicationRoleConnectionResponse");
        assert.equal(route?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.equal(openapi.paths?.["/users/@me/applications/{application_id}/role-connection/"]?.put, undefined);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.path, "/users/@me/applications/:application_id/role-connection/");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/users/@me/applications/#application_id/role-connection.ts");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("ApplicationRoleConnectionResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 400, 401],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === assignedPath);
        assert.equal(catalogEntry?.route_name, assignedRouteName);
        assert.equal(catalogEntry?.source, "src/api/routes/users/@me/applications/#application_id/role-connection.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "ApplicationRoleConnectionResponse"]);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === assignedMissingPath && entry.route_name === assignedRouteName),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "PUT" && entry.route === assignedMissingPath),
            true,
        );

        const contract = contractTests.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse", "ApplicationRoleConnectionResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [200, 400, 401]);
        assert.equal(JSON.stringify(suiteCoverage).includes(coveredManifestIds[0]), true);
    });
});

type CreateRouteAppOptions = {
    provider?: ApplicationRoleConnectionProvider;
    token?: Record<string, unknown>;
    userId?: string;
};

function createRouteApp(options: CreateRouteAppOptions = {}) {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = options.userId ?? "viewer";
        req.token = (options.token ?? { scope: APPLICATION_ROLE_CONNECTIONS_REQUIRED_SCOPE, client_id: applicationId }) as never;
        next();
    });
    app.use("/users/@me/applications/:application_id/role-connection", createApplicationRoleConnectionRouter(options.provider));
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp() {
    const app = express();

    app.use(Authentication);
    app.use("/users/@me/applications/:application_id/role-connection", createApplicationRoleConnectionRouter());
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
