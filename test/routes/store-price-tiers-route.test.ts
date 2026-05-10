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
import express from "express";
import {
    createStorePriceTiersRouter,
    getStorePriceTiers,
    listStorePriceTiers,
    parseStorePriceTiersQuery,
    type StorePriceTiersProvider,
    type StorePriceTiersQueryOptions,
} from "../../src/api/routes/store/price-tiers";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestIds = ["api:http:GET:/store/price-tiers/"];

type JsonSchema = {
    $ref?: string;
    type?: string;
    required?: string[];
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
};

describe("GET /store/price-tiers", () => {
    test("documents the assigned manifest id and stays behind bearer auth", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/store/price-tiers/"]);
        assert.equal(isNoAuthorizationRoute("GET", "/store/price-tiers?price_tier_type=2"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v10/store/price-tiers/"), false);

        const response = await requestJson(createAuthenticatedApp(), "/store/price-tiers?price_tier_type=2");

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("parses the documented query field and returns provider-backed tiers", async () => {
        let receivedOptions: StorePriceTiersQueryOptions | undefined;
        const provider: StorePriceTiersProvider = (options) => {
            receivedOptions = options;
            return [100, 200, 500];
        };

        const response = await requestJson(createRouteApp(provider), "/store/price-tiers?price_tier_type=2");

        assert.equal(response.status, 200);
        assert.deepEqual(receivedOptions, { price_tier_type: 2 });
        assert.deepEqual(response.body, [100, 200, 500]);
    });

    test("returns a conservative empty catalog without fabricating monetization data", async () => {
        assert.deepEqual(getStorePriceTiers(), []);
        assert.deepEqual(listStorePriceTiers({ price_tier_type: 1 }), []);
        assert.notEqual(listStorePriceTiers(), listStorePriceTiers(), "callers should receive a fresh list");
        assert.deepEqual(parseStorePriceTiersQuery({ price_tier_type: "invalid" } as never), { price_tier_type: undefined });
        assert.deepEqual(parseStorePriceTiersQuery({ price_tier_type: ["1", "2"] } as never), { price_tier_type: 1 });

        const response = await requestJson(createRouteApp(), "/store/price-tiers");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
    });

    test("declares source-backed metadata and generated artifacts", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "store", "price-tiers.ts"), "utf8");
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

        assert.match(routeSource, /summary:\s*"Get Store Price Tiers"/);
        assert.match(routeSource, /description:\s*"Returns the available store price tier identifiers\."/);
        assert.match(routeSource, /price_tier_type:\s*\{\s*type:\s*"integer"/s);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"StorePriceTiersResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);

        assert.equal(schemas.StorePriceTiersResponse.type, "array");
        assert.equal(schemas.StorePriceTiersResponse.items?.type, "integer");

        const route = openapi.paths?.["/store/price-tiers/"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/StorePriceTiersResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "price_tier_type" && parameter.in === "query" && parameter.schema?.type === "integer"),
            true,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("StorePriceTiersResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/store/price-tiers");
        assert.equal(catalogEntry?.route_name, "GET_STORE_PRICE_TIERS");
        assert.equal(catalogEntry?.source, "src/api/routes/store/price-tiers.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "StorePriceTiersResponse"]);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/store/price-tiers" && entry.route_name === "GET_STORE_PRICE_TIERS"),
            false,
        );
    });
});

function createRouteApp(priceTierProvider?: StorePriceTiersProvider) {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/store/price-tiers", createStorePriceTiersRouter(priceTierProvider));
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp() {
    const app = express();

    app.use(Authentication);
    app.use("/store/price-tiers", createStorePriceTiersRouter());
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
