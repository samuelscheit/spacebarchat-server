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
import type { PartnerSdkApplicationStorefrontResponse, StoreListingResponse, StoreSkuResponse } from "@spacebar/schemas";
import { DiscordApiErrors } from "@spacebar/util";
import express from "express";
import type { ApplicationCommandAuthorizationRepository, ApplicationCommandAuthorizationTarget } from "../../src/api/util/utility/ApplicationAuthorization";
import {
    createPartnerSdkApplicationStorefrontRouter,
    getConfiguredPartnerSdkApplicationStorefront,
    getPartnerSdkApplicationStorefront,
    isPartnerSdkApplicationStorefrontApplicationId,
    toPartnerSdkApplicationStorefrontResponse,
    UNKNOWN_APPLICATION_STOREFRONT_ERROR,
    type PartnerSdkApplicationStorefrontDependencies,
    type PartnerSdkApplicationStorefrontProvider,
    type PartnerSdkApplicationStorefrontProviderOptions,
    type PartnerSdkApplicationStorefrontSource,
} from "../../src/api/routes/partner-sdk/applications/#application_id/storefront";
import { TeamMemberRole, TeamMemberState } from "../../src/schemas/api/developers/Team";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const applicationId = "100000000000000001";
const coveredManifestIds = ["api:http:GET:/partner-sdk/applications/:application_id/storefront/"];
const routePath = "/partner-sdk/applications/:application_id/storefront/";
const openApiPath = "/partner-sdk/applications/{application_id}/storefront/";
const sourceRoute = "/partner-sdk/applications/{application_id}/storefront";
const assignedRoute = "/partner-sdk/applications/{param}/storefront";
const assignedRouteName = "GET_PARTNER_SDK_APPLICATIONS_APPLICATION_ID_STOREFRONT";

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

describe("GET /partner-sdk/applications/:application_id/storefront", () => {
    test("stays behind bearer authentication and declares route metadata", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/partner-sdk/applications/:application_id/storefront/"]);
        assert.equal(isNoAuthorizationRoute("GET", `/partner-sdk/applications/${applicationId}/storefront`), false);
        assert.equal(isNoAuthorizationRoute("HEAD", `/api/v10/partner-sdk/applications/${applicationId}/storefront/`), false);

        const authResponse = await requestJson(createAuthenticatedApp(), `/partner-sdk/applications/${applicationId}/storefront`);

        assert.equal(authResponse.status, 401);
        assert.match((authResponse.body as { message?: string }).message ?? "", /Missing Authorization Header/);

        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "partner-sdk", "applications", "#application_id", "storefront.ts"), "utf8");
        assert.match(routeSource, /summary:\s*"Get Application Storefront"/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"PartnerSdkApplicationStorefrontResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /403:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
    });

    test("returns provider-backed storefront state after application access checks", async () => {
        let receivedOptions: PartnerSdkApplicationStorefrontProviderOptions | undefined;
        const source = storefrontSource();
        const storefrontProvider: PartnerSdkApplicationStorefrontProvider = (options) => {
            receivedOptions = options;
            return source;
        };
        const app = createRouteApp({
            applicationRepository: applicationRepositoryFor({
                owner: { id: "viewer" },
                team: null,
            }),
            storefrontProvider,
        });

        const response = await requestJson(app, `/partner-sdk/applications/${applicationId}/storefront`);

        assert.equal(response.status, 200);
        assert.deepEqual(receivedOptions, { application_id: applicationId });
        assert.deepEqual(response.body, toPartnerSdkApplicationStorefrontResponse(source));
        assert.equal(((response.body as PartnerSdkApplicationStorefrontResponse).pages[0] as { internal_notes?: unknown }).internal_notes, undefined);
        assert.equal(((response.body as PartnerSdkApplicationStorefrontResponse).assets[0] as { internal_notes?: unknown }).internal_notes, undefined);
        assert.equal(
            (((response.body as PartnerSdkApplicationStorefrontResponse).store_listings[0] as StoreListingResponse).sku as StoreSkuResponse & { internal_notes?: unknown })
                .internal_notes,
            undefined,
        );
    });

    test("allows application owners, bot users, and accepted team members while rejecting outsiders", async () => {
        const botUserApp = createRouteApp({
            applicationRepository: applicationRepositoryFor({
                owner: { id: "owner" },
                bot: { id: "viewer" },
                team: null,
            }),
            storefrontProvider: () => storefrontSource(),
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
            storefrontProvider: () => storefrontSource(),
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
            storefrontProvider: () => storefrontSource(),
        });

        const botAllowed = await requestJson(botUserApp, `/partner-sdk/applications/${applicationId}/storefront`);
        const teamAllowed = await requestJson(acceptedTeamMemberApp, `/partner-sdk/applications/${applicationId}/storefront`);
        const denied = await requestJson(unauthorizedApp, `/partner-sdk/applications/${applicationId}/storefront`);

        assert.equal(botAllowed.status, 200);
        assert.equal(teamAllowed.status, 200);
        assert.equal(denied.status, 403);
        assert.deepEqual(denied.body, {
            code: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code,
            message: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.message,
        });
    });

    test("fails closed for malformed or missing application storefronts without fabricating data", async () => {
        let providerCalls = 0;
        const storefrontProvider: PartnerSdkApplicationStorefrontProvider = () => {
            providerCalls += 1;
            return storefrontSource();
        };

        assert.equal(isPartnerSdkApplicationStorefrontApplicationId(applicationId), true);
        assert.equal(isPartnerSdkApplicationStorefrontApplicationId("not-a-snowflake"), false);
        assert.equal(getConfiguredPartnerSdkApplicationStorefront({ application_id: applicationId }), undefined);
        assert.equal(UNKNOWN_APPLICATION_STOREFRONT_ERROR.httpStatus, 404);
        assert.equal(UNKNOWN_APPLICATION_STOREFRONT_ERROR.code, 10033);

        await assert.rejects(() => getPartnerSdkApplicationStorefront("not-a-snowflake", "viewer", { storefrontProvider }), {
            code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
        });
        await assert.rejects(
            () =>
                getPartnerSdkApplicationStorefront(applicationId, "viewer", {
                    applicationRepository: applicationRepositoryFor(null),
                    storefrontProvider,
                }),
            { code: DiscordApiErrors.UNKNOWN_APPLICATION.code },
        );
        assert.equal(providerCalls, 0);

        await assert.rejects(
            () =>
                getPartnerSdkApplicationStorefront(applicationId, "viewer", {
                    applicationRepository: applicationRepositoryFor({ owner: { id: "viewer" }, team: null }),
                }),
            { code: UNKNOWN_APPLICATION_STOREFRONT_ERROR.code },
        );

        const invalidResponse = await requestJson(createRouteApp({ storefrontProvider }), "/partner-sdk/applications/not-a-snowflake/storefront");
        const unknownApplicationResponse = await requestJson(
            createRouteApp({
                applicationRepository: applicationRepositoryFor(null),
                storefrontProvider,
            }),
            `/partner-sdk/applications/${applicationId}/storefront`,
        );
        const unknownStorefrontResponse = await requestJson(
            createRouteApp({
                applicationRepository: applicationRepositoryFor({ owner: { id: "viewer" }, team: null }),
            }),
            `/partner-sdk/applications/${applicationId}/storefront`,
        );

        assert.equal(invalidResponse.status, 404);
        assert.deepEqual(invalidResponse.body, {
            code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
            message: DiscordApiErrors.UNKNOWN_APPLICATION.message,
        });
        assert.equal(unknownApplicationResponse.status, 404);
        assert.deepEqual(unknownApplicationResponse.body, {
            code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
            message: DiscordApiErrors.UNKNOWN_APPLICATION.message,
        });
        assert.equal(unknownStorefrontResponse.status, 404);
        assert.deepEqual(unknownStorefrontResponse.body, {
            code: UNKNOWN_APPLICATION_STOREFRONT_ERROR.code,
            message: UNKNOWN_APPLICATION_STOREFRONT_ERROR.message,
        });
    });

    test("isolates response objects and removes non-contract storefront fields", () => {
        const source = storefrontSource();
        const first = toPartnerSdkApplicationStorefrontResponse(source);
        const second = toPartnerSdkApplicationStorefrontResponse(source);

        assert.deepEqual(first, {
            application_id: applicationId,
            application: {
                id: applicationId,
                name: "Space Game",
            },
            title: "Space Store",
            logo_asset_id: "400000000000000001",
            light_theme_logo_asset_id: "400000000000000002",
            pages: [
                {
                    title: "Featured",
                    leaderboard: {
                        title: "Top Items",
                        description: "Most-played items",
                        background_image_asset_id: "400000000000000003",
                    },
                    sku_ids: ["300000000000000001"],
                    sections: [
                        {
                            title: "Boosts",
                            sku_ids: ["300000000000000001"],
                        },
                    ],
                },
            ],
            store_listings: [expectedListing],
            assets: [
                {
                    id: "400000000000000001",
                    application_id: applicationId,
                    size: 2048,
                    mime_type: "image/png",
                    filename: "logo.png",
                    width: 128,
                    height: 128,
                },
            ],
        });
        assert.notEqual(first.pages, second.pages);
        assert.notEqual(first.pages[0]?.sections, second.pages[0]?.sections);
        assert.notEqual(first.store_listings, second.store_listings);
        assert.notEqual(first.assets, second.assets);
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
                    put?: unknown;
                    delete?: unknown;
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

        assert.equal(schemas.PartnerSdkApplicationStorefrontResponse.type, "object");
        assert.deepEqual(schemas.PartnerSdkApplicationStorefrontResponse.required?.sort(), ["application_id", "assets", "pages", "store_listings", "title"]);
        assert.equal(schemas.PartnerSdkApplicationStorefrontResponse.properties?.pages?.items?.$ref, "#/definitions/PartnerSdkApplicationStorefrontPage");
        assert.equal(schemas.PartnerSdkApplicationStorefrontResponse.properties?.store_listings?.items?.$ref, "#/definitions/StoreListingResponse");
        assert.equal(schemas.PartnerSdkApplicationStorefrontResponse.properties?.assets?.items?.$ref, "#/definitions/PartnerSdkApplicationStorefrontAsset");
        assert.deepEqual(schemas.PartnerSdkApplicationStorefrontPage.required, ["sku_ids"]);
        assert.deepEqual(schemas.PartnerSdkApplicationStorefrontAsset.required?.sort(), ["height", "id", "mime_type", "size", "width"]);

        const operation = openApi.paths?.[openApiPath]?.get;
        assert.deepEqual(operation?.security, [{ bearer: [] }]);
        assert.equal(operation?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/PartnerSdkApplicationStorefrontResponse");
        for (const status of ["401", "403", "404"]) {
            assert.equal(operation?.responses?.[status]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        }
        assert.equal(openApi.paths?.[openApiPath]?.put, undefined);
        assert.equal(openApi.paths?.[openApiPath]?.delete, undefined);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.path, routePath);
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/partner-sdk/applications/#application_id/storefront.ts");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "PartnerSdkApplicationStorefrontResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401, 403, 404],
        );

        assert.deepEqual(
            sourceCatalog.find((entry) => entry.method === "GET" && entry.route === sourceRoute),
            {
                method: "GET",
                response_schema_refs: ["APIErrorResponse", "PartnerSdkApplicationStorefrontResponse"],
                route: sourceRoute,
                route_name: assignedRouteName,
                source: "src/api/routes/partner-sdk/applications/#application_id/storefront.ts",
            },
        );

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === assignedRoute && entry.route_name === assignedRouteName),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some(
                (entry) => entry.method === "PUT" && entry.route === assignedRoute && entry.route_name === "PUT_PARTNER_SDK_APPLICATIONS_APPLICATION_ID_STOREFRONT",
            ),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries?.some(
                (entry) => entry.method === "DELETE" && entry.route === assignedRoute && entry.route_name === "DELETE_PARTNER_SDK_APPLICATIONS_APPLICATION_ID_STOREFRONT",
            ),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries?.some(
                (entry) =>
                    entry.method === "GET" &&
                    entry.route === "/partner-sdk/guilds/{param}/application-storefront" &&
                    entry.route_name === "GET_PARTNER_SDK_GUILDS_GUILD_ID_APPLICATION_STOREFRONT",
            ),
            true,
        );

        const contract = contractTests.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.path, routePath);
        assert.deepEqual(contract?.routeMetadata?.responses?.sort(), ["APIErrorResponse", "PartnerSdkApplicationStorefrontResponse"]);
        assert.deepEqual(
            contract?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401, 403, 404],
        );
    });
});

const sampleSku: StoreSkuResponse = {
    id: "300000000000000001",
    type: 3,
    application_id: applicationId,
    product_line: 14,
    flags: 4,
    name: "Coin Pack",
    slug: "coin-pack",
    access_type: 1,
    features: [],
    premium: false,
    show_age_gate: false,
};

const expectedListing: StoreListingResponse = {
    id: "500000000000000001",
    sku: sampleSku,
    summary: "Coin pack listing",
    published: true,
};

function storefrontSource(): PartnerSdkApplicationStorefrontSource {
    return {
        application_id: applicationId,
        application: {
            id: applicationId,
            name: "Space Game",
        },
        title: "Space Store",
        logo_asset_id: "400000000000000001",
        light_theme_logo_asset_id: "400000000000000002",
        pages: [
            {
                title: "Featured",
                leaderboard: {
                    title: "Top Items",
                    description: "Most-played items",
                    background_image_asset_id: "400000000000000003",
                },
                sku_ids: ["300000000000000001"],
                sections: [
                    {
                        title: "Boosts",
                        sku_ids: ["300000000000000001"],
                    },
                ],
                internal_notes: "do not serialize",
            } as PartnerSdkApplicationStorefrontSource["pages"][number] & { internal_notes: string },
        ],
        store_listings: [
            {
                id: "500000000000000001",
                sku: {
                    ...sampleSku,
                    internal_notes: "do not serialize",
                } as StoreSkuResponse & { internal_notes: string },
                summary: "Coin pack listing",
                published: true,
            },
        ],
        assets: [
            {
                id: "400000000000000001",
                application_id: applicationId,
                size: 2048,
                mime_type: "image/png",
                filename: "logo.png",
                width: 128,
                height: 128,
                internal_notes: "do not serialize",
            } as PartnerSdkApplicationStorefrontSource["assets"][number] & { internal_notes: string },
        ],
    };
}

function applicationRepositoryFor(application: ApplicationCommandAuthorizationTarget | null): ApplicationCommandAuthorizationRepository {
    return {
        findOne: async () => application,
    };
}

function createRouteApp(dependencies: PartnerSdkApplicationStorefrontDependencies = {}) {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/partner-sdk/applications/:application_id/storefront", createPartnerSdkApplicationStorefrontRouter(dependencies));
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp() {
    const app = express();

    app.use(Authentication);
    app.use("/partner-sdk/applications/:application_id/storefront", createPartnerSdkApplicationStorefrontRouter());
    app.use(ErrorHandler);

    return app;
}

async function requestJson(app: express.Express, path: string): Promise<JsonResponse> {
    let server: Server | undefined;

    try {
        server = await new Promise<Server>((resolve) => {
            const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
        });
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
        const response = await fetch(`http://127.0.0.1:${(address as AddressInfo).port}${path}`);

        return {
            status: response.status,
            body: (await response.json()) as Record<string, unknown> | unknown[],
        };
    } finally {
        if (server) {
            await new Promise<void>((resolve, reject) => {
                server?.close((error) => (error ? reject(error) : resolve()));
            });
        }
    }
}
