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
import type { PartnerSdkStorefrontConfigResponse } from "@spacebar/schemas";
import express from "express";
import {
    clonePartnerSdkStorefrontConfig,
    createPartnerSdkStorefrontConfigRouter,
    getPartnerSdkStorefrontConfig,
    type PartnerSdkStorefrontConfigProvider,
} from "../../src/api/routes/partner-sdk/storefront-config";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestIds = ["api:http:GET:/partner-sdk/storefront-config/"];

type JsonSchema = {
    $ref?: string;
    type?: string | string[];
    required?: string[];
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
};

describe("GET /partner-sdk/storefront-config", () => {
    test("documents the assigned manifest id and stays behind bearer auth", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/partner-sdk/storefront-config/"]);
        assert.equal(isNoAuthorizationRoute("GET", "/partner-sdk/storefront-config"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v10/partner-sdk/storefront-config/"), false);

        const response = await requestJson(createAuthenticatedApp(), "/partner-sdk/storefront-config");

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("returns a conservative empty config without fabricating storefronts or SKUs", async () => {
        assert.deepEqual(getPartnerSdkStorefrontConfig(), {
            promotional_sku_ids: [],
            promotion_end_datetime: null,
            storefronts: [],
        });
        assert.notEqual(getPartnerSdkStorefrontConfig(), getPartnerSdkStorefrontConfig(), "callers should receive a fresh config object");

        const response = await requestJson(createRouteApp(), "/partner-sdk/storefront-config");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            promotional_sku_ids: [],
            promotion_end_datetime: null,
            storefronts: [],
        });
    });

    test("returns provider-backed config while isolating response objects from mutation", async () => {
        const configured: PartnerSdkStorefrontConfigResponse = {
            promotional_sku_ids: ["111111111111111111"],
            promotion_end_datetime: "2026-06-01T18:00:00+00:00",
            storefronts: [
                {
                    application_id: "222222222222222222",
                    game_id: "333333333333333333",
                    guild_id: "444444444444444444",
                    excluded_platforms: ["playstation"],
                    collectibles_shop_navigation_enabled: true,
                },
            ],
            announcement_modal_config: {
                application_id: "222222222222222222",
                version: 3,
            },
        };
        const cloned = clonePartnerSdkStorefrontConfig(configured);

        assert.deepEqual(cloned, configured);
        assert.notEqual(cloned.promotional_sku_ids, configured.promotional_sku_ids);
        assert.notEqual(cloned.storefronts, configured.storefronts);
        assert.notEqual(cloned.storefronts[0]?.excluded_platforms, configured.storefronts[0]?.excluded_platforms);

        const response = await requestJson(
            createRouteApp(() => configured),
            "/partner-sdk/storefront-config",
        );

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, configured);
    });

    test("declares source-backed metadata and generated artifacts", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "partner-sdk", "storefront-config.ts"), "utf8");
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonSchema>;
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            paths?: Record<
                string,
                {
                    get?: {
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                }
            >;
        };
        const manifest = JSON.parse(readFileSync(join(process.cwd(), "assets", "testing-manifest.json"), "utf8")) as {
            entries?: {
                id?: string;
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

        assert.match(routeSource, /summary:\s*"Get Social Layer Storefront Config"/);
        assert.match(routeSource, /description:\s*"Returns the promotion currently running for Social Layer integrated storefronts\."/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"PartnerSdkStorefrontConfigResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);

        assert.equal(schemas.PartnerSdkStorefrontConfigResponse.type, "object");
        assert.deepEqual(schemas.PartnerSdkStorefrontConfigResponse.required?.sort(), ["promotion_end_datetime", "promotional_sku_ids", "storefronts"]);
        assert.equal(schemas.PartnerSdkStorefrontConfigResponse.properties?.promotional_sku_ids?.items?.type, "string");
        assert.equal(schemas.PartnerSdkStorefrontConfigResponse.properties?.storefronts?.items?.$ref, "#/definitions/PartnerSdkStorefrontConfigStorefront");

        const route = openapi.paths?.["/partner-sdk/storefront-config/"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/PartnerSdkStorefrontConfigResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, false);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("PartnerSdkStorefrontConfigResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/partner-sdk/storefront-config");
        assert.equal(catalogEntry?.route_name, "GET_PARTNER_SDK_STOREFRONT_CONFIG");
        assert.equal(catalogEntry?.source, "src/api/routes/partner-sdk/storefront-config.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "PartnerSdkStorefrontConfigResponse"]);

        assert.equal(
            missingRoutes.missing_entries?.some(
                (entry) => entry.method === "GET" && entry.route === "/partner-sdk/storefront-config" && entry.route_name === "GET_PARTNER_SDK_STOREFRONT_CONFIG",
            ),
            false,
        );

        const contract = contractTests.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse", "PartnerSdkStorefrontConfigResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [200, 401]);
    });
});

function createRouteApp(provider?: PartnerSdkStorefrontConfigProvider) {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/partner-sdk/storefront-config", createPartnerSdkStorefrontConfigRouter(provider));
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp() {
    const app = express();

    app.use(Authentication);
    app.use("/partner-sdk/storefront-config", createPartnerSdkStorefrontConfigRouter());
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
