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
import path from "node:path";
import { afterEach, describe, test, type TestContext } from "node:test";
import type { BillingUserDiscountOfferResponse } from "@spacebar/schemas";
import express from "express";
import { ErrorHandler } from "../../../../middlewares/ErrorHandler";
import { isNoAuthorizationRoute } from "../../../../middlewares/NoAuthorizationRoutes";

const requireModule = require;
const routeModulePath = require.resolve("./churn-user-offer");
const manifestId = "api:http:GET:/users/@me/billing/churn-user-offer/";
const assignedSourcePath = "/users/@me/billing/churn-user-offer";
const assignedRouteName = "GET_USERS__ME_BILLING_CHURN_USER_OFFER";

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("GET /users/@me/billing/churn-user-offer", () => {
    test("declares authenticated churn user offer response metadata", (t) => {
        const harness = setupUserBillingChurnUserOfferRoute(t);

        assert.deepEqual(harness.routeOptions[0], {
            summary: "Get Churn User Offer",
            description:
                "Returns the current retention discount offer for the authenticated user when locally persisted non-renewing subscription offer state exists. Spacebar does not currently persist Discord-managed retention discounts, so unknown offers fail closed instead of fabricating billing discounts.",
            responses: {
                200: {
                    body: "BillingChurnUserOfferResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
                404: {
                    body: "APIErrorResponse",
                },
            },
        });
    });

    test("stays on the authenticated current-user route boundary", () => {
        assert.equal(isNoAuthorizationRoute("GET", "/users/@me/billing/churn-user-offer"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/users/@me/billing/churn-user-offer"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/users/@me/billing/churn-user-offer"), false);
    });

    test("fails closed until local retention discount offers are persisted", async (t) => {
        const routeModule = requireModule(routeModulePath) as typeof import("./churn-user-offer");
        assert.equal(await routeModule.getBillingChurnUserOffer("viewer"), null);

        const response = await requestJson(setupUserBillingChurnUserOfferRoute(t).app, "/users/@me/billing/churn-user-offer");

        assert.deepEqual(response, {
            status: 404,
            body: {
                code: routeModule.UNKNOWN_CHURN_USER_OFFER.code,
                message: routeModule.UNKNOWN_CHURN_USER_OFFER.message,
            },
        });
    });

    test("returns the provider's retention offer for the authenticated user", async (t) => {
        const offer = createExampleDiscountOffer("viewer");
        const calls: unknown[][] = [];
        const harness = setupUserBillingChurnUserOfferRoute(t, (userId) => {
            calls.push([userId]);
            return offer;
        });

        const response = await requestJson(harness.app, "/users/@me/billing/churn-user-offer");

        assert.deepEqual(calls, [["viewer"]]);
        assert.deepEqual(response, {
            status: 200,
            body: {
                offer,
            },
        });
    });

    test("generated artifacts own only the assigned GET churn user offer route", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "users", "@me", "billing", "churn-user-offer.ts"), "utf8");
        const schemas = readJson<Record<string, JsonSchema>>(path.join("assets", "schemas.json"));
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
                    put?: unknown;
                    patch?: unknown;
                    delete?: unknown;
                }
            >;
        }>(path.join("assets", "openapi.json"));
        const sourceCatalog = readJson<
            {
                method?: string;
                response_schema_refs?: string[];
                route?: string;
                route_name?: string;
                source?: string;
            }[]
        >(path.join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<{ missing_entries?: { method?: string; route?: string; route_name?: string }[] }>(path.join("packages", "missing-routes", "missing.json"));
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
        }>(path.join("assets", "testing-manifest.json"));
        const contractMatrix = readJson<{ contracts?: { authMode?: string; manifestId?: string; routeMetadata?: { responses?: string[]; responseStatuses?: number[] } }[] }>(
            path.join("test", "generated", "http-contracts.json"),
        );
        const suiteCoverage = readJson<{ groups?: { suites?: { id?: string; manifestIds?: string[]; testFiles?: string[] }[] }[] }>(
            path.join("test", "generated", "suite-coverage.json"),
        );

        assert.match(routeSource, /router\.get\(\s*["']\/["']/);
        assert.doesNotMatch(routeSource, /router\.(?:post|put|patch|delete)\(/);
        assert.doesNotMatch(routeSource, /payment-sources|localized-pricing-promo|checkout-recovery|user-trial-offer|user-offer\/ack|user-offer\/redeem|subscriptions\/preview/i);

        assert.deepEqual(schemas.BillingChurnUserOfferResponse?.required, ["offer"]);
        assert.equal(schemas.BillingChurnUserOfferResponse?.properties?.offer?.$ref, "#/definitions/BillingUserDiscountOfferResponse");
        assert.equal(schemas.BillingUserDiscountOfferResponse?.properties?.id?.type, "string");
        assert.equal(schemas.BillingUserDiscountOfferResponse?.properties?.discount?.$ref, "#/definitions/BillingUserDiscountResponse");
        assert.equal(schemas.BillingUserDiscountResponse?.properties?.amount?.type, "integer");
        assert.equal(schemas.BillingUserDiscountResponse?.properties?.plan_ids?.items?.type, "string");

        const route = openapi.paths?.["/users/@me/billing/churn-user-offer/"];
        assert.equal(route?.get?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/BillingChurnUserOfferResponse");
        assert.equal(route?.get?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.get?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.get?.security, [{ bearer: [] }]);
        assert.equal(route?.get?.parameters?.length ?? 0, 0);
        assert.equal(route?.post, undefined);
        assert.equal(route?.put, undefined);
        assert.equal(route?.patch, undefined);
        assert.equal(route?.delete, undefined);

        assert.deepEqual(
            sourceCatalog.find((entry) => entry.method === "GET" && entry.route === assignedSourcePath),
            {
                method: "GET",
                response_schema_refs: ["APIErrorResponse", "BillingChurnUserOfferResponse"],
                route: assignedSourcePath,
                route_name: assignedRouteName,
                source: "src/api/routes/users/@me/billing/churn-user-offer.ts",
            },
        );
        assert.equal(
            sourceCatalog.some((entry) => entry.method === "POST" && entry.route === assignedSourcePath),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === assignedSourcePath && entry.route_name === assignedRouteName),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === assignedSourcePath),
            true,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === manifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/users/@me/billing/churn-user-offer.ts");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, false);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "BillingChurnUserOfferResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401, 404],
        );

        const contract = contractMatrix.contracts?.find((entry) => entry.manifestId === manifestId);
        assert.equal(contract?.authMode, "bearer");
        assert.deepEqual(contract?.routeMetadata?.responses?.sort(), ["APIErrorResponse", "BillingChurnUserOfferResponse"]);
        assert.deepEqual(
            contract?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401, 404],
        );

        const usersSuite = suiteCoverage.groups?.flatMap((group) => group.suites ?? []).find((suite) => suite.id === "users");
        assert.equal(usersSuite?.manifestIds?.includes(manifestId), true);
        assert.equal(usersSuite?.testFiles?.includes("src/api/routes/users/@me/billing/churn-user-offer.test.ts"), true);
    });
});

type JsonSchema = {
    $ref?: string;
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    type?: string;
};

type TestHarness = {
    app: express.Express;
    routeOptions: unknown[];
};

function setupUserBillingChurnUserOfferRoute(t: TestContext, offerProvider?: (userId: string) => BillingUserDiscountOfferResponse | null): TestHarness {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../../util/handlers/route");
    const routeOptions: unknown[] = [];

    t.mock.method(routeHandler, "route", (routeOption: unknown) => {
        routeOptions.push(routeOption);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });

    delete require.cache[routeModulePath];
    const routeModule = requireModule(routeModulePath) as typeof import("./churn-user-offer");

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/users/@me/billing/churn-user-offer", routeModule.createUserBillingChurnUserOfferRouter(offerProvider));
    app.use(ErrorHandler);

    return {
        app,
        routeOptions,
    };
}

function createExampleDiscountOffer(userId: string): BillingUserDiscountOfferResponse {
    return {
        id: "1433666591022645360",
        user_id: userId,
        discount_id: "1204865493622587392",
        applied_at: null,
        expires_at: "2025-11-04T07:26:18.125782+00:00",
        discount: {
            id: "1204865493622587392",
            amount: 30,
            starts_at: null,
            ends_at: null,
            status: 2,
            created_at: "2024-02-08T16:44:28.903181+00:00",
            sku_ids: null,
            sku_group_ids: null,
            plan_ids: ["511651880837840896"],
            user_usage_limit_interval: 3,
            user_usage_limit_interval_count: 1,
            user_usage_limit: 1,
        },
    };
}

async function requestJson(app: express.Express, requestPath: string): Promise<{ status: number; body: unknown }> {
    const server = await new Promise<ReturnType<express.Express["listen"]>>((resolve) => {
        const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });

    try {
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
        const response = await fetch(`http://127.0.0.1:${(address as AddressInfo).port}${requestPath}`);

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

function readJson<T>(filePath: string): T {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
}
