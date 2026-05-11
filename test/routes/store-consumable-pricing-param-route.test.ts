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
import type { StoreConsumableSkuPricingResponse } from "@spacebar/schemas";
import express from "express";
import {
    createStoreConsumableSkuPricingRouter,
    getConfiguredStoreConsumableSkuPricing,
    getStoreConsumableSkuPricing,
    toStoreConsumableSkuPricingResponse,
    UNKNOWN_STORE_SKU_ERROR,
    type StoreConsumableSkuPricingProvider,
    type StoreConsumableSkuPricingProviderOptions,
} from "../../src/api/routes/store/consumable/pricing/#sku_id";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestIds = ["api:http:GET:/store/consumable/pricing/:sku_id/"];
const assignedPath = "/store/consumable/pricing/{param}";
const assignedSourcePath = "/store/consumable/pricing/{sku_id}";
const assignedRouteName = "GET_STORE_CONSUMABLE_PRICING_SKU_ID";

type JsonSchema = {
    $ref?: string;
    type?: string | string[];
    required?: string[];
    properties?: Record<string, JsonSchema>;
    additionalProperties?: boolean | JsonSchema;
};

describe("GET /store/consumable/pricing/:sku_id", () => {
    test("documents the assigned manifest id and stays behind bearer auth", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/store/consumable/pricing/:sku_id/"]);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/store/consumable/pricing/1316162456959057920"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v10/store/consumable/pricing/1316162456959057920/"), false);

        const response = await requestJson(createAuthenticatedApp(), "/store/consumable/pricing/1316162456959057920");

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("returns provider-backed consumable SKU pricing", async () => {
        let receivedOptions: StoreConsumableSkuPricingProviderOptions | undefined;
        const provider: StoreConsumableSkuPricingProvider = (options) => {
            receivedOptions = options;
            return samplePricing;
        };

        const response = await requestJson(createRouteApp(provider), "/store/consumable/pricing/1316162456959057920");

        assert.equal(response.status, 200);
        assert.deepEqual(receivedOptions, { sku_id: "1316162456959057920" });
        assert.deepEqual(response.body, samplePricing);
    });

    test("fails closed for malformed or unbacked SKU IDs without fabricating Discord pricing", async () => {
        let providerCalled = false;

        assert.deepEqual(getConfiguredStoreConsumableSkuPricing({ sku_id: "1316162456959057920" }), undefined);
        await assert.rejects(
            () =>
                getStoreConsumableSkuPricing("not-a-snowflake", () => {
                    providerCalled = true;
                    return samplePricing;
                }),
            isUnknownSkuError,
        );
        assert.equal(providerCalled, false);
        await assert.rejects(
            () =>
                getStoreConsumableSkuPricing("1316162456959057920", () => {
                    providerCalled = true;
                    return undefined;
                }),
            isUnknownSkuError,
        );
        assert.equal(providerCalled, true);

        const missingResponse = await requestJson(createRouteApp(), "/store/consumable/pricing/1316162456959057920");
        const invalidResponse = await requestJson(
            createRouteApp(() => samplePricing),
            "/store/consumable/pricing/not-a-snowflake",
        );

        assert.equal(missingResponse.status, 404);
        assert.deepEqual(missingResponse.body, {
            code: UNKNOWN_STORE_SKU_ERROR.code,
            message: UNKNOWN_STORE_SKU_ERROR.message,
        });
        assert.equal(invalidResponse.status, 404);
        assert.deepEqual(invalidResponse.body, {
            code: UNKNOWN_STORE_SKU_ERROR.code,
            message: UNKNOWN_STORE_SKU_ERROR.message,
        });
    });

    test("serializes documented price fields without leaking provider internals", () => {
        const source = {
            price: {
                ...samplePricing.price,
                sale_amount: 249,
                sale_percentage: 50,
                premium: {
                    "2": {
                        amount: 199,
                        percentage: 60,
                    },
                },
            },
            internal_notes: "provider-only",
        };

        const response = toStoreConsumableSkuPricingResponse(source);

        assert.deepEqual(response, {
            price: {
                currency: "usd",
                currency_exponent: 2,
                amount: 499,
                sale_amount: 249,
                sale_percentage: 50,
                premium: {
                    "2": {
                        amount: 199,
                        percentage: 60,
                    },
                },
            },
        });
        assert.equal((response as StoreConsumableSkuPricingResponse & { internal_notes?: unknown }).internal_notes, undefined);
        assert.notEqual(response.price, source.price);
        assert.notEqual(response.price.premium, source.price.premium);
    });

    test("declares source-backed metadata and generated artifacts for the exact owned path", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "store", "consumable", "pricing", "#sku_id.ts"), "utf8");
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

        assert.match(routeSource, /summary:\s*"Get Consumable SKU Pricing"/);
        assert.match(routeSource, /description:\s*"Returns locally backed pricing information for a consumable SKU without fabricating Discord-managed pricing\."/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"StoreConsumableSkuPricingResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);

        assert.equal(schemas.StoreConsumableSkuPricingResponse.type, "object");
        assert.equal(schemas.StoreConsumableSkuPricingResponse.required?.includes("price"), true);
        assert.equal(schemas.StoreConsumableSkuPricingResponse.properties?.price?.$ref, "#/definitions/StoreSkuPriceResponse");
        assert.equal(schemas.StoreSkuPriceResponse.required?.includes("currency"), true);
        assert.equal(schemas.StoreSkuPriceResponse.required?.includes("currency_exponent"), true);
        assert.equal(schemas.StoreSkuPriceResponse.required?.includes("amount"), true);
        assert.equal(schemas.StoreSkuPriceResponse.properties?.premium?.$ref, "#/definitions/StoreSkuPremiumPriceMapResponse");
        assert.equal(schemas.StoreSkuPremiumPriceMapResponse.type, "object");
        assert.equal(typeof schemas.StoreSkuPremiumPriceMapResponse.additionalProperties === "object", true);

        const route = openapi.paths?.["/store/consumable/pricing/{sku_id}/"]?.get;
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "sku_id" && parameter.in === "path" && parameter.required === true),
            true,
        );
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/StoreConsumableSkuPricingResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.path, "/store/consumable/pricing/:sku_id/");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/store/consumable/pricing/#sku_id.ts");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("StoreConsumableSkuPricingResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401, 404],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === assignedSourcePath);
        assert.equal(catalogEntry?.route_name, assignedRouteName);
        assert.equal(catalogEntry?.source, "src/api/routes/store/consumable/pricing/#sku_id.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "StoreConsumableSkuPricingResponse"]);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === assignedPath && entry.route_name === assignedRouteName),
            false,
        );
    });
});

const samplePricing: StoreConsumableSkuPricingResponse = {
    price: {
        currency: "usd",
        currency_exponent: 2,
        amount: 499,
    },
};

function isUnknownSkuError(error: unknown) {
    return (error as { code?: unknown; httpStatus?: unknown })?.code === UNKNOWN_STORE_SKU_ERROR.code && (error as { httpStatus?: unknown }).httpStatus === 404;
}

function createRouteApp(pricingProvider?: StoreConsumableSkuPricingProvider) {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/store/consumable/pricing/:sku_id", createStoreConsumableSkuPricingRouter(pricingProvider));
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp() {
    const app = express();

    app.use(Authentication);
    app.use("/store/consumable/pricing/:sku_id", createStoreConsumableSkuPricingRouter());
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
