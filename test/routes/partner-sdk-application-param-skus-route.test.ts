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
import { join } from "node:path";
import { describe, test } from "node:test";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "@spacebar/api";
import type { StoreSkuResponse } from "@spacebar/schemas";
import { DiscordApiErrors } from "@spacebar/util";
import express from "express";
import type { ApplicationCommandAuthorizationRepository, ApplicationCommandAuthorizationTarget } from "../../src/api/util/utility/ApplicationAuthorization";
import {
    createPartnerSdkApplicationSkusRouter,
    getConfiguredPartnerSdkApplicationSkus,
    isPartnerSdkApplicationSkusApplicationId,
    listPartnerSdkApplicationSkus,
    toPartnerSdkApplicationSkusResponse,
    type PartnerSdkApplicationSkuSource,
    type PartnerSdkApplicationSkusDependencies,
    type PartnerSdkApplicationSkusProvider,
    type PartnerSdkApplicationSkusProviderOptions,
} from "../../src/api/routes/partner-sdk/application/#application_id/skus";
import { TeamMemberRole, TeamMemberState } from "../../src/schemas/api/developers/Team";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestIds = ["api:http:GET:/partner-sdk/application/:application_id/skus/"];
const routePath = "/partner-sdk/application/:application_id/skus/";
const openApiPath = "/partner-sdk/application/{application_id}/skus/";
const sourceRoute = "/partner-sdk/application/{application_id}/skus";
const assignedRoute = "/partner-sdk/application/{param}/skus";
const assignedRouteName = "GET_PARTNER_SDK_APPLICATION_APPLICATION_ID_SKUS";

type JsonResponse = {
    status: number;
    body: Record<string, unknown> | unknown[];
};

type JsonSchema = {
    $ref?: string;
    type?: string | string[];
    required?: string[];
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
};

describe("GET /partner-sdk/application/:application_id/skus", () => {
    test("stays behind bearer authentication and declares route metadata", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/partner-sdk/application/:application_id/skus/"]);
        assert.equal(isNoAuthorizationRoute("GET", "/partner-sdk/application/100000000000000001/skus"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/partner-sdk/application/100000000000000001/skus/"), false);

        const authResponse = await requestJson(createAuthenticatedApp(), "/partner-sdk/application/100000000000000001/skus");

        assert.equal(authResponse.status, 401);
        assert.match((authResponse.body as { message?: string }).message ?? "", /Missing Authorization Header/);

        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "partner-sdk", "application", "#application_id", "skus.ts"), "utf8");
        assert.match(routeSource, /summary:\s*"Get Social Layer SKUs"/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"PartnerSdkApplicationSkusResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /403:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
    });

    test("returns provider-backed Social Layer SKUs after application access checks", async () => {
        let receivedOptions: PartnerSdkApplicationSkusProviderOptions | undefined;
        const sourceSku = {
            ...sampleSku,
            internal_notes: "do not serialize",
        } as PartnerSdkApplicationSkuSource & { internal_notes: string };
        const skusProvider: PartnerSdkApplicationSkusProvider = (options) => {
            receivedOptions = options;
            return [
                sourceSku,
                { ...sampleSku, id: "300000000000000002", product_line: 6, slug: "store-sku" },
                { ...sampleSku, id: "300000000000000003", application_id: "100000000000000099", slug: "other-app-sku" },
            ];
        };
        const app = createRouteApp({
            applicationRepository: applicationRepositoryFor({
                owner: { id: "viewer" },
                team: null,
            }),
            skusProvider,
        });

        const response = await requestJson(app, "/partner-sdk/application/100000000000000001/skus");

        assert.equal(response.status, 200);
        assert.deepEqual(receivedOptions, { application_id: "100000000000000001" });
        assert.deepEqual(response.body, [sampleSku]);
        assert.equal(((response.body as StoreSkuResponse[])[0] as StoreSkuResponse & { internal_notes?: unknown }).internal_notes, undefined);
    });

    test("allows application owners, bot users, and accepted team members while rejecting outsiders", async () => {
        const botUserApp = createRouteApp({
            applicationRepository: applicationRepositoryFor({
                owner: { id: "owner" },
                bot: { id: "viewer" },
                team: null,
            }),
            skusProvider: () => [sampleSku],
        });
        const acceptedTeamMemberApp = createRouteApp({
            applicationRepository: applicationRepositoryFor({
                owner: { id: "owner" },
                team: {
                    owner_user_id: "team-owner",
                    members: [
                        {
                            user_id: "viewer",
                            membership_state: TeamMemberState.ACCEPTED,
                            role: TeamMemberRole.READ_ONLY,
                        },
                    ],
                },
            }),
            skusProvider: () => [sampleSku],
        });
        const unauthorizedApp = createRouteApp({
            applicationRepository: applicationRepositoryFor({
                owner: { id: "owner" },
                team: {
                    owner_user_id: "team-owner",
                    members: [
                        {
                            user_id: "viewer",
                            membership_state: TeamMemberState.INVITED,
                            role: TeamMemberRole.ADMIN,
                        },
                    ],
                },
            }),
            skusProvider: () => [sampleSku],
        });

        const botAllowed = await requestJson(botUserApp, "/partner-sdk/application/100000000000000001/skus");
        const teamAllowed = await requestJson(acceptedTeamMemberApp, "/partner-sdk/application/100000000000000001/skus");
        const denied = await requestJson(unauthorizedApp, "/partner-sdk/application/100000000000000001/skus");

        assert.equal(botAllowed.status, 200);
        assert.equal(teamAllowed.status, 200);
        assert.equal(denied.status, 403);
        assert.deepEqual(denied.body, {
            code: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code,
            message: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.message,
        });
    });

    test("fails closed for malformed or unknown applications without fabricating Social Layer SKUs", async () => {
        let providerCalls = 0;
        const skusProvider: PartnerSdkApplicationSkusProvider = () => {
            providerCalls += 1;
            return [sampleSku];
        };

        assert.equal(isPartnerSdkApplicationSkusApplicationId("100000000000000001"), true);
        assert.equal(isPartnerSdkApplicationSkusApplicationId("not-a-snowflake"), false);
        assert.deepEqual(getConfiguredPartnerSdkApplicationSkus({ application_id: "100000000000000001" }), []);
        assert.deepEqual(toPartnerSdkApplicationSkusResponse("100000000000000001", [{ ...sampleSku, product_line: 6 }]), []);

        const first = await listPartnerSdkApplicationSkus("100000000000000001", "viewer", {
            applicationRepository: applicationRepositoryFor({ owner: { id: "viewer" }, team: null }),
        });
        const second = await listPartnerSdkApplicationSkus("100000000000000001", "viewer", {
            applicationRepository: applicationRepositoryFor({ owner: { id: "viewer" }, team: null }),
        });
        assert.deepEqual(first, []);
        assert.notEqual(first, second, "callers should receive fresh response arrays");

        await assert.rejects(() => listPartnerSdkApplicationSkus("not-a-snowflake", "viewer", { skusProvider }), {
            code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
        });
        await assert.rejects(
            () =>
                listPartnerSdkApplicationSkus("100000000000000001", "viewer", {
                    applicationRepository: applicationRepositoryFor(null),
                    skusProvider,
                }),
            { code: DiscordApiErrors.UNKNOWN_APPLICATION.code },
        );
        assert.equal(providerCalls, 0);

        const invalidResponse = await requestJson(createRouteApp({ skusProvider }), "/partner-sdk/application/not-a-snowflake/skus");
        const unknownResponse = await requestJson(
            createRouteApp({
                applicationRepository: applicationRepositoryFor(null),
                skusProvider,
            }),
            "/partner-sdk/application/100000000000000001/skus",
        );

        assert.equal(invalidResponse.status, 404);
        assert.deepEqual(invalidResponse.body, {
            code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
            message: DiscordApiErrors.UNKNOWN_APPLICATION.message,
        });
        assert.equal(unknownResponse.status, 404);
        assert.deepEqual(unknownResponse.body, {
            code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
            message: DiscordApiErrors.UNKNOWN_APPLICATION.message,
        });
    });

    test("is present in regenerated schemas, catalogs, manifest, contracts, OpenAPI, and removed from missing routes", () => {
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonSchema>;
        const openApi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
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
            response_schema_refs?: string[];
            route?: string;
            route_name?: string;
            source?: string;
        }[];
        const missingRoutes = JSON.parse(readFileSync(join(process.cwd(), "packages", "missing-routes", "missing.json"), "utf8")) as {
            missing_entries?: { method?: string; route?: string; route_name?: string }[];
        };
        const contractTests = JSON.parse(readFileSync(join(process.cwd(), "test", "generated", "http-contracts.json"), "utf8")) as {
            contracts?: {
                manifestId?: string;
                authMode?: string;
                path?: string;
                routeMetadata?: {
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
        };

        assert.equal(schemas.PartnerSdkApplicationSkusResponse.type, "array");
        assert.equal(schemas.PartnerSdkApplicationSkusResponse.items?.$ref, "#/definitions/StoreSkuResponse");

        const operation = openApi.paths?.[openApiPath]?.get;
        assert.deepEqual(operation?.security, [{ bearer: [] }]);
        assert.equal(operation?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/PartnerSdkApplicationSkusResponse");
        for (const status of ["401", "403", "404"]) {
            assert.equal(operation?.responses?.[status]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        }

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.path, routePath);
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/partner-sdk/application/#application_id/skus.ts");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "PartnerSdkApplicationSkusResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401, 403, 404],
        );

        assert.deepEqual(
            sourceCatalog.find((entry) => entry.method === "GET" && entry.route === sourceRoute),
            {
                method: "GET",
                response_schema_refs: ["APIErrorResponse", "PartnerSdkApplicationSkusResponse"],
                route: sourceRoute,
                route_name: assignedRouteName,
                source: "src/api/routes/partner-sdk/application/#application_id/skus.ts",
            },
        );

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === assignedRoute && entry.route_name === assignedRouteName),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some(
                (entry) => entry.method === "POST" && entry.route === assignedRoute && entry.route_name === "POST_PARTNER_SDK_APPLICATION_APPLICATION_ID_SKUS",
            ),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries?.some(
                (entry) =>
                    entry.method === "GET" &&
                    entry.route === "/partner-sdk/applications/{param}/storefront" &&
                    entry.route_name === "GET_PARTNER_SDK_APPLICATIONS_APPLICATION_ID_STOREFRONT",
            ),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries?.some(
                (entry) =>
                    entry.method === "GET" &&
                    entry.route === "/partner-sdk/guilds/{param}/application-storefront/skus/{param}" &&
                    entry.route_name === "GET_PARTNER_SDK_GUILDS_GUILD_ID_APPLICATION_STOREFRONT_SKUS_SKU_ID",
            ),
            true,
        );

        const contract = contractTests.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.path, routePath);
        assert.deepEqual(contract?.routeMetadata?.responses?.sort(), ["APIErrorResponse", "PartnerSdkApplicationSkusResponse"]);
        assert.deepEqual(
            contract?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401, 403, 404],
        );
    });
});

const sampleSku: StoreSkuResponse = {
    id: "300000000000000001",
    type: 3,
    application_id: "100000000000000001",
    product_line: 14,
    flags: 4,
    name: "Coin Pack",
    slug: "coin-pack",
    access_type: 1,
    features: [],
    premium: false,
    show_age_gate: false,
};

function applicationRepositoryFor(application: ApplicationCommandAuthorizationTarget | null): ApplicationCommandAuthorizationRepository {
    return {
        findOne: async () => application,
    };
}

function createRouteApp(dependencies: PartnerSdkApplicationSkusDependencies = {}) {
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = "viewer";
        req.token = { id: "viewer", iat: 1 } as never;
        next();
    });
    app.use("/partner-sdk/application/:application_id/skus", createPartnerSdkApplicationSkusRouter(dependencies));
    app.use(ErrorHandler);
    return app;
}

function createAuthenticatedApp() {
    const app = express();
    app.use(Authentication);
    app.use("/partner-sdk/application/:application_id/skus", createPartnerSdkApplicationSkusRouter());
    app.use(ErrorHandler);
    return app;
}

async function requestJson(app: express.Express, requestPath: string): Promise<JsonResponse> {
    const { server, baseUrl } = await listen(app);
    try {
        const response = await fetch(`${baseUrl}${requestPath}`);
        return {
            status: response.status,
            body: (await response.json()) as JsonResponse["body"],
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
