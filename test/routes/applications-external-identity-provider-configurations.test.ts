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
import http from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { describe, test } from "node:test";
import express from "express";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../src/api/middlewares";
import {
    buildApplicationExternalIdentityProviderConfigurationsResponse,
    createApplicationExternalIdentityProviderConfigurationsRouter,
    getApplicationExternalIdentityProviderConfigurations,
    type ApplicationExternalIdentityProviderConfigurationsRepositories,
} from "../../src/api/routes/applications/#application_id/external-identity-provider-configurations";
import { TeamMemberRole, TeamMemberState } from "../../src/schemas/api/developers/Team";
import { DiscordApiErrors } from "../../src/util";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestIds = ["api:http:GET:/applications/:application_id/external-identity-provider-configurations/"];
const routePath = "/applications/{application_id}/external-identity-provider-configurations";
const sourceFile = "src/api/routes/applications/#application_id/external-identity-provider-configurations.ts";

type JsonSchema = {
    $ref?: string;
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    type?: string | string[];
};

function createApp(repositories: ApplicationExternalIdentityProviderConfigurationsRepositories, userId = "owner") {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = userId;
        req.t = ((key: string) => key) as express.Request["t"];
        next();
    });
    app.use("/applications/:application_id/external-identity-provider-configurations", createApplicationExternalIdentityProviderConfigurationsRouter(repositories));
    app.use((error: { code?: number | string; httpStatus?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(error.httpStatus ?? 400).json({ code: error.code, message: error.message });
    });
    return app;
}

function createAuthenticationApp() {
    const app = express();
    app.use(Authentication);
    app.use(
        "/applications/:application_id/external-identity-provider-configurations",
        createApplicationExternalIdentityProviderConfigurationsRouter({
            applicationRepository: {
                findOne: async () => {
                    throw new Error("application lookup must not run without authentication");
                },
            },
        }),
    );
    app.use(ErrorHandler);
    return app;
}

async function requestJson(app: express.Express, requestPath: string) {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
    const port = (address as AddressInfo).port;

    try {
        const response = await fetch(`http://127.0.0.1:${port}${requestPath}`);
        return {
            headers: response.headers,
            status: response.status,
            body: (await response.json()) as unknown,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

function propertyTypes(schema: JsonSchema) {
    if (Array.isArray(schema.type)) return schema.type.toSorted();
    if (typeof schema.type === "string") return [schema.type];
    return [];
}

function readJson<T>(path: string): T {
    return JSON.parse(readFileSync(path, "utf8")) as T;
}

function isDiscordError(error: unknown, expected: typeof DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION) {
    return (error as { code?: unknown; message?: unknown })?.code === expected.code && (error as { code?: unknown; message?: unknown })?.message === expected.message;
}

describe("GET /applications/:application_id/external-identity-provider-configurations", () => {
    test("loads application ownership and team membership before returning the conservative local response", async (t) => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/applications/:application_id/external-identity-provider-configurations/"]);
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                owner: { id: "owner" },
                team: null,
            })),
        };

        const response = await getApplicationExternalIdentityProviderConfigurations("application-id", "owner", { applicationRepository });

        assert.deepEqual(response, []);
        assert.deepEqual(applicationRepository.findOne.mock.calls[0].arguments[0], {
            where: { id: "application-id" },
            relations: {
                owner: true,
                team: {
                    members: true,
                },
            },
        });
    });

    test("allows accepted owning-team members to view the empty configuration list", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                owner: { id: "owner" },
                team: {
                    members: [
                        {
                            user_id: "team-member",
                            membership_state: TeamMemberState.ACCEPTED,
                            role: TeamMemberRole.READ_ONLY,
                        },
                    ],
                },
            })),
        };

        assert.deepEqual(await getApplicationExternalIdentityProviderConfigurations("application-id", "team-member", { applicationRepository }), []);
    });

    test("rejects missing applications and users outside the owning application or team", async (t) => {
        const missingApplicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => null),
        };
        const privateApplicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                owner: { id: "owner" },
                team: null,
            })),
        };

        await assert.rejects(
            () => getApplicationExternalIdentityProviderConfigurations("missing-application", "owner", { applicationRepository: missingApplicationRepository }),
            (error) => isDiscordError(error, DiscordApiErrors.UNKNOWN_APPLICATION),
        );
        await assert.rejects(
            () => getApplicationExternalIdentityProviderConfigurations("application-id", "intruder", { applicationRepository: privateApplicationRepository }),
            (error) => isDiscordError(error, DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION),
        );
    });

    test("does not fabricate provider configurations without durable local provider state", () => {
        const first = buildApplicationExternalIdentityProviderConfigurationsResponse();
        const second = buildApplicationExternalIdentityProviderConfigurationsResponse();

        assert.deepEqual(first, []);
        assert.deepEqual(second, []);
        assert.notEqual(first, second);
    });

    test("returns the mounted route response for an authorized caller", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                owner: { id: "owner" },
                team: null,
            })),
        };

        const response = await requestJson(createApp({ applicationRepository }), "/applications/application-id/external-identity-provider-configurations");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
        assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    });

    test("stays behind bearer authentication", async () => {
        assert.equal(isNoAuthorizationRoute("GET", "/applications/100000000000000001/external-identity-provider-configurations"), false);

        const response = await requestJson(createAuthenticationApp(), "/applications/application-id/external-identity-provider-configurations");
        const body = response.body as { code?: unknown; message?: unknown };

        assert.equal(response.status, 401);
        assert.equal(body.code, 401);
        assert.match(String(body.message ?? ""), /Missing Authorization Header/);
    });

    test("returns the mounted route authorization response for non-team callers", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                owner: { id: "owner" },
                team: null,
            })),
        };

        const response = await requestJson(createApp({ applicationRepository }, "intruder"), "/applications/application-id/external-identity-provider-configurations");

        assert.equal(response.status, 400);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code,
            message: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.message,
        });
    });

    test("declares source-backed route metadata", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "applications", "#application_id", "external-identity-provider-configurations.ts"), "utf8");

        assert.match(routeSource, /summary:\s*"Get Application External Identity Provider Configurations"/);
        assert.match(routeSource, /description:\s*"Returns the locally available external identity provider configurations for the given application\."/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"ApplicationExternalIdentityProviderConfigurationsResponse"/s);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
    });

    test("generates response schema, source catalog, OpenAPI, manifest, contract, and missing-route metadata", () => {
        const schemas = readJson<Record<string, JsonSchema>>(join(process.cwd(), "assets", "schemas.json"));
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    get?: {
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                }
            >;
        }>(join(process.cwd(), "assets", "openapi.json"));
        const sourceCatalog = readJson<
            {
                method?: string;
                response_schema_refs?: string[];
                route?: string;
                route_name?: string;
                source?: string;
            }[]
        >(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
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
        }>(join(process.cwd(), "assets", "testing-manifest.json"));
        const contracts = readJson<{
            contracts?: {
                authMode?: string;
                manifestId?: string;
                routeMetadata?: {
                    responses?: string[];
                    responseStatuses?: number[];
                };
                sourceFile?: string;
            }[];
        }>(join(process.cwd(), "test", "generated", "http-contracts.json"));
        const suiteCoverage = readJson<unknown>(join(process.cwd(), "test", "generated", "suite-coverage.json"));
        const missingRoutes = readJson<{
            missing_entries?: { method?: string; route?: string; route_name?: string }[];
        }>(join(process.cwd(), "packages", "missing-routes", "missing.json"));

        const responseSchema = schemas.ApplicationExternalIdentityProviderConfigurationsResponse;
        assert.equal(responseSchema.type, "array");
        assert.equal(responseSchema.items?.$ref, "#/definitions/ApplicationExternalIdentityProviderConfigurationResponse");

        const configurationSchema = schemas.ApplicationExternalIdentityProviderConfigurationResponse;
        assert.deepEqual(configurationSchema.required, ["application_id", "client_id", "clients", "oidc_issuer_url", "provider_type"]);
        assert.equal(configurationSchema.properties?.application_id?.type, "string");
        assert.equal(configurationSchema.properties?.provider_type?.type, "integer");
        assert.equal(configurationSchema.properties?.client_id?.type, "string");
        assert.deepEqual(propertyTypes(configurationSchema.properties?.oidc_issuer_url ?? {}), ["null", "string"]);
        assert.equal(configurationSchema.properties?.clients?.items?.$ref, "#/definitions/ApplicationExternalIdentityProviderClientResponse");

        const clientSchema = schemas.ApplicationExternalIdentityProviderClientResponse;
        assert.deepEqual(clientSchema.required, ["id", "oidc_issuer_url"]);
        assert.equal(clientSchema.properties?.id?.type, "string");
        assert.deepEqual(propertyTypes(clientSchema.properties?.oidc_issuer_url ?? {}), ["null", "string"]);
        assert.deepEqual(propertyTypes(clientSchema.properties?.description ?? {}), ["null", "string"]);
        assert.deepEqual(propertyTypes(clientSchema.properties?.environment ?? {}), ["null", "string"]);

        const route = openapi.paths?.["/applications/{application_id}/external-identity-provider-configurations/"]?.get;
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ApplicationExternalIdentityProviderConfigurationsResponse");
        assert.equal(route?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === routePath);
        assert.equal(sourceEntry?.route_name, "GET_APPLICATIONS_APPLICATION_ID_EXTERNAL_IDENTITY_PROVIDER_CONFIGURATIONS");
        assert.equal(sourceEntry?.source, sourceFile);
        assert.deepEqual(sourceEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "ApplicationExternalIdentityProviderConfigurationsResponse"]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, sourceFile);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse", "ApplicationExternalIdentityProviderConfigurationsResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [200, 400, 401, 404]);

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.sourceFile, sourceFile);
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse", "ApplicationExternalIdentityProviderConfigurationsResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [200, 400, 401, 404]);
        assert.ok(JSON.stringify(suiteCoverage).includes(coveredManifestIds[0]));

        assert.equal(
            missingRoutes.missing_entries?.some(
                (entry) =>
                    entry.method === "GET" &&
                    entry.route === "/applications/{param}/external-identity-provider-configurations" &&
                    entry.route_name === "GET_APPLICATIONS_APPLICATION_ID_EXTERNAL_IDENTITY_PROVIDER_CONFIGURATIONS",
            ),
            false,
        );
    });
});
