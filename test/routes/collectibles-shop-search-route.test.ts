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
import express from "express";
import type { CollectiblesCategory, CollectiblesCategoryProduct, CollectiblesSearchResponse } from "@spacebar/schemas";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../src/api/middlewares";
import {
    createCollectiblesSearchRouter,
    getCollectiblesSearchCatalog,
    parseCollectiblesSearchQuery,
    searchCollectiblesCatalog,
    type CollectiblesSearchCatalogProvider,
    type CollectiblesSearchQueryOptions,
} from "../../src/api/routes/shop/search";

const coveredManifestIds = ["api:http:GET:/shop/search/"];
const assignedSourcePath = "/shop/search";
const assignedRouteName = "GET_SHOP_SEARCH";

type JsonSchema = {
    $ref?: string;
    type?: string | string[];
    required?: string[];
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
};

function product(overrides: Partial<CollectiblesCategoryProduct> = {}): CollectiblesCategoryProduct {
    return {
        sku_id: "profile-sku",
        name: "Orb Profile Effect",
        summary: "A profile effect with a glow",
        store_listing_id: "product-listing",
        banner: "product-banner",
        unpublished_at: null,
        styles: {
            background_colors: [16777215],
            button_colors: [0],
            confetti_colors: [255],
        },
        prices: {
            usd: {
                country_prices: {
                    country_code: "US",
                    prices: [{ amount: 499, currency: "USD", exponent: 2 }],
                },
            },
        },
        items: [{ type: 1, id: "effect-item", sku_id: "profile-sku", label: "Glow" }],
        type: 1,
        premium_type: 0,
        category_sku_id: "category-sku",
        google_sku_ids: {
            "1": "google-sku",
        },
        ...overrides,
    };
}

function category(products: CollectiblesCategoryProduct[]): CollectiblesCategory {
    return {
        sku_id: "category-sku",
        name: "Spring drops",
        summary: "Seasonal profile collectibles",
        store_listing_id: "category-listing",
        banner: "banner-asset",
        unpublished_at: null,
        styles: {
            background_colors: [16777215],
            button_colors: [0],
            confetti_colors: [255],
        },
        logo: "logo-asset",
        hero_ranking: ["variant-sku", "profile-sku", "avatar-sku"],
        mobile_bg: null,
        pdp_bg: null,
        success_modal_bg: null,
        mobile_banner: null,
        featured_block: null,
        hero_banner: null,
        wide_banner: null,
        hero_logo: null,
        products,
    };
}

function createRouteApp(catalogProvider?: CollectiblesSearchCatalogProvider) {
    const app = express();
    app.use("/shop/search", createCollectiblesSearchRouter(catalogProvider));
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp() {
    const app = express();
    app.use(Authentication);
    app.use("/shop/search", createCollectiblesSearchRouter());
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

describe("GET /shop/search", () => {
    test("documents the assigned manifest id and stays behind bearer auth", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/shop/search/"]);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/shop/search?search=effect"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v10/shop/search/"), false);

        const response = await requestJson(createAuthenticatedApp(), "/shop/search");

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("parses documented query fields and returns provider-backed SKU pagination", async () => {
        const products = [
            product({
                variants: [
                    {
                        sku_id: "variant-sku",
                        name: "Blue Orb",
                        name_localizations: null,
                        summary: "A blue profile effect",
                        summary_localizations: null,
                        store_listing_id: "variant-listing",
                        prices: {},
                        items: [{ type: 1, id: "variant-item", sku_id: "variant-sku" }],
                        type: 1,
                        premium_type: 0,
                        category_sku_id: "category-sku",
                        base_variant_sku_id: "profile-sku",
                        base_variant_name: "Orb Profile Effect",
                        variant_label: "Color",
                        variant_value: "#0000ff",
                    },
                ],
            }),
            product({
                sku_id: "avatar-sku",
                name: "Avatar Decoration",
                summary: "A frame",
                items: [{ type: 0, id: "avatar-item", sku_id: "avatar-sku" }],
                type: 0,
            }),
        ];
        let receivedOptions: CollectiblesSearchQueryOptions | undefined;
        const app = createRouteApp((options) => {
            receivedOptions = options;
            return [category(products)];
        });

        const response = await requestJson(app, "/shop/search?item_types=PROFILE_EFFECT&search=orb&offset=1&limit=1&sort_type=alphabetical&sort_direction=asc");

        assert.equal(response.status, 200);
        assert.deepEqual(receivedOptions, {
            item_types: ["PROFILE_EFFECT"],
            colors: [],
            themes: [],
            orbs_eligible: undefined,
            offset: 1,
            limit: 1,
            sort_type: "alphabetical",
            sort_direction: "asc",
            search: "orb",
        });
        assert.deepEqual(response.body, {
            pagination: {
                offset: 1,
                limit: 1,
                total: 2,
                has_more: false,
            },
            skus: ["profile-sku"],
        });
    });

    test("returns an empty source-compatible payload without fabricating Discord collectibles", async () => {
        const parsed = parseCollectiblesSearchQuery({
            item_types: ["PROFILE_EFFECT,BUNDLE"],
            "colors[]": ["blue"],
            themes: "fantasy",
            orbs_eligible: "true",
            offset: "invalid",
            limit: "999",
            sort_type: "unsupported",
            sort_direction: "sideways",
            search: "x".repeat(257),
        } as never);

        assert.deepEqual(parsed, {
            item_types: ["PROFILE_EFFECT", "BUNDLE"],
            colors: ["blue"],
            themes: ["fantasy"],
            orbs_eligible: true,
            offset: 0,
            limit: 100,
            sort_type: undefined,
            sort_direction: "desc",
            search: undefined,
        });
        assert.deepEqual(getCollectiblesSearchCatalog(parsed), []);
        assert.deepEqual(searchCollectiblesCatalog([category([product()])], parsed), {
            pagination: {
                offset: 0,
                limit: 100,
                total: 0,
                has_more: false,
            },
            skus: [],
        });

        const response = await requestJson(createRouteApp(), "/shop/search?search=effect");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            pagination: {
                offset: 0,
                limit: 20,
                total: 0,
                has_more: false,
            },
            skus: [],
        } satisfies CollectiblesSearchResponse);
    });

    test("declares source-backed metadata and generated artifacts for the exact owned path", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "shop", "search.ts"), "utf8");
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonSchema>;
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            paths?: Record<
                string,
                {
                    get?: {
                        parameters?: { name?: string; in?: string; schema?: JsonSchema }[];
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

        assert.match(routeSource, /summary:\s*"Search Collectibles"/);
        for (const queryField of ["item_types", "colors", "themes", "orbs_eligible", "offset", "limit", "sort_type", "sort_direction", "search"]) {
            assert.match(routeSource, new RegExp(`${queryField}:\\s*\\{`));
        }
        assert.match(routeSource, /200:\s*\{\s*body:\s*"CollectiblesSearchResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);

        assert.equal(schemas.CollectiblesSearchResponse.type, "object");
        assert.deepEqual(schemas.CollectiblesSearchResponse.required?.sort(), ["pagination", "skus"]);
        assert.equal(schemas.CollectiblesSearchResponse.properties?.pagination?.$ref, "#/definitions/CollectiblesSearchPagination");
        assert.equal(schemas.CollectiblesSearchResponse.properties?.skus?.items?.type, "string");
        assert.deepEqual(schemas.CollectiblesSearchPagination.required?.sort(), ["has_more", "limit", "offset", "total"]);
        assert.equal(schemas.CollectiblesSearchPagination.properties?.has_more?.type, "boolean");

        const route = openapi.paths?.["/shop/search/"]?.get;
        for (const queryField of ["item_types", "colors", "themes", "orbs_eligible", "offset", "limit", "sort_type", "sort_direction", "search"]) {
            assert.equal(
                route?.parameters?.some((parameter) => parameter.in === "query" && parameter.name === queryField),
                true,
                `${queryField} should be documented as a query parameter`,
            );
        }
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "item_types" && parameter.schema?.type === "array"),
            true,
        );
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/CollectiblesSearchResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.path, "/shop/search/");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/shop/search.ts");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("CollectiblesSearchResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === assignedSourcePath);
        assert.equal(catalogEntry?.route_name, assignedRouteName);
        assert.equal(catalogEntry?.source, "src/api/routes/shop/search.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "CollectiblesSearchResponse"]);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === assignedSourcePath && entry.route_name === assignedRouteName),
            false,
        );

        const contract = contractTests.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.routeMetadata?.responses?.includes("CollectiblesSearchResponse"), true);
        assert.equal(contract?.routeMetadata?.responses?.includes("APIErrorResponse"), true);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [200, 401]);
    });
});
