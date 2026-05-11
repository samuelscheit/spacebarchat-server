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
import type { StoreListingResponse, StoreSkuResponse } from "@spacebar/schemas";
import { DiscordApiErrors } from "@spacebar/util";
import express from "express";
import {
    createStoreListingRouter,
    getConfiguredStoreListing,
    getStoreListing,
    isStoreListingRouteSnowflake,
    parseStoreSkuQuery,
    toStoreListingResponse,
    UNKNOWN_STORE_LISTING_ERROR,
    type StoreListingProvider,
    type StoreListingRouteDependencies,
    type StoreListingSource,
} from "../../src/api/routes/store/listings/#store_listing_id";
import { TeamMemberRole, TeamMemberState } from "../../src/schemas/api/developers/Team";
import type { ApplicationCommandAuthorizationRepository, ApplicationCommandAuthorizationTarget } from "../../src/api/util/utility/ApplicationAuthorization";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestIds = ["api:http:GET:/store/listings/:store_listing_id/"];
const assignedPath = "/store/listings/{param}";
const assignedSourcePath = "/store/listings/{store_listing_id}";
const assignedRouteName = "GET_STORE_LISTINGS_STORE_LISTING_ID";

type JsonSchema = {
    $ref?: string;
    type?: string | string[];
    required?: string[];
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
};

describe("GET /store/listings/:store_listing_id", () => {
    test("documents the assigned manifest id and stays behind bearer auth", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/store/listings/:store_listing_id/"]);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/store/listings/500000000000000001?country_code=DE"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v10/store/listings/500000000000000001/"), false);

        const response = await requestJson(createAuthenticatedApp(), "/store/listings/500000000000000001");

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("parses localization query fields, authorizes through the listing SKU application, and returns provider-backed listings", async () => {
        let receivedOptions: StoreListingProviderOptionsSnapshot | undefined;
        const listingProvider: StoreListingProvider = (options) => {
            receivedOptions = options;
            return sampleListing;
        };

        assert.deepEqual(parseStoreSkuQuery({ country_code: ["DE"], localize: ["0"] } as never), {
            country_code: "DE",
            localize: false,
        });
        assert.deepEqual(parseStoreSkuQuery({} as never), { country_code: undefined, localize: true });

        const response = await requestJson(
            createRouteApp({
                listingProvider,
                applicationRepository: applicationRepositoryFor({
                    owner: { id: "viewer" },
                    team: null,
                }),
            }),
            "/store/listings/500000000000000001?country_code=DE&localize=false",
        );

        assert.equal(response.status, 200);
        assert.deepEqual(receivedOptions, {
            store_listing_id: "500000000000000001",
            country_code: "DE",
            localize: false,
        });
        assert.deepEqual(response.body, toStoreListingResponse(sampleListing));
    });

    test("allows application owners, bot users, and accepted team members while rejecting outsiders", async () => {
        const botUserApp = createRouteApp({
            listingProvider: () => sampleListing,
            applicationRepository: applicationRepositoryFor({
                owner: { id: "owner" },
                bot: { id: "viewer" },
                team: null,
            }),
        });
        const acceptedTeamMemberApp = createRouteApp({
            listingProvider: () => sampleListing,
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
        });
        const unauthorizedApp = createRouteApp({
            listingProvider: () => sampleListing,
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
        });

        const botAllowed = await requestJson(botUserApp, "/store/listings/500000000000000001");
        const allowed = await requestJson(acceptedTeamMemberApp, "/store/listings/500000000000000001");
        const denied = await requestJson(unauthorizedApp, "/store/listings/500000000000000001");

        assert.equal(botAllowed.status, 200);
        assert.equal(allowed.status, 200);
        assert.equal(denied.status, 403);
        assert.deepEqual(denied.body, {
            code: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code,
            message: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.message,
        });
    });

    test("fails closed for malformed or unbacked listing IDs without fabricating store data", async () => {
        let providerCalled = false;

        assert.equal(isStoreListingRouteSnowflake("500000000000000001"), true);
        assert.equal(isStoreListingRouteSnowflake("not-a-snowflake"), false);
        assert.deepEqual(getConfiguredStoreListing({ store_listing_id: "500000000000000001", localize: true }), undefined);
        await assert.rejects(
            () =>
                getStoreListing(
                    "not-a-snowflake",
                    "viewer",
                    { localize: true },
                    {
                        listingProvider: () => {
                            providerCalled = true;
                            return sampleListing;
                        },
                    },
                ),
            isUnknownListingError,
        );
        assert.equal(providerCalled, false);
        await assert.rejects(
            () =>
                getStoreListing(
                    "500000000000000001",
                    "viewer",
                    { localize: true },
                    {
                        listingProvider: () => {
                            providerCalled = true;
                            return undefined;
                        },
                    },
                ),
            isUnknownListingError,
        );
        assert.equal(providerCalled, true);

        const missingResponse = await requestJson(createRouteApp(), "/store/listings/500000000000000001");
        const invalidResponse = await requestJson(createRouteApp({ listingProvider: () => sampleListing }), "/store/listings/not-a-snowflake");

        assert.equal(missingResponse.status, 404);
        assert.deepEqual(missingResponse.body, {
            code: UNKNOWN_STORE_LISTING_ERROR.code,
            message: UNKNOWN_STORE_LISTING_ERROR.message,
        });
        assert.equal(invalidResponse.status, 404);
        assert.deepEqual(invalidResponse.body, {
            code: UNKNOWN_STORE_LISTING_ERROR.code,
            message: UNKNOWN_STORE_LISTING_ERROR.message,
        });
    });

    test("rejects malformed localization query booleans", async () => {
        assert.throws(() => parseStoreSkuQuery({ localize: "sometimes" } as never), {
            code: DiscordApiErrors.INVALID_FORM_BODY.code,
        });

        const response = await requestJson(
            createRouteApp({
                listingProvider: () => sampleListing,
                applicationRepository: applicationRepositoryFor({ owner: { id: "viewer" }, team: null }),
            }),
            "/store/listings/500000000000000001?localize=sometimes",
        );

        assert.equal(response.status, 400);
        assert.equal((response.body as { code?: unknown }).code, DiscordApiErrors.INVALID_FORM_BODY.code);
    });

    test("serializes documented listing fields without leaking provider internals", () => {
        const source = {
            ...sampleListing,
            child_skus: [
                {
                    ...sampleSku,
                    id: "300000000000000002",
                    slug: "child-sku",
                },
            ],
            alternative_skus: [
                {
                    ...sampleSku,
                    id: "300000000000000003",
                    slug: "alternative-sku",
                },
            ],
            internal_notes: "do not serialize",
        } as StoreListingSource & { internal_notes: string };

        const response = toStoreListingResponse(source);

        assert.deepEqual(
            response.child_skus?.map((sku) => sku.id),
            ["300000000000000002"],
        );
        assert.deepEqual(
            response.alternative_skus?.map((sku) => sku.id),
            ["300000000000000003"],
        );
        assert.equal((response as StoreListingResponse & { internal_notes?: unknown }).internal_notes, undefined);
    });

    test("declares source-backed metadata and generated artifacts for the exact owned path", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "store", "listings", "#store_listing_id.ts"), "utf8");
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonSchema>;
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            paths?: Record<
                string,
                {
                    get?: {
                        parameters?: { name?: string; in?: string; required?: boolean; schema?: JsonSchema }[];
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
                    hasQuery?: boolean;
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

        assert.match(routeSource, /summary:\s*"Get Store Listing"/);
        assert.match(routeSource, /description:\s*"Returns the locally backed store listing object for the given listing ID/s);
        assert.match(routeSource, /country_code:\s*\{\s*type:\s*"string"/s);
        assert.match(routeSource, /localize:\s*\{\s*type:\s*"boolean"/s);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"StoreListingResponse"/s);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /403:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);

        assert.equal(schemas.StoreListingResponse.type, "object");
        for (const field of ["id", "sku", "summary"]) {
            assert.equal(schemas.StoreListingResponse.required?.includes(field), true, `${field} should be required`);
        }
        assert.equal(schemas.StoreListingResponse.properties?.id?.type, "string");
        assert.equal(schemas.StoreListingResponse.properties?.sku?.$ref, "#/definitions/StoreSkuResponse");
        assert.equal(schemas.StoreListingResponse.properties?.child_skus?.items?.$ref, "#/definitions/StoreSkuResponse");

        const route = openapi.paths?.["/store/listings/{store_listing_id}/"]?.get;
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "store_listing_id" && parameter.in === "path" && parameter.required === true),
            true,
        );
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "country_code" && parameter.in === "query"),
            true,
        );
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "localize" && parameter.in === "query" && parameter.schema?.type === "boolean"),
            true,
        );
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/StoreListingResponse");
        for (const status of ["400", "401", "403", "404"]) {
            assert.equal(route?.responses?.[status]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        }
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.path, "/store/listings/:store_listing_id/");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/store/listings/#store_listing_id.ts");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("StoreListingResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 400, 401, 403, 404],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === assignedSourcePath);
        assert.equal(catalogEntry?.route_name, assignedRouteName);
        assert.equal(catalogEntry?.source, "src/api/routes/store/listings/#store_listing_id.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "StoreListingResponse"]);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === assignedPath && entry.route_name === assignedRouteName),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some(
                (entry) => entry.method === "PATCH" && entry.route === assignedPath && entry.route_name === "PATCH_STORE_LISTINGS_STORE_LISTING_ID",
            ),
            true,
        );

        const contract = contractTests.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.routeMetadata?.responses?.includes("StoreListingResponse"), true);
        assert.equal(contract?.routeMetadata?.responses?.includes("APIErrorResponse"), true);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [200, 400, 401, 403, 404]);
    });
});

type StoreListingProviderOptionsSnapshot = {
    store_listing_id: string;
    country_code?: string;
    localize: boolean;
};

const sampleSku: StoreSkuResponse = {
    id: "300000000000000001",
    type: 1,
    application_id: "100000000000000001",
    product_line: 6,
    flags: 4,
    name: "Example SKU",
    summary: "Example game item",
    slug: "example-sku",
    access_type: 1,
    features: [],
    premium: false,
    show_age_gate: false,
    created_at: "2025-08-05T20:53:39.133830+00:00",
    updated_at: "2025-08-05T20:53:39.135755+00:00",
};

const sampleListing: StoreListingSource = {
    id: "500000000000000001",
    summary: "Example listing",
    description: { default: "Example store listing" },
    tagline: null,
    flavor_text: null,
    published: true,
    sku: sampleSku,
    benefits: [{ id: "600000000000000001", name: "Benefit", description: "Example benefit", icon: { type: 2, emoji: "x" } }],
    carousel_items: [{ asset_id: "700000000000000001", label: "Preview" }],
    thumbnail: { id: "800000000000000001", size: 100, mime_type: "image/png", width: 640, height: 360 },
    published_at: "2025-08-05T20:53:39.133830+00:00",
    unpublished_at: null,
};

function isUnknownListingError(error: unknown): boolean {
    return (
        (error as { code?: unknown; message?: unknown })?.code === UNKNOWN_STORE_LISTING_ERROR.code &&
        (error as { code?: unknown; message?: unknown })?.message === UNKNOWN_STORE_LISTING_ERROR.message
    );
}

function applicationRepositoryFor(application: ApplicationCommandAuthorizationTarget | null): ApplicationCommandAuthorizationRepository {
    return {
        findOne: async () => application,
    };
}

function createRouteApp(dependencies: StoreListingRouteDependencies = {}) {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/store/listings/:store_listing_id", createStoreListingRouter(dependencies));
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp() {
    const app = express();

    app.use(Authentication);
    app.use("/store/listings/:store_listing_id", createStoreListingRouter());
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
