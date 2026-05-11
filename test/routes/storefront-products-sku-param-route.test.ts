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
import express from "express";
import {
    createStorefrontProductBySkuRouter,
    getConfiguredStorefrontProductBySku,
    getStorefrontProductBySku,
    isStorefrontProductSkuId,
    toStorefrontProductResponse,
    UNKNOWN_STOREFRONT_PRODUCT_ERROR,
    type StorefrontProductBySkuProvider,
    type StorefrontProductBySkuProviderOptions,
} from "../../src/api/routes/storefront/products/sku/#sku_id";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestIds = ["api:http:GET:/storefront/products/sku/:sku_id/"];
const assignedPath = "/storefront/products/sku/{param}";
const assignedSourcePath = "/storefront/products/sku/{sku_id}";
const assignedRouteName = "GET_STOREFRONT_PRODUCTS_SKU_SKU_ID";

type JsonSchema = {
    $ref?: string;
    type?: string | string[];
    required?: string[];
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
};

describe("GET /storefront/products/sku/:sku_id", () => {
    test("documents the assigned manifest id and stays behind bearer auth without exposing adjacent storefront product routes", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/storefront/products/sku/:sku_id/"]);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/storefront/products/sku/300000000000000002"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v10/storefront/products/sku/300000000000000002/"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/storefront/products/300000000000000001"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/storefront/products/skus?sku_ids=300000000000000002"), false);

        const response = await requestJson(createAuthenticatedApp(), "/storefront/products/sku/300000000000000002");

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("returns provider-backed storefront products by SKU ID", async () => {
        let receivedOptions: StorefrontProductBySkuProviderOptions | undefined;
        const sample = product();
        const provider: StorefrontProductBySkuProvider = (options) => {
            receivedOptions = options;
            return sample;
        };

        const response = await requestJson(createRouteApp(provider), "/storefront/products/sku/300000000000000002");

        assert.equal(response.status, 200);
        assert.deepEqual(receivedOptions, { sku_id: "300000000000000002" });
        assert.deepEqual(response.body, toStorefrontProductResponse(sample));
    });

    test("fails closed for malformed, missing, unbacked, or mismatched SKU IDs without fabricating storefront data", async () => {
        assert.equal(isStorefrontProductSkuId("300000000000000002"), true);
        assert.equal(isStorefrontProductSkuId("not-a-snowflake"), false);
        assert.equal(getConfiguredStorefrontProductBySku({ sku_id: "300000000000000002" }), undefined);
        assert.equal(UNKNOWN_STOREFRONT_PRODUCT_ERROR.httpStatus, 404);
        assert.equal(UNKNOWN_STOREFRONT_PRODUCT_ERROR.code, 10987);

        await assert.rejects(() => getStorefrontProductBySku("not-a-snowflake", () => product()), {
            code: UNKNOWN_STOREFRONT_PRODUCT_ERROR.code,
            message: UNKNOWN_STOREFRONT_PRODUCT_ERROR.message,
        });
        await assert.rejects(() => getStorefrontProductBySku("300000000000000002", () => undefined), {
            code: UNKNOWN_STOREFRONT_PRODUCT_ERROR.code,
            message: UNKNOWN_STOREFRONT_PRODUCT_ERROR.message,
        });
        await assert.rejects(() => getStorefrontProductBySku("300000000000000003", () => product()), {
            code: UNKNOWN_STOREFRONT_PRODUCT_ERROR.code,
            message: UNKNOWN_STOREFRONT_PRODUCT_ERROR.message,
        });

        const missingResponse = await requestJson(createRouteApp(), "/storefront/products/sku/300000000000000002");
        const invalidResponse = await requestJson(
            createRouteApp(() => product()),
            "/storefront/products/sku/not-a-snowflake",
        );
        const mismatchResponse = await requestJson(
            createRouteApp(() => product()),
            "/storefront/products/sku/300000000000000003",
        );

        for (const response of [missingResponse, invalidResponse, mismatchResponse]) {
            assert.equal(response.status, 404);
            assert.deepEqual(response.body, {
                code: UNKNOWN_STOREFRONT_PRODUCT_ERROR.code,
                message: UNKNOWN_STOREFRONT_PRODUCT_ERROR.message,
            });
        }
    });

    test("declares source-backed metadata and generated artifacts for the exact owned path", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "storefront", "products", "sku", "#sku_id.ts"), "utf8");
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

        assert.match(routeSource, /summary:\s*"Get Storefront Product By SKU ID"/);
        assert.match(routeSource, /description:\s*"Returns the locally backed storefront product object associated with the given SKU ID\."/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"StorefrontProductResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);

        assert.equal(schemas.StorefrontProductResponse.type, "object");
        assert.equal(schemas.StorefrontProductResponse.properties?.skus?.items?.$ref, "#/definitions/StorefrontProductSku");
        assert.equal(schemas.StorefrontProductSku.properties?.selected_options?.items?.$ref, "#/definitions/StorefrontProductSkuOption");
        assert.equal(schemas.StorefrontProductSku.properties?.tenant_metadata?.$ref, "#/definitions/StorefrontProductSkuTenantMetadata");

        const route = openapi.paths?.["/storefront/products/sku/{sku_id}/"]?.get;
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "sku_id" && parameter.in === "path" && parameter.required === true),
            true,
        );
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/StorefrontProductResponse");
        for (const status of ["401", "404"]) {
            assert.equal(route?.responses?.[status]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        }
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.equal(openapi.components?.schemas?.StorefrontProductResponse?.required?.includes("skus"), true);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.path, "/storefront/products/sku/:sku_id/");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/storefront/products/sku/#sku_id.ts");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, false);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("StorefrontProductResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401, 404],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === assignedSourcePath);
        assert.equal(catalogEntry?.route_name, assignedRouteName);
        assert.equal(catalogEntry?.source, "src/api/routes/storefront/products/sku/#sku_id.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "StorefrontProductResponse"]);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === assignedPath && entry.route_name === assignedRouteName),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/storefront/products/skus"),
            true,
        );

        const contract = contractTests.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse", "StorefrontProductResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [200, 401, 404]);
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

function createRouteApp(productProvider: StorefrontProductBySkuProvider = getConfiguredStorefrontProductBySku) {
    const app = express();

    app.use("/storefront/products/sku/:sku_id", createStorefrontProductBySkuRouter(productProvider));
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp() {
    const app = express();

    app.use(Authentication);
    app.use("/storefront/products/sku/:sku_id", createStorefrontProductBySkuRouter());
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
