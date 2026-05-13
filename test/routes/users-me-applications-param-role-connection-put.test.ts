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
    APPLICATION_ROLE_CONNECTION_UPDATE_UNSUPPORTED_MESSAGE,
    createApplicationRoleConnectionRouter,
    createApplicationRoleConnectionUpdateUnsupportedError,
    normalizeApplicationRoleConnectionModify,
    validateApplicationRoleConnectionModify,
    type ApplicationRoleConnectionUpdater,
    type NormalizedApplicationRoleConnectionModify,
} from "../../src/api/routes/users/@me/applications/#application_id/role-connection";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestIds = ["api:http:PUT:/users/@me/applications/:application_id/role-connection/"];
const assignedPath = "/users/@me/applications/{application_id}/role-connection";
const assignedMissingPath = "/users/@me/applications/{param}/role-connection";
const assignedRouteName = "PUT_USERS__ME_APPLICATIONS_APPLICATION_ID_ROLE_CONNECTION";
const applicationId = "100000000000000007";

type JsonSchema = {
    $ref?: string;
    additionalProperties?: boolean | JsonSchema;
    anyOf?: JsonSchema[];
    items?: JsonSchema;
    maxLength?: number;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    type?: string | string[];
};

describe("PUT /users/@me/applications/:application_id/role-connection", () => {
    test("documents the assigned manifest id and stays behind bearer auth", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:PUT:/users/@me/applications/:application_id/role-connection/"]);
        assert.equal(isNoAuthorizationRoute("PUT", "/api/v10/users/@me/applications/100000000000000007/role-connection"), false);
        assert.equal(isNoAuthorizationRoute("PUT", "/users/@me/applications/100000000000000007/role-connection"), false);

        const response = await requestJson(createAuthenticatedApp(), `/users/@me/applications/${applicationId}/role-connection`, {
            method: "PUT",
            body: {},
        });

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("requires an OAuth2 token with role_connections.write for the path application", async () => {
        const validBody = { platform_name: "Example", platform_username: "viewer", metadata: { level: "10" } };

        const missingScope = await requestJson(
            createRouteApp({ token: { scope: "identify", client_id: applicationId } }),
            `/users/@me/applications/${applicationId}/role-connection`,
            {
                method: "PUT",
                body: validBody,
            },
        );
        assert.equal(missingScope.status, 400);
        assert.equal((missingScope.body as { code?: number }).code, DiscordApiErrors.MISSING_REQUIRED_OAUTH2_SCOPE.code);

        const wrongApplication = await requestJson(
            createRouteApp({ token: { scope: APPLICATION_ROLE_CONNECTIONS_REQUIRED_SCOPE, client_id: "other-app" } }),
            `/users/@me/applications/${applicationId}/role-connection`,
            {
                method: "PUT",
                body: validBody,
            },
        );
        assert.equal(wrongApplication.status, 400);
        assert.equal((wrongApplication.body as { code?: number }).code, DiscordApiErrors.INVALID_OAUTH_TOKEN.code);
    });

    test("validates and normalizes the documented nullable body before updater dispatch", async () => {
        const calls: { userId: string; currentApplicationId: string; body: NormalizedApplicationRoleConnectionModify }[] = [];
        const updater: ApplicationRoleConnectionUpdater = (userId, currentApplicationId, body) => {
            calls.push({ userId, currentApplicationId, body });

            return {
                platform_name: body.platform_name,
                platform_username: body.platform_username,
                metadata: body.metadata,
            };
        };

        const response = await requestJson(createRouteApp({ updater }), `/users/@me/applications/${applicationId}/role-connection`, {
            method: "PUT",
            body: {
                platform_name: null,
                platform_username: "viewer",
                metadata: {
                    level: "10",
                },
            },
        });

        assert.equal(response.status, 200);
        assert.deepEqual(calls, [
            {
                userId: "viewer",
                currentApplicationId: applicationId,
                body: {
                    platform_name: null,
                    platform_username: "viewer",
                    metadata: {
                        level: "10",
                    },
                },
            },
        ]);
        assert.deepEqual(response.body, {
            platform_name: null,
            platform_username: "viewer",
            metadata: {
                level: "10",
            },
        });

        const normalized = normalizeApplicationRoleConnectionModify({ metadata: null });
        assert.deepEqual(normalized, { platform_name: null, platform_username: null, metadata: {} });
        assert.notEqual(normalized.metadata, normalizeApplicationRoleConnectionModify({}).metadata, "callers should receive fresh metadata maps");
    });

    test("rejects invalid role connection bodies before updater dispatch", async () => {
        const calls: unknown[] = [];
        const updater: ApplicationRoleConnectionUpdater = () => {
            calls.push("called");
            throw new Error("updater should not be called for invalid bodies");
        };

        const response = await requestJson(createRouteApp({ updater }), `/users/@me/applications/${applicationId}/role-connection`, {
            method: "PUT",
            body: {
                platform_name: "x".repeat(51),
                platform_username: 123,
                metadata: {
                    level: "x".repeat(101),
                },
            },
        });

        assert.equal(response.status, 400);
        assert.equal((response.body as { code?: number }).code, 50035);
        assert.deepEqual(calls, []);

        assert.throws(
            () => validateApplicationRoleConnectionModify({ metadata: { level: "x".repeat(101) } }),
            (error) => (error as { code?: unknown; errors?: unknown }).code === 50035 && typeof (error as { errors?: unknown }).errors === "object",
        );

        const invalidMetadataOnly = await requestJson(createRouteApp({ updater }), `/users/@me/applications/${applicationId}/role-connection`, {
            method: "PUT",
            body: {
                platform_name: "Example",
                platform_username: "viewer",
                metadata: {
                    level: "x".repeat(101),
                },
            },
        });

        assert.equal(invalidMetadataOnly.status, 400);
        assert.equal((invalidMetadataOnly.body as { code?: number }).code, 50035);
        assert.deepEqual(calls, []);
    });

    test("fails closed by default instead of fabricating persisted role connection state", async () => {
        const unsupportedError = createApplicationRoleConnectionUpdateUnsupportedError();
        assert.equal(unsupportedError.httpStatus, 501);
        assert.equal(unsupportedError.code, 0);
        assert.equal(unsupportedError.message, APPLICATION_ROLE_CONNECTION_UPDATE_UNSUPPORTED_MESSAGE);

        const response = await requestJson(createRouteApp(), `/users/@me/applications/${applicationId}/role-connection`, {
            method: "PUT",
            body: { platform_name: "Example", metadata: { level: "10" } },
        });

        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: 0,
            message: APPLICATION_ROLE_CONNECTION_UPDATE_UNSUPPORTED_MESSAGE,
        });
    });

    test("declares generated artifacts for only the assigned PUT method", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "users", "@me", "applications", "#application_id", "role-connection.ts"), "utf8");
        const schemas = readJson<Record<string, JsonSchema>>(join(process.cwd(), "assets", "schemas.json"));
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    get?: unknown;
                    put?: {
                        requestBody?: { content?: Record<string, { schema?: { $ref?: string } }> };
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                    post?: unknown;
                    patch?: unknown;
                    delete?: unknown;
                }
            >;
        }>(join(process.cwd(), "assets", "openapi.json"));
        const sourceCatalog = readJson<
            {
                method?: string;
                request_schema_ref?: string;
                response_schema_refs?: string[];
                route?: string;
                route_name?: string;
                source?: string;
            }[]
        >(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<{ routes?: string[]; missing_entries?: { method?: string; route?: string; route_name?: string }[] }>(
            join(process.cwd(), "packages", "missing-routes", "missing.json"),
        );
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
        }>(join(process.cwd(), "assets", "testing-manifest.json"));
        const contracts = readJson<{
            contracts?: {
                authMode?: string;
                manifestId?: string;
                routeMetadata?: {
                    requestBody?: string;
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>(join(process.cwd(), "test", "generated", "http-contracts.json"));
        const suiteCoverage = readJson<unknown>(join(process.cwd(), "test", "generated", "suite-coverage.json"));

        assert.match(routeSource, /router\.put\(\s*["']\/["']/);
        assert.match(routeSource, /summary:\s*"Modify User Application Role Connection"/);
        assert.match(routeSource, /requestBody:\s*"ApplicationRoleConnectionModifySchema"/);
        assert.match(routeSource, /coerceRequestBody:\s*false/);
        assert.match(routeSource, /validateApplicationRoleConnectionModify/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"ApplicationRoleConnectionResponse"/s);
        assert.match(routeSource, /501:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /router\.(post|patch|delete)\(/);

        const schema = schemas.ApplicationRoleConnectionModifySchema;
        assert.equal(schema.type, "object");
        assert.equal(schema.additionalProperties, false);
        assert.deepEqual(schema.properties?.platform_name?.type, ["null", "string"]);
        assert.equal(schema.properties?.platform_name?.maxLength, 50);
        assert.deepEqual(schema.properties?.platform_username?.type, ["null", "string"]);
        assert.equal(schema.properties?.platform_username?.maxLength, 100);

        const metadataSchema = schema.properties?.metadata;
        assert.equal(
            metadataSchema?.anyOf?.some((entry) => entry.$ref === "#/definitions/ApplicationRoleConnectionMetadataModifySchema"),
            true,
        );
        assert.equal(
            metadataSchema?.anyOf?.some((entry) => entry.type === "null"),
            true,
        );
        assert.equal(
            schemas.ApplicationRoleConnectionMetadataModifySchema.additionalProperties &&
                typeof schemas.ApplicationRoleConnectionMetadataModifySchema.additionalProperties !== "boolean"
                ? schemas.ApplicationRoleConnectionMetadataModifySchema.additionalProperties.type
                : undefined,
            "string",
        );

        const openapiRoute = openapi.paths?.["/users/@me/applications/{application_id}/role-connection/"]?.put;
        assert.equal(openapiRoute?.requestBody?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ApplicationRoleConnectionModifySchema");
        assert.equal(openapiRoute?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ApplicationRoleConnectionResponse");
        assert.equal(openapiRoute?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapiRoute?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapiRoute?.responses?.["501"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(openapiRoute?.security, [{ bearer: [] }]);
        assert.notEqual(openapi.paths?.["/users/@me/applications/{application_id}/role-connection/"]?.get, undefined);
        assert.equal(openapi.paths?.["/users/@me/applications/{application_id}/role-connection/"]?.post, undefined);
        assert.equal(openapi.paths?.["/users/@me/applications/{application_id}/role-connection/"]?.patch, undefined);
        assert.equal(openapi.paths?.["/users/@me/applications/{application_id}/role-connection/"]?.delete, undefined);

        const sourceRoute = sourceCatalog.find((entry) => entry.method === "PUT" && entry.route === assignedPath);
        assert.equal(sourceRoute?.route_name, assignedRouteName);
        assert.equal(sourceRoute?.source, "src/api/routes/users/@me/applications/#application_id/role-connection.ts");
        assert.equal(sourceRoute?.request_schema_ref, "ApplicationRoleConnectionModifySchema");
        assert.deepEqual(sourceRoute?.response_schema_refs?.sort(), ["APIErrorResponse", "ApplicationRoleConnectionResponse"]);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "PUT" && entry.route === assignedMissingPath && entry.route_name === assignedRouteName),
            false,
        );
        assert.equal(missingRoutes.routes?.includes(assignedMissingPath), false);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/users/@me/applications/#application_id/role-connection.ts");
        assert.equal(manifestEntry?.routeMetadata?.requestBody, "ApplicationRoleConnectionModifySchema");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "ApplicationRoleConnectionResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [200, 400, 401, 501]);

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.routeMetadata?.requestBody, "ApplicationRoleConnectionModifySchema");
        assert.deepEqual(contract?.routeMetadata?.responses?.sort(), ["APIErrorResponse", "ApplicationRoleConnectionResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [200, 400, 401, 501]);
        assert.equal(JSON.stringify(suiteCoverage).includes(coveredManifestIds[0]), true);
    });
});

type CreateRouteAppOptions = {
    token?: Record<string, unknown>;
    updater?: ApplicationRoleConnectionUpdater;
    userId?: string;
};

function createRouteApp(options: CreateRouteAppOptions = {}) {
    const app = express();

    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = options.userId ?? "viewer";
        req.token = (options.token ?? { scope: APPLICATION_ROLE_CONNECTIONS_REQUIRED_SCOPE, client_id: applicationId }) as never;
        next();
    });
    app.use("/users/@me/applications/:application_id/role-connection", createApplicationRoleConnectionRouter(undefined, options.updater));
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp() {
    const app = express();

    app.use(express.json());
    app.use(Authentication);
    app.use("/users/@me/applications/:application_id/role-connection", createApplicationRoleConnectionRouter());
    app.use(ErrorHandler);

    return app;
}

async function requestJson(app: express.Express, path: string, options: { method?: string; body?: unknown } = {}) {
    const server = await new Promise<ReturnType<express.Express["listen"]>>((resolve) => {
        const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });

    try {
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
        const response = await fetch(`http://127.0.0.1:${(address as AddressInfo).port}${path}`, {
            method: options.method ?? "GET",
            body: options.body === undefined ? undefined : JSON.stringify(options.body),
            headers: options.body === undefined ? undefined : { "content-type": "application/json" },
        });
        const text = await response.text();

        return {
            status: response.status,
            body: text ? (JSON.parse(text) as unknown) : undefined,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

function readJson<T>(path: string): T {
    return JSON.parse(readFileSync(path, "utf8")) as T;
}
