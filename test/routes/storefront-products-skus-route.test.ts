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
import type { StorefrontProductResponse } from "@spacebar/schemas";
import { DiscordApiErrors } from "@spacebar/util";
import express from "express";
import {
    createStorefrontProductsBySkuRouter,
    getConfiguredStorefrontProductsBySku,
    getStorefrontProductsBySku,
    parseStorefrontProductsBySkuQuery,
    toStorefrontProductsBySkuResponse,
    toStorefrontProductResponse,
    type StorefrontProductsBySkuProvider,
    type StorefrontProductsBySkuQueryOptions,
} from "../../src/api/routes/storefront/products/skus";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestIds = ["api:http:GET:/storefront/products/skus/"];
const assignedPath = "/storefront/products/skus";
const assignedRouteName = "GET_STOREFRONT_PRODUCTS_SKUS";

type JsonSchema = {
    $ref?: string;
    type?: string | string[];
    required?: string[];
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
};

describe("GET /storefront/products/skus", () => {
    test("documents the assigned manifest id and stays behind bearer auth without exposing adjacent storefront product routes", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/storefront/products/skus/"]);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/storefront/products/skus?sku_ids=300000000000000002"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v10/storefront/products/skus/?sku_ids=300000000000000002"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/storefront/products/300000000000000001"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/storefront/products/sku/300000000000000002"), false);

        const response = await requestJson(createAuthenticatedApp(), "/storefront/products/skus?sku_ids=300000000000000002");

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("parses documented SKU ID query forms and returns provider-backed storefront products", async () => {
        let receivedOptions: StorefrontProductsBySkuQueryOptions | undefined;
        const standardProduct = product();
        const deluxeProduct = product({
            id: "300000000000000003",
            sku_ids: ["300000000000000004"],
            skus: [
                {
                    ...product().skus[0]!,
                    id: "300000000000000004",
                    product_id: "300000000000000003",
                    name: "Deluxe Powerup",
                    slug: "deluxe-powerup",
                    position: 2,
                },
            ],
            name: "Deluxe Game Server Powerup",
        });
        const provider: StorefrontProductsBySkuProvider = (options) => {
            receivedOptions = options;
            return [standardProduct, deluxeProduct];
        };

        assert.deepEqual(
            parseStorefrontProductsBySkuQuery({
                sku_ids: ["300000000000000002,300000000000000004"],
                "sku_ids[]": ["300000000000000002"],
            } as never),
            {
                sku_ids: ["300000000000000002", "300000000000000004"],
            },
        );

        const response = await requestJson(createRouteApp(provider), "/storefront/products/skus?sku_ids=300000000000000002&sku_ids[]=300000000000000004");

        assert.equal(response.status, 200);
        assert.deepEqual(receivedOptions, {
            sku_ids: ["300000000000000002", "300000000000000004"],
        });
        assert.deepEqual(response.body, {
            products: [toStorefrontProductResponse(standardProduct), toStorefrontProductResponse(deluxeProduct)],
        });
    });

    test("returns only locally backed products that include requested SKUs", async () => {
        const matchingProduct = product();
        const mismatchedProduct = product({
            id: "300000000000000005",
            sku_ids: ["300000000000000006"],
            skus: [
                {
                    ...product().skus[0]!,
                    id: "300000000000000006",
                    product_id: "300000000000000005",
                },
            ],
        });

        assert.deepEqual(getConfiguredStorefrontProductsBySku({ sku_ids: ["300000000000000002"] }), []);

        const response = await getStorefrontProductsBySku({ sku_ids: ["300000000000000002"] }, () => [matchingProduct, mismatchedProduct, matchingProduct]);

        assert.deepEqual(response, {
            products: [toStorefrontProductResponse(matchingProduct)],
        });
        assert.notEqual(
            await getStorefrontProductsBySku({ sku_ids: ["300000000000000002"] }),
            await getStorefrontProductsBySku({ sku_ids: ["300000000000000002"] }),
            "callers should receive a fresh response object",
        );

        const routeResponse = await requestJson(createRouteApp(), "/storefront/products/skus?sku_ids=300000000000000002");

        assert.equal(routeResponse.status, 200);
        assert.deepEqual(routeResponse.body, { products: [] });
    });

    test("clones product responses without leaking provider internals", () => {
        const source = product() as StorefrontProductResponse & { internal_notes?: string };
        source.internal_notes = "do not leak";

        const response = toStorefrontProductsBySkuResponse([source], ["300000000000000002"]);

        assert.deepEqual(Object.keys(response), ["products"]);
        assert.equal((response.products[0] as StorefrontProductResponse & { internal_notes?: unknown }).internal_notes, undefined);
        assert.deepEqual(response.products[0]?.sku_ids, ["300000000000000002"]);

        source.sku_ids.push("300000000000000099");
        source.skus[0]?.tenant_metadata.plan_features.push({ title: "Mutated", description: "Should not appear" });

        assert.deepEqual(response.products[0]?.sku_ids, ["300000000000000002"]);
        assert.deepEqual(response.products[0]?.skus[0]?.tenant_metadata.plan_features, [{ title: "Slots", description: "More player slots" }]);
    });

    test("rejects missing, malformed, or over-limit SKU ID query fields", async () => {
        assert.throws(() => parseStorefrontProductsBySkuQuery({} as never), {
            code: DiscordApiErrors.INVALID_FORM_BODY.code,
        });
        assert.throws(() => parseStorefrontProductsBySkuQuery({ sku_ids: "not-a-snowflake" } as never), {
            code: DiscordApiErrors.INVALID_FORM_BODY.code,
        });
        assert.throws(() => parseStorefrontProductsBySkuQuery({ sku_ids: "000000000000000000" } as never), {
            code: DiscordApiErrors.INVALID_FORM_BODY.code,
        });
        assert.throws(
            () =>
                parseStorefrontProductsBySkuQuery({
                    sku_ids: Array.from({ length: 101 }, (_, index) => `300000000000000${String(index).padStart(3, "0")}`),
                } as never),
            {
                code: DiscordApiErrors.INVALID_FORM_BODY.code,
            },
        );

        const response = await requestJson(createRouteApp(), "/storefront/products/skus");

        assert.equal(response.status, 400);
        assert.equal((response.body as { code?: unknown }).code, DiscordApiErrors.INVALID_FORM_BODY.code);
    });

    test("declares source-backed metadata and generated artifacts for the exact owned path", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "storefront", "products", "skus.ts"), "utf8");
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonSchema>;
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            components?: {
                schemas?: Record<string, JsonSchema>;
            };
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

        assert.match(routeSource, /summary:\s*"Get Storefront Products By SKU ID"/);
        assert.match(routeSource, /description:\s*"Returns locally backed storefront product objects associated with the requested SKU IDs\."/);
        assert.match(routeSource, /sku_ids:\s*\{\s*type:\s*"array",\s*required:\s*true/s);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"StorefrontProductsBySkuResponse"/s);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);

        assert.equal(schemas.StorefrontProductsBySkuResponse.type, "object");
        assert.deepEqual(schemas.StorefrontProductsBySkuResponse.required, ["products"]);
        assert.equal(schemas.StorefrontProductsBySkuResponse.properties?.products?.type, "array");
        assert.equal(schemas.StorefrontProductsBySkuResponse.properties?.products?.items?.$ref, "#/definitions/StorefrontProductResponse");
        assert.equal(schemas.StorefrontProductResponse.properties?.skus?.items?.$ref, "#/definitions/StorefrontProductSku");

        const route = openapi.paths?.["/storefront/products/skus/"]?.get;
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "sku_ids" && parameter.in === "query" && parameter.required === true),
            true,
        );
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/StorefrontProductsBySkuResponse");
        for (const status of ["400", "401"]) {
            assert.equal(route?.responses?.[status]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        }
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.equal(openapi.components?.schemas?.StorefrontProductsBySkuResponse?.properties?.products?.items?.$ref, "#/components/schemas/StorefrontProductResponse");

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.path, "/storefront/products/skus/");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/storefront/products/skus.ts");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("StorefrontProductsBySkuResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 400, 401],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === assignedPath);
        assert.equal(catalogEntry?.route_name, assignedRouteName);
        assert.equal(catalogEntry?.source, "src/api/routes/storefront/products/skus.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "StorefrontProductsBySkuResponse"]);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === assignedPath && entry.route_name === assignedRouteName),
            false,
        );

        const contract = contractTests.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse", "StorefrontProductsBySkuResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [200, 400, 401]);
    });
});

function product(overrides: Partial<StorefrontProductResponse> = {}): StorefrontProductResponse {
    return {
        id: "300000000000000001",
        application_id: "100000000000000001",
        sku_ids: ["300000000000000002"],
        skus: [
            {
                id: "300000000000000002",
                type: 5,
                product_line: 13,
                application_id: "100000000000000001",
                name: "Standard Powerup",
                thumbnail_asset_id: null,
                slug: "standard-powerup",
                premium: false,
                selected_options: [{ option_name: "Tier", option_value: "Standard" }],
                product_id: "300000000000000001",
                position: 1,
                tenant_metadata: {
                    boost_price: 2,
                    purchase_limit: 1,
                    category_type: "game_server",
                    plan_features: [{ title: "Slots", description: "More player slots" }],
                },
            },
        ],
        name: "Game Server Powerup",
        options: [{ name: "Tier", option_values: ["Standard"] }],
        created_at: "2026-05-01T00:00:00.000000+00:00",
        updated_at: "2026-05-02T00:00:00.000000+00:00",
        tenant_metadata: {
            guild_monetization: {
                game_server: {
                    instructions: {
                        pc: ["Join from the game menu"],
                    },
                    deactivation_cooldown_period_days: 7,
                    game_application_id: "200000000000000001",
                    provider: "example",
                    disabled: false,
                    early_access: false,
                    can_market: true,
                },
            },
        },
        ...overrides,
    };
}

function createRouteApp(productProvider: StorefrontProductsBySkuProvider = getConfiguredStorefrontProductsBySku) {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/storefront/products/skus", createStorefrontProductsBySkuRouter(productProvider));
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp() {
    const app = express();

    app.use(Authentication);
    app.use("/storefront/products/skus", createStorefrontProductsBySkuRouter());
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
