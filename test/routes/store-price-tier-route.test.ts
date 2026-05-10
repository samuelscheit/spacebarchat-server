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
import { DiscordApiErrors } from "@spacebar/util";
import express from "express";
import {
    assertValidStorePriceTierParam,
    createStorePriceTierRouter,
    getStorePriceTier,
    getStorePriceTierPricing,
    parseStorePriceTierParam,
    type StorePriceTierProvider,
} from "../../src/api/routes/store/price-tiers/#price_tier";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestIds = ["api:http:GET:/store/price-tiers/:price_tier/"];
const assignedSourceRoute = "/store/price-tiers/{price_tier}";
const assignedMissingRoute = "/store/price-tiers/{param}";

type JsonSchema = {
    $ref?: string;
    type?: string;
    required?: string[];
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
    additionalProperties?: boolean | JsonSchema;
};

describe("GET /store/price-tiers/:price_tier", () => {
    test("documents the assigned manifest id and stays behind bearer auth", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/store/price-tiers/:price_tier/"]);
        assert.equal(isNoAuthorizationRoute("GET", "/store/price-tiers/100"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v10/store/price-tiers/100/"), false);

        const response = await requestJson(createAuthenticatedApp(), "/store/price-tiers/100");

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("parses the documented price tier parameter and returns provider-backed localized pricing", async () => {
        let receivedPriceTier: number | undefined;
        const provider: StorePriceTierProvider = (priceTier) => {
            receivedPriceTier = priceTier;
            return {
                eur: 449,
                usd: 499,
            };
        };

        const response = await requestJson(createRouteApp(provider), "/store/price-tiers/100");

        assert.equal(response.status, 200);
        assert.equal(receivedPriceTier, 100);
        assert.deepEqual(response.body, {
            eur: 449,
            usd: 499,
        });
    });

    test("rejects non-integer price tier parameters as invalid form body", async () => {
        assert.equal(parseStorePriceTierParam("100"), 100);
        assert.doesNotThrow(() => assertValidStorePriceTierParam("0"));
        assert.throws(() => assertValidStorePriceTierParam("not-a-tier"), {
            code: DiscordApiErrors.INVALID_FORM_BODY.code,
        });
        assert.throws(() => assertValidStorePriceTierParam("01"), {
            code: DiscordApiErrors.INVALID_FORM_BODY.code,
        });

        const response = await requestJson(createRouteApp(), "/store/price-tiers/not-a-tier");

        assert.equal(response.status, 400);
        assert.equal((response.body as { code?: unknown }).code, DiscordApiErrors.INVALID_FORM_BODY.code);
    });

    test("returns a conservative empty pricing map without fabricating monetization data", async () => {
        assert.deepEqual(getStorePriceTier(100), {});
        assert.notEqual(getStorePriceTierPricing(100), getStorePriceTierPricing(100), "callers should receive a fresh map");

        const response = await requestJson(createRouteApp(), "/store/price-tiers/100");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {});
    });

    test("declares source-backed metadata and generated artifacts for the exact owned path", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "store", "price-tiers", "#price_tier.ts"), "utf8");
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

        assert.match(routeSource, /summary:\s*"Get Store Price Tier"/);
        assert.match(routeSource, /description:\s*"Returns localized currency pricing for a store price tier\."/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"StorePriceTierResponse"/s);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);

        assert.equal(schemas.StorePriceTierResponse.type, "object");
        assert.equal(typeof schemas.StorePriceTierResponse.additionalProperties === "object" ? schemas.StorePriceTierResponse.additionalProperties.type : undefined, "integer");

        const route = openapi.paths?.["/store/price-tiers/{price_tier}/"]?.get;
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "price_tier" && parameter.in === "path" && parameter.required === true),
            true,
        );
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/StorePriceTierResponse");
        assert.equal(route?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.path, "/store/price-tiers/:price_tier/");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/store/price-tiers/#price_tier.ts");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("StorePriceTierResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 400, 401],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === assignedSourceRoute);
        assert.equal(catalogEntry?.route_name, "GET_STORE_PRICE_TIERS_PRICE_TIER");
        assert.equal(catalogEntry?.source, "src/api/routes/store/price-tiers/#price_tier.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "StorePriceTierResponse"]);

        assert.equal(
            missingRoutes.missing_entries?.some(
                (entry) => entry.method === "GET" && entry.route === assignedMissingRoute && entry.route_name === "GET_STORE_PRICE_TIERS_PRICE_TIER",
            ),
            false,
        );
        assert.equal(
            sourceCatalog.some((entry) => entry.method === "GET" && entry.route === "/store/price-tiers"),
            true,
        );
    });
});

function createRouteApp(priceTierProvider?: StorePriceTierProvider) {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/store/price-tiers/:price_tier", createStorePriceTierRouter(priceTierProvider));
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp() {
    const app = express();

    app.use(Authentication);
    app.use("/store/price-tiers/:price_tier", createStorePriceTierRouter());
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
