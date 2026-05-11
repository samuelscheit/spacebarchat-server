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
import type { StorefrontSkuPrice } from "@spacebar/schemas";
import { DiscordApiErrors } from "@spacebar/util";
import express from "express";
import {
    createStorefrontSkuPricesRouter,
    getConfiguredStorefrontSkuPrices,
    getStorefrontSkuPrices,
    isStorefrontSkuPriceSkuId,
    parseStorefrontSkuPricesQuery,
    toStorefrontSkuPricesResponse,
    type StorefrontSkuPriceMap,
    type StorefrontSkuPricesProvider,
    type StorefrontSkuPricesQueryOptions,
} from "../../src/api/routes/storefront/skus/prices";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestIds = ["api:http:GET:/storefront/skus/prices/"];
const assignedPath = "/storefront/skus/prices";
const assignedRouteName = "GET_STOREFRONT_SKUS_PRICES";

type JsonSchema = {
    $ref?: string;
    additionalProperties?: boolean | JsonSchema;
    type?: string | string[];
    required?: string[];
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
};

describe("GET /storefront/skus/prices", () => {
    test("documents the assigned manifest id and stays behind bearer auth without exposing adjacent storefront routes", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/storefront/skus/prices/"]);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/storefront/skus/prices?sku_ids=300000000000000002"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v10/storefront/skus/prices/?sku_ids=300000000000000002"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/storefront/products/skus?sku_ids=300000000000000002"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/storefront/products/sku/300000000000000002"), false);

        const response = await requestJson(createAuthenticatedApp(), "/storefront/skus/prices?sku_ids=300000000000000002");

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("parses documented SKU ID query forms and returns provider-backed prices", async () => {
        let receivedOptions: StorefrontSkuPricesQueryOptions | undefined;
        const provider: StorefrontSkuPricesProvider = (options) => {
            receivedOptions = options;
            return {
                "300000000000000002": price(),
                "300000000000000004": price({
                    country_prices: {
                        country_code: "DE",
                        prices: [{ currency: "eur", amount: 899, exponent: 2 }],
                    },
                    payment_source_prices: {},
                }),
            };
        };

        assert.deepEqual(
            parseStorefrontSkuPricesQuery({
                sku_ids: ["300000000000000002,300000000000000004"],
                "sku_ids[]": ["300000000000000002"],
            } as never),
            {
                sku_ids: ["300000000000000002", "300000000000000004"],
            },
        );

        const response = await requestJson(createRouteApp(provider), "/storefront/skus/prices?sku_ids=300000000000000002&sku_ids[]=300000000000000004");

        assert.equal(response.status, 200);
        assert.deepEqual(receivedOptions, {
            sku_ids: ["300000000000000002", "300000000000000004"],
        });
        assert.deepEqual(response.body, {
            sku_prices: {
                "300000000000000002": price(),
                "300000000000000004": price({
                    country_prices: {
                        country_code: "DE",
                        prices: [{ currency: "eur", amount: 899, exponent: 2 }],
                    },
                    payment_source_prices: {},
                }),
            },
        });
    });

    test("returns only locally backed prices without fabricating storefront catalog data", async () => {
        const query: StorefrontSkuPricesQueryOptions = { sku_ids: ["300000000000000002"] };

        assert.deepEqual(getConfiguredStorefrontSkuPrices(query), {});

        const response = await getStorefrontSkuPrices(query, () => ({
            "300000000000000002": price(),
            "300000000000000003": price(),
        }));

        assert.deepEqual(response, {
            sku_prices: {
                "300000000000000002": price(),
            },
        });
        assert.notEqual(await getStorefrontSkuPrices(query), await getStorefrontSkuPrices(query), "callers should receive a fresh response object");

        const routeResponse = await requestJson(createRouteApp(), "/storefront/skus/prices?sku_ids=300000000000000002");

        assert.equal(routeResponse.status, 200);
        assert.deepEqual(routeResponse.body, { sku_prices: {} });
    });

    test("clones price responses without leaking provider internals", () => {
        const sourcePrice = price() as StorefrontSkuPrice & { internal_notes?: string };
        sourcePrice.internal_notes = "do not leak";
        const prices: StorefrontSkuPriceMap = {
            "300000000000000002": sourcePrice,
        };

        const response = toStorefrontSkuPricesResponse(prices, ["300000000000000002"]);

        assert.deepEqual(Object.keys(response), ["sku_prices"]);
        assert.equal((response.sku_prices["300000000000000002"] as StorefrontSkuPrice & { internal_notes?: unknown }).internal_notes, undefined);
        assert.deepEqual(response.sku_prices["300000000000000002"], price());

        sourcePrice.country_prices?.prices.push({ currency: "usd", amount: 1, exponent: 2 });
        sourcePrice.payment_source_prices?.["700000000000000001"]?.push({ currency: "usd", amount: 1, exponent: 2 });

        assert.deepEqual(response.sku_prices["300000000000000002"], price());
    });

    test("rejects missing, malformed, or over-limit SKU ID query fields", async () => {
        assert.equal(isStorefrontSkuPriceSkuId("300000000000000002"), true);
        assert.equal(isStorefrontSkuPriceSkuId("not-a-snowflake"), false);

        assert.throws(() => parseStorefrontSkuPricesQuery({} as never), {
            code: DiscordApiErrors.INVALID_FORM_BODY.code,
        });
        assert.throws(() => parseStorefrontSkuPricesQuery({ sku_ids: "not-a-snowflake" } as never), {
            code: DiscordApiErrors.INVALID_FORM_BODY.code,
        });
        assert.throws(() => parseStorefrontSkuPricesQuery({ sku_ids: "000000000000000000" } as never), {
            code: DiscordApiErrors.INVALID_FORM_BODY.code,
        });
        assert.throws(
            () =>
                parseStorefrontSkuPricesQuery({
                    sku_ids: Array.from({ length: 101 }, (_, index) => `300000000000000${String(index).padStart(3, "0")}`),
                } as never),
            {
                code: DiscordApiErrors.INVALID_FORM_BODY.code,
            },
        );

        const response = await requestJson(createRouteApp(), "/storefront/skus/prices");

        assert.equal(response.status, 400);
        assert.equal((response.body as { code?: unknown }).code, DiscordApiErrors.INVALID_FORM_BODY.code);
    });

    test("declares source-backed metadata and generated artifacts for the exact owned path", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "storefront", "skus", "prices.ts"), "utf8");
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

        assert.match(routeSource, /summary:\s*"Get Storefront SKU Prices"/);
        assert.match(routeSource, /description:\s*"Returns locally backed pricing objects for the requested storefront SKU IDs\."/);
        assert.match(routeSource, /sku_ids:\s*\{\s*type:\s*"array",\s*required:\s*true/s);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"StorefrontSkuPricesResponse"/s);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);

        assert.equal(schemas.StorefrontSkuPricesResponse.type, "object");
        assert.deepEqual(schemas.StorefrontSkuPricesResponse.required, ["sku_prices"]);
        assert.equal(schemas.StorefrontSkuPricesResponse.properties?.sku_prices?.$ref, "#/definitions/StorefrontSkuPriceMap");
        assert.equal(
            schemas.StorefrontSkuPriceMap.additionalProperties && typeof schemas.StorefrontSkuPriceMap.additionalProperties !== "boolean"
                ? schemas.StorefrontSkuPriceMap.additionalProperties.$ref
                : undefined,
            "#/definitions/StorefrontSkuPrice",
        );
        assert.equal(schemas.StorefrontSkuPrice.properties?.country_prices?.$ref, "#/definitions/StorefrontSkuCountryPrices");
        assert.equal(schemas.StorefrontSkuCountryPrices.properties?.prices?.items?.$ref, "#/definitions/StorefrontSkuUnitPrice");
        assert.equal(schemas.StorefrontSkuUnitPrice.properties?.currency?.type, "string");
        assert.equal(schemas.StorefrontSkuUnitPrice.properties?.amount?.type, "integer");
        assert.equal(schemas.StorefrontSkuUnitPrice.properties?.exponent?.type, "integer");

        const route = openapi.paths?.["/storefront/skus/prices/"]?.get;
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "sku_ids" && parameter.in === "query" && parameter.required === true),
            true,
        );
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/StorefrontSkuPricesResponse");
        for (const status of ["400", "401"]) {
            assert.equal(route?.responses?.[status]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        }
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.equal(openapi.components?.schemas?.StorefrontSkuPricesResponse?.properties?.sku_prices?.$ref, "#/components/schemas/StorefrontSkuPriceMap");

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.path, "/storefront/skus/prices/");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/storefront/skus/prices.ts");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("StorefrontSkuPricesResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 400, 401],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === assignedPath);
        assert.equal(catalogEntry?.route_name, assignedRouteName);
        assert.equal(catalogEntry?.source, "src/api/routes/storefront/skus/prices.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "StorefrontSkuPricesResponse"]);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === assignedPath && entry.route_name === assignedRouteName),
            false,
        );

        const contract = contractTests.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse", "StorefrontSkuPricesResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [200, 400, 401]);
    });
});

function price(overrides: Partial<StorefrontSkuPrice> = {}): StorefrontSkuPrice {
    return {
        country_prices: {
            country_code: "US",
            prices: [{ currency: "usd", amount: 999, exponent: 2 }],
        },
        payment_source_prices: {
            "700000000000000001": [{ currency: "usd", amount: 999, exponent: 2 }],
        },
        ...overrides,
    };
}

function createRouteApp(priceProvider: StorefrontSkuPricesProvider = getConfiguredStorefrontSkuPrices) {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/storefront/skus/prices", createStorefrontSkuPricesRouter(priceProvider));
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp() {
    const app = express();

    app.use(Authentication);
    app.use("/storefront/skus/prices", createStorefrontSkuPricesRouter());
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
