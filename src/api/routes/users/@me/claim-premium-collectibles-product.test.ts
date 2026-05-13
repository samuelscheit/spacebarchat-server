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
import { ErrorHandler, isNoAuthorizationRoute } from "../../../middlewares";
import type { CollectiblesPurchasesResponse } from "@spacebar/schemas";
import express from "express";

const requireModule = require;
const routeModulePath = require.resolve("./claim-premium-collectibles-product");
const manifestId = "api:http:PUT:/users/@me/claim-premium-collectibles-product/";

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("PUT /users/@me/claim-premium-collectibles-product", () => {
    test("declares authenticated premium collectibles claim metadata and fail-closed provider behavior", (t) => {
        const routeOptions = captureRouteOptions(t);

        assert.deepEqual(routeOptions[0], {
            summary: "Claim Premium Collectibles Product",
            description:
                "Claims a premium-only collectible SKU when a real collectibles ownership and premium entitlement provider is configured. The default Spacebar instance has neither, so it validates the documented payload and fails closed with 501 instead of fabricating collectible ownership.",
            requestBody: "CollectiblesPremiumProductClaimSchema",
            coerceRequestBody: false,
            responses: {
                200: {
                    body: "CollectiblesPurchasesResponse",
                },
                204: {},
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
                501: {
                    body: "APIErrorResponse",
                },
            },
        });
    });

    test("is authenticated and fails closed when no collectibles claim provider is configured", async () => {
        const routeModule = loadRouteModule();
        const unsupportedError = routeModule.createPremiumCollectiblesProductClaimUnsupportedError();
        const app = createRouteApp(routeModule.default);

        assert.equal(isNoAuthorizationRoute("PUT", "/users/@me/claim-premium-collectibles-product"), false);
        assert.equal(isNoAuthorizationRoute("PUT", "/api/v9/users/@me/claim-premium-collectibles-product/"), false);
        assert.equal(unsupportedError.httpStatus, 501);
        assert.equal(unsupportedError.code, 0);
        assert.equal(unsupportedError.message, routeModule.PREMIUM_COLLECTIBLES_PRODUCT_CLAIM_UNSUPPORTED_MESSAGE);

        const response = await request(app, "/users/@me/claim-premium-collectibles-product", {
            method: "PUT",
            body: { sku_id: "100000000000000001" },
        });

        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: 0,
            message: routeModule.PREMIUM_COLLECTIBLES_PRODUCT_CLAIM_UNSUPPORTED_MESSAGE,
        });
    });

    test("validates the SKU ID before provider dispatch", async () => {
        const calls: unknown[] = [];
        const app = createRouteApp(
            loadRouteModule().createPremiumCollectiblesProductClaimRouter({
                async claimPremiumCollectiblesProduct(userId, skuId) {
                    calls.push({ userId, skuId });
                    return [];
                },
            }),
        );

        const response = await request(app, "/users/@me/claim-premium-collectibles-product", {
            method: "PUT",
            body: { sku_id: "not-a-snowflake" },
        });

        const responseBody = response.body as { code?: number; errors?: { sku_id?: unknown } };
        assert.equal(response.status, 400);
        assert.equal(responseBody.code, 50035);
        assert.ok(responseBody.errors?.sku_id);
        assert.deepEqual(calls, []);
    });

    test("returns current user collectibles purchases when a provider claims the SKU", async () => {
        const calls: { userId: string; skuId: string }[] = [];
        const purchases = [collectibleProduct("100000000000000001")] satisfies CollectiblesPurchasesResponse;
        const app = createRouteApp(
            loadRouteModule().createPremiumCollectiblesProductClaimRouter({
                async claimPremiumCollectiblesProduct(userId, skuId) {
                    calls.push({ userId, skuId });
                    return purchases;
                },
            }),
        );

        const response = await request(app, "/users/@me/claim-premium-collectibles-product", {
            method: "PUT",
            body: { sku_id: "100000000000000001" },
        });

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, purchases);
        assert.deepEqual(calls, [{ userId: "user-id", skuId: "100000000000000001" }]);
    });

    test("returns 204 when the provider reports the SKU was already claimed", async () => {
        const app = createRouteApp(
            loadRouteModule().createPremiumCollectiblesProductClaimRouter({
                async claimPremiumCollectiblesProduct() {
                    return null;
                },
            }),
        );

        const response = await request(app, "/users/@me/claim-premium-collectibles-product", {
            method: "PUT",
            body: { sku_id: "100000000000000001" },
        });

        assert.equal(response.status, 204);
        assert.equal(response.body, "");
    });

    test("generated artifacts own only the assigned PUT premium collectibles claim route", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "users", "@me", "claim-premium-collectibles-product.ts"), "utf8");
        const schemas = readJson<
            Record<
                string,
                {
                    type?: string;
                    required?: string[];
                    items?: { $ref?: string };
                    properties?: Record<string, { type?: string; pattern?: string }>;
                }
            >
        >(path.join("assets", "schemas.json"));
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    put?: {
                        requestBody?: { content?: Record<string, { schema?: { $ref?: string } }> };
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                    get?: unknown;
                    post?: unknown;
                    patch?: unknown;
                    delete?: unknown;
                    options?: unknown;
                }
            >;
        }>(path.join("assets", "openapi.json"));
        const sourceCatalog = readJson<
            {
                method?: string;
                route?: string;
                route_name?: string;
                source?: string;
                request_schema_ref?: string;
                response_schema_refs?: string[];
            }[]
        >(path.join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<{ routes?: string[]; missing_entries?: { method?: string; route?: string; route_name?: string }[] }>(
            path.join("packages", "missing-routes", "missing.json"),
        );
        const manifest = readJson<{
            entries?: {
                id?: string;
                authMode?: string;
                sourceFile?: string;
                routeMetadata?: {
                    requestBody?: string;
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>(path.join("assets", "testing-manifest.json"));
        const contractMatrix = readJson<{
            contracts?: {
                manifestId?: string;
                sourceFile?: string;
                routeMetadata?: {
                    requestBody?: string;
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>(path.join("test", "generated", "http-contracts.json"));
        const suiteCoverage = readJson<{ groups?: { suites?: { id?: string; testFiles?: string[]; manifestIds?: string[] }[] }[] }>(
            path.join("test", "generated", "suite-coverage.json"),
        );

        assert.match(routeSource, /router\.put\(\s*["']\/["']/);
        assert.match(routeSource, /requestBody:\s*"CollectiblesPremiumProductClaimSchema"/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"CollectiblesPurchasesResponse"/s);
        assert.match(routeSource, /204:\s*\{\}/);
        assert.match(routeSource, /501:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /router\.(get|post|patch|delete|options)\(/);

        assert.equal(schemas.CollectiblesPremiumProductClaimSchema?.type, "object");
        assert.deepEqual(schemas.CollectiblesPremiumProductClaimSchema?.required, ["sku_id"]);
        assert.equal(schemas.CollectiblesPremiumProductClaimSchema?.properties?.sku_id?.type, "string");
        assert.equal(schemas.CollectiblesPremiumProductClaimSchema?.properties?.sku_id?.pattern, "^[1-9]\\d{16,19}$");
        assert.equal(schemas.CollectiblesPurchasesResponse?.type, "array");
        assert.equal(schemas.CollectiblesPurchasesResponse?.items?.$ref, "#/definitions/CollectiblesProductResponse");

        const openapiRoute = openapi.paths?.["/users/@me/claim-premium-collectibles-product/"]?.put;
        assert.equal(openapiRoute?.requestBody?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/CollectiblesPremiumProductClaimSchema");
        assert.equal(openapiRoute?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/CollectiblesPurchasesResponse");
        assert.ok(openapiRoute?.responses?.["204"]);
        assert.equal(openapiRoute?.responses?.["204"]?.content, undefined);
        assert.equal(openapiRoute?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapiRoute?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapiRoute?.responses?.["501"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(openapiRoute?.security, [{ bearer: [] }]);
        assert.equal(openapi.paths?.["/users/@me/claim-premium-collectibles-product/"]?.get, undefined);
        assert.equal(openapi.paths?.["/users/@me/claim-premium-collectibles-product/"]?.post, undefined);
        assert.equal(openapi.paths?.["/users/@me/claim-premium-collectibles-product/"]?.patch, undefined);
        assert.equal(openapi.paths?.["/users/@me/claim-premium-collectibles-product/"]?.delete, undefined);
        assert.equal(openapi.paths?.["/users/@me/claim-premium-collectibles-product/"]?.options, undefined);

        const sourceRoute = sourceCatalog.find((entry) => entry.method === "PUT" && entry.route === "/users/@me/claim-premium-collectibles-product");
        assert.equal(sourceRoute?.route_name, "PUT_USERS__ME_CLAIM_PREMIUM_COLLECTIBLES_PRODUCT");
        assert.equal(sourceRoute?.source, "src/api/routes/users/@me/claim-premium-collectibles-product.ts");
        assert.equal(sourceRoute?.request_schema_ref, "CollectiblesPremiumProductClaimSchema");
        assert.deepEqual(sourceRoute?.response_schema_refs, ["APIErrorResponse", "CollectiblesPurchasesResponse"]);

        assert.equal(
            missingRoutes.missing_entries?.some(
                (entry) =>
                    entry.method === "PUT" &&
                    entry.route === "/users/@me/claim-premium-collectibles-product" &&
                    entry.route_name === "PUT_USERS__ME_CLAIM_PREMIUM_COLLECTIBLES_PRODUCT",
            ),
            false,
        );
        assert.equal(missingRoutes.routes?.includes("/users/@me/claim-premium-collectibles-product"), false);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === manifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/users/@me/claim-premium-collectibles-product.ts");
        assert.equal(manifestEntry?.routeMetadata?.requestBody, "CollectiblesPremiumProductClaimSchema");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse", "CollectiblesPurchasesResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [200, 204, 400, 401, 501]);

        const contractEntry = contractMatrix.contracts?.find((contract) => contract.manifestId === manifestId);
        assert.equal(contractEntry?.sourceFile, "src/api/routes/users/@me/claim-premium-collectibles-product.ts");
        assert.equal(contractEntry?.routeMetadata?.requestBody, "CollectiblesPremiumProductClaimSchema");
        assert.deepEqual(contractEntry?.routeMetadata?.responses, ["APIErrorResponse", "CollectiblesPurchasesResponse"]);
        assert.deepEqual(contractEntry?.routeMetadata?.responseStatuses, [200, 204, 400, 401, 501]);

        const usersSuite = suiteCoverage.groups?.flatMap((group) => group.suites ?? []).find((suite) => suite.id === "users");
        assert.equal(usersSuite?.manifestIds?.includes(manifestId), true);
        assert.equal(usersSuite?.testFiles?.includes("src/api/routes/users/@me/claim-premium-collectibles-product.test.ts"), true);
    });
});

function loadRouteModule(): typeof import("./claim-premium-collectibles-product") {
    delete require.cache[routeModulePath];
    return requireModule(routeModulePath) as typeof import("./claim-premium-collectibles-product");
}

function captureRouteOptions(t: TestContext) {
    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../util/handlers/route");
    const routeOptions: unknown[] = [];

    t.mock.method(routeHandler, "route", (routeOption: unknown) => {
        routeOptions.push(routeOption);
        return (_req: unknown, _res: unknown, next: () => void) => next();
    });

    loadRouteModule();

    return routeOptions;
}

function createRouteApp(router: express.Router): express.Express {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "user-id";
        next();
    });
    app.use("/users/@me/claim-premium-collectibles-product", router);
    app.use(ErrorHandler);
    return app;
}

async function request(app: express.Express, routePath: string, options: { method?: string; body?: unknown } = {}) {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${routePath}`, {
            method: options.method,
            body: options.body == undefined ? undefined : JSON.stringify(options.body),
            headers: options.body == undefined ? undefined : { "content-type": "application/json" },
        });
        const text = await response.text();

        return {
            status: response.status,
            body: text.length ? JSON.parse(text) : "",
        };
    } finally {
        server.close();
    }
}

function collectibleProduct(skuId: string): CollectiblesPurchasesResponse[number] {
    return {
        sku_id: skuId,
        name: "Premium collectible",
        summary: "Premium collectible claim",
        store_listing_id: "100000000000000002",
        banner: "premium-banner",
        unpublished_at: null,
        styles: {
            background_colors: [16777215],
            button_colors: [0],
            confetti_colors: [255],
        },
        prices: {},
        items: [{ type: 0, id: "100000000000000003", sku_id: skuId }],
        type: 0,
        premium_type: 2,
        category_sku_id: "100000000000000004",
        google_sku_ids: {},
    };
}

function readJson<T>(file: string): T {
    return JSON.parse(readFileSync(file, "utf8")) as T;
}
