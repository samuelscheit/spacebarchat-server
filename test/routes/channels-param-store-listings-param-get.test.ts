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
import { describe, test, type TestContext } from "node:test";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "@spacebar/api";
import { ChannelType, type StoreSkuResponse } from "@spacebar/schemas";
import { DiscordApiErrors, Permissions } from "@spacebar/util";
import express from "express";
import {
    createChannelStoreListingSkuRouter,
    getChannelStoreListingSku,
    getConfiguredChannelStoreListingSku,
    type ChannelStoreListingSkuProvider,
    type ChannelStoreListingSkuProviderOptions,
    type ChannelStoreListingSkuRouteDependencies,
} from "../../src/api/routes/channels/#channel_id/store-listings/#sku_id";
import { parseStoreSkuQuery, UNKNOWN_STORE_SKU_ERROR } from "../../src/api/util/utility/StoreSkuRoute";
import { toStoreListingResponse, UNKNOWN_STORE_LISTING_ERROR, type StoreListingSource } from "../../src/api/routes/store/listings/#store_listing_id";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const requireModule = require;
const coveredManifestIds = ["api:http:GET:/channels/:channel_id/store-listings/:sku_id/"];
const assignedPath = "/channels/{param}/store-listings/{param}";
const assignedSourcePath = "/channels/{channel_id}/store-listings/{sku_id}";
const assignedRouteName = "GET_CHANNELS_CHANNEL_ID_STORE_LISTINGS_SKU_ID";

type JsonSchema = {
    $ref?: string;
    type?: string | string[];
    required?: string[];
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
};

describe("GET /channels/:channel_id/store-listings/:sku_id", () => {
    test("documents the assigned manifest id and stays behind bearer auth", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/channels/:channel_id/store-listings/:sku_id/"]);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/channels/200000000000000001/store-listings/300000000000000001?country_code=DE"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v10/channels/200000000000000001/store-listings/300000000000000001/"), false);

        const response = await requestJson(createAuthenticatedApp(), "/channels/200000000000000001/store-listings/300000000000000001");

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("requires a guild store channel and returns provider-backed listings for the requested SKU", async (t) => {
        mockViewChannelPermission(t);

        let receivedOptions: ChannelStoreListingSkuProviderOptions | undefined;
        const listingProvider: ChannelStoreListingSkuProvider = (options) => {
            receivedOptions = options;
            return sampleListing;
        };

        assert.deepEqual(parseStoreSkuQuery({ country_code: ["DE"], localize: ["0"] } as never), {
            country_code: "DE",
            localize: false,
        });

        const response = await requestJson(
            createRouteApp({
                listingProvider,
                channelRepository: channelRepositoryFor(ChannelType.GUILD_STORE),
            }),
            "/channels/200000000000000001/store-listings/300000000000000001?country_code=DE&localize=false",
        );

        assert.equal(response.status, 200);
        assert.deepEqual(receivedOptions, {
            channel_id: "200000000000000001",
            guild_id: "900000000000000001",
            sku_id: "300000000000000001",
            country_code: "DE",
            localize: false,
        });
        assert.deepEqual(response.body, toStoreListingResponse(sampleListing));
    });

    test("fails closed for malformed SKU ids, non-store channels, missing listings, and mismatched listings", async (t) => {
        mockViewChannelPermission(t);

        assert.deepEqual(
            getConfiguredChannelStoreListingSku({
                channel_id: "200000000000000001",
                guild_id: "900000000000000001",
                sku_id: "300000000000000001",
                localize: true,
            }),
            undefined,
        );

        await assert.rejects(
            () =>
                getChannelStoreListingSku(
                    "200000000000000001",
                    "not-a-sku",
                    { localize: true },
                    {
                        channelRepository: channelRepositoryFor(ChannelType.GUILD_STORE),
                        listingProvider: () => sampleListing,
                    },
                ),
            { code: UNKNOWN_STORE_SKU_ERROR.code },
        );

        await assert.rejects(
            () =>
                getChannelStoreListingSku(
                    "200000000000000001",
                    "300000000000000001",
                    { localize: true },
                    {
                        channelRepository: channelRepositoryFor(ChannelType.GUILD_TEXT),
                        listingProvider: () => sampleListing,
                    },
                ),
            { code: DiscordApiErrors.CANNOT_EXECUTE_ON_THIS_CHANNEL_TYPE.code },
        );

        await assert.rejects(
            () =>
                getChannelStoreListingSku(
                    "200000000000000001",
                    "300000000000000001",
                    { localize: true },
                    {
                        channelRepository: channelRepositoryFor(ChannelType.GUILD_STORE),
                        listingProvider: () => undefined,
                    },
                ),
            isUnknownListingError,
        );

        const invalidSku = await requestJson(
            createRouteApp({
                channelRepository: channelRepositoryFor(ChannelType.GUILD_STORE),
                listingProvider: () => sampleListing,
            }),
            "/channels/200000000000000001/store-listings/not-a-sku",
        );
        const wrongType = await requestJson(
            createRouteApp({
                channelRepository: channelRepositoryFor(ChannelType.GUILD_TEXT),
                listingProvider: () => sampleListing,
            }),
            "/channels/200000000000000001/store-listings/300000000000000001",
        );
        const missingListing = await requestJson(
            createRouteApp({
                channelRepository: channelRepositoryFor(ChannelType.GUILD_STORE),
            }),
            "/channels/200000000000000001/store-listings/300000000000000001",
        );
        const mismatchedListing = await requestJson(
            createRouteApp({
                channelRepository: channelRepositoryFor(ChannelType.GUILD_STORE),
                listingProvider: () => ({
                    ...sampleListing,
                    sku: { ...sampleSku, id: "300000000000000002" },
                }),
            }),
            "/channels/200000000000000001/store-listings/300000000000000001",
        );

        assert.equal(invalidSku.status, 404);
        assert.deepEqual(invalidSku.body, {
            code: UNKNOWN_STORE_SKU_ERROR.code,
            message: UNKNOWN_STORE_SKU_ERROR.message,
        });
        assert.equal(wrongType.status, 400);
        assert.deepEqual(wrongType.body, {
            code: DiscordApiErrors.CANNOT_EXECUTE_ON_THIS_CHANNEL_TYPE.code,
            message: DiscordApiErrors.CANNOT_EXECUTE_ON_THIS_CHANNEL_TYPE.message,
        });
        assert.equal(missingListing.status, 404);
        assert.deepEqual(missingListing.body, {
            code: UNKNOWN_STORE_LISTING_ERROR.code,
            message: UNKNOWN_STORE_LISTING_ERROR.message,
        });
        assert.equal(mismatchedListing.status, 404);
        assert.deepEqual(mismatchedListing.body, {
            code: UNKNOWN_STORE_LISTING_ERROR.code,
            message: UNKNOWN_STORE_LISTING_ERROR.message,
        });
    });

    test("rejects malformed localization query booleans", async (t) => {
        mockViewChannelPermission(t);

        assert.throws(() => parseStoreSkuQuery({ localize: "sometimes" } as never), {
            code: DiscordApiErrors.INVALID_FORM_BODY.code,
        });

        const response = await requestJson(
            createRouteApp({
                channelRepository: channelRepositoryFor(ChannelType.GUILD_STORE),
                listingProvider: () => sampleListing,
            }),
            "/channels/200000000000000001/store-listings/300000000000000001?localize=sometimes",
        );

        assert.equal(response.status, 400);
        assert.equal((response.body as { code?: unknown }).code, DiscordApiErrors.INVALID_FORM_BODY.code);
    });

    test("declares source-backed metadata and generated artifacts for the exact owned path", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "channels", "#channel_id", "store-listings", "#sku_id.ts"), "utf8");
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonSchema>;
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            paths?: Record<
                string,
                {
                    get?: {
                        summary?: string;
                        "x-permission-required"?: string;
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
                    permission?: string;
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
                    permission?: string;
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
        };

        assert.match(routeSource, /permission:\s*"VIEW_CHANNEL"/);
        assert.match(routeSource, /summary:\s*"Get Channel Store Listing SKU"/);
        assert.match(routeSource, /description:\s*"Returns the locally backed store listing object for a SKU available through a guild store channel/s);
        assert.match(routeSource, /country_code:\s*\{\s*type:\s*"string"/s);
        assert.match(routeSource, /localize:\s*\{\s*type:\s*"boolean"/s);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"StoreListingResponse"/s);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /403:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);

        assert.equal(schemas.StoreListingResponse.type, "object");
        assert.equal(schemas.StoreListingResponse.properties?.sku?.$ref, "#/definitions/StoreSkuResponse");

        const route = openapi.paths?.["/channels/{channel_id}/store-listings/{sku_id}/"]?.get;
        assert.equal(route?.summary, "Get Channel Store Listing SKU");
        assert.equal(route?.["x-permission-required"], "VIEW_CHANNEL");
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "channel_id" && parameter.in === "path" && parameter.required === true),
            true,
        );
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "sku_id" && parameter.in === "path" && parameter.required === true),
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

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.path, "/channels/:channel_id/store-listings/:sku_id/");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/channels/#channel_id/store-listings/#sku_id.ts");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.permission, "VIEW_CHANNEL");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("StoreListingResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 400, 401, 403, 404],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === assignedSourcePath);
        assert.equal(catalogEntry?.route_name, assignedRouteName);
        assert.equal(catalogEntry?.source, "src/api/routes/channels/#channel_id/store-listings/#sku_id.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "StoreListingResponse"]);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === assignedPath && entry.route_name === "CHANNEL_STORE_LISTING_SKU"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === "/channels/{param}/store-listing/entitlement-grant"),
            true,
        );

        const contract = contractTests.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.routeMetadata?.permission, "VIEW_CHANNEL");
        assert.equal(contract?.routeMetadata?.responses?.includes("StoreListingResponse"), true);
        assert.equal(contract?.routeMetadata?.responses?.includes("APIErrorResponse"), true);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [200, 400, 401, 403, 404]);
    });
});

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
    summary: "Example channel listing",
    description: { default: "Example channel store listing" },
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

function channelRepositoryFor(type: ChannelType) {
    return {
        findOneOrFail: async () => ({
            id: "200000000000000001",
            guild_id: "900000000000000001",
            type,
        }),
    };
}

function mockViewChannelPermission(t: TestContext) {
    const permissionsModule = requireModule("@spacebar/util/util/Permissions") as typeof import("../../src/util/util/Permissions");

    t.mock.method(permissionsModule, "getPermission", async () => new Permissions(Permissions.FLAGS.VIEW_CHANNEL));
}

function createRouteApp(dependencies: ChannelStoreListingSkuRouteDependencies = {}) {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = "viewer";
        req.permission = new Permissions(Permissions.FLAGS.VIEW_CHANNEL);
        next();
    });
    app.use("/channels/:channel_id/store-listings/:sku_id", createChannelStoreListingSkuRouter(dependencies));
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp() {
    const app = express();

    app.use(Authentication);
    app.use("/channels/:channel_id/store-listings/:sku_id", createChannelStoreListingSkuRouter());
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
