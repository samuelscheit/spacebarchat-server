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
import { IpDataClient } from "@spacebar/util";
import express from "express";
import localizedPricingPromoRouter, { createBillingLocalizedPricingPromoResponse } from "../../src/api/routes/users/@me/billing/localized-pricing-promo";

const coveredManifestIds = ["api:http:GET:/users/@me/billing/localized-pricing-promo/"];
const assignedSourcePath = "/users/@me/billing/localized-pricing-promo";
const assignedRouteName = "GET_USERS__ME_BILLING_LOCALIZED_PRICING_PROMO";

type JsonSchema = {
    $ref?: string;
    anyOf?: JsonSchema[];
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    type?: string;
};

describe("GET /users/@me/billing/localized-pricing-promo", () => {
    test("declares the assigned billing localized pricing promo manifest route id", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/users/@me/billing/localized-pricing-promo/"]);
        assert.equal(assignedSourcePath, "/users/@me/billing/localized-pricing-promo");
        assert.equal(assignedRouteName, "GET_USERS__ME_BILLING_LOCALIZED_PRICING_PROMO");
    });

    test("builds a local no-promo response from detected country data without fabricating prices", () => {
        assert.deepEqual(createBillingLocalizedPricingPromoResponse({ country_code: "DE" }), {
            country_code: "DE",
            localized_pricing_promo: null,
        });
        assert.deepEqual(createBillingLocalizedPricingPromoResponse({}), {});
        assert.deepEqual(createBillingLocalizedPricingPromoResponse(null), {});
    });

    test("returns the detected country and no promo through the route handler", async (t) => {
        let receivedIp: string | undefined;
        t.mock.method(IpDataClient, "getIpInfo", async (ip: string) => {
            receivedIp = ip;
            return { country_code: "BR" };
        });

        const response = await requestJson(createRouteApp(), "/users/@me/billing/localized-pricing-promo");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            country_code: "BR",
            localized_pricing_promo: null,
        });
        assert.equal(typeof receivedIp, "string");
    });

    test("stays bearer-authenticated and leaves adjacent billing offer routes untouched", async () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "users", "@me", "billing", "localized-pricing-promo.ts"), "utf8");

        assert.match(routeSource, /summary:\s*"Get Localized Pricing Promo"/);
        assert.match(routeSource, /body:\s*"BillingLocalizedPricingPromoResponse"/);
        assert.match(routeSource, /body:\s*"APIErrorResponse"/);
        assert.doesNotMatch(routeSource, /router\.post\(/);
        assert.doesNotMatch(routeSource, /campaign-context|checkout-recovery|user-trial-offer|user-offer|subscriptions\/preview/i);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/users/@me/billing/localized-pricing-promo"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v9/users/@me/billing/localized-pricing-promo/"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/users/@me/billing/localized-pricing-promo"), false);

        const response = await requestJson(createAuthenticatedRouteApp(), "/users/@me/billing/localized-pricing-promo");

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("generates response schema, route catalogs, contracts, suite coverage, and missing-route removal", () => {
        const schemas = readJson<Record<string, JsonSchema>>(join(process.cwd(), "assets", "schemas.json"));
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    get?: {
                        parameters?: unknown[];
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                    post?: unknown;
                }
            >;
        }>(join(process.cwd(), "assets", "openapi.json"));
        const sourceCatalog = readJson<
            {
                method?: string;
                response_schema_refs?: string[];
                route?: string;
                route_name?: string;
                source?: string;
            }[]
        >(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<{ missing_entries?: { method?: string; route?: string; route_name?: string }[] }>(
            join(process.cwd(), "packages", "missing-routes", "missing.json"),
        );
        const manifest = readJson<{
            entries?: {
                authMode?: string;
                id?: string;
                routeMetadata?: {
                    hasQuery?: boolean;
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
                sourceFile?: string;
            }[];
        }>(join(process.cwd(), "assets", "testing-manifest.json"));
        const contracts = readJson<{
            contracts?: {
                authMode?: string;
                manifestId?: string;
                routeMetadata?: {
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
            summary?: {
                runtimeAuthenticatedResponseSchemaContracts?: number;
            };
        }>(join(process.cwd(), "test", "generated", "http-contracts.json"));
        const suiteCoverage = readJson<{ groups?: { suites?: { id?: string; manifestIds?: string[] }[] }[] }>(join(process.cwd(), "test", "generated", "suite-coverage.json"));

        assert.deepEqual(schemas.BillingLocalizedPricingPromoPriceResponse.required?.sort(), ["amount", "currency"]);
        assert.equal(schemas.BillingLocalizedPricingPromoPriceResponse.properties?.currency?.type, "string");
        assert.equal(schemas.BillingLocalizedPricingPromoPriceResponse.properties?.amount?.type, "integer");
        assert.deepEqual(schemas.BillingLocalizedPricingPromoOfferResponse.required?.sort(), ["country_code", "payment_source_types", "plan_id", "price"]);
        assert.equal(schemas.BillingLocalizedPricingPromoOfferResponse.properties?.plan_id?.type, "string");
        assert.equal(schemas.BillingLocalizedPricingPromoOfferResponse.properties?.payment_source_types?.items?.type, "integer");
        assert.equal(schemas.BillingLocalizedPricingPromoOfferResponse.properties?.price?.$ref, "#/definitions/BillingLocalizedPricingPromoPriceResponse");
        assert.equal(schemas.BillingLocalizedPricingPromoResponse.required, undefined);
        assert.equal(schemas.BillingLocalizedPricingPromoResponse.properties?.country_code?.type, "string");
        assert.deepEqual(schemas.BillingLocalizedPricingPromoResponse.properties?.localized_pricing_promo?.anyOf, [
            { $ref: "#/definitions/BillingLocalizedPricingPromoOfferResponse" },
            { type: "null" },
        ]);

        const route = openapi.paths?.["/users/@me/billing/localized-pricing-promo/"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/BillingLocalizedPricingPromoResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.equal(route?.parameters?.length ?? 0, 0);
        assert.equal(openapi.paths?.["/users/@me/billing/localized-pricing-promo/"]?.post, undefined);

        assert.deepEqual(
            sourceCatalog.find((entry) => entry.method === "GET" && entry.route === assignedSourcePath),
            {
                method: "GET",
                response_schema_refs: ["APIErrorResponse", "BillingLocalizedPricingPromoResponse"],
                route: assignedSourcePath,
                route_name: assignedRouteName,
                source: "src/api/routes/users/@me/billing/localized-pricing-promo.ts",
            },
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === assignedSourcePath && entry.route_name === assignedRouteName),
            false,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/users/@me/billing/localized-pricing-promo.ts");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, false);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "BillingLocalizedPricingPromoResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401],
        );

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.deepEqual(contract?.routeMetadata?.responses?.sort(), ["APIErrorResponse", "BillingLocalizedPricingPromoResponse"]);
        assert.deepEqual(
            contract?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401],
        );
        assert.equal((contracts.summary?.runtimeAuthenticatedResponseSchemaContracts ?? 0) > 0, true);

        const usersSuite = suiteCoverage.groups?.flatMap((group) => group.suites ?? []).find((suite) => suite.id === "users");
        assert.equal(usersSuite?.manifestIds?.includes(coveredManifestIds[0]), true);
    });
});

function createRouteApp() {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = "100000000000000001";
        next();
    });
    app.use("/users/@me/billing/localized-pricing-promo", localizedPricingPromoRouter);
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedRouteApp() {
    const app = express();

    app.use(Authentication);
    app.use("/users/@me/billing/localized-pricing-promo", localizedPricingPromoRouter);
    app.use(ErrorHandler);

    return app;
}

function readJson<T>(filePath: string): T {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
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
