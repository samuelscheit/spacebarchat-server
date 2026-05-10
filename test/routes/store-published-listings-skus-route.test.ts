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
    createStorePublishedListingsSkusRouter,
    getStorePublishedListingsSkus,
    listStorePublishedListingsSkus,
    parseStorePublishedListingsSkusQuery,
    type StorePublishedListingsSkusProvider,
    type StorePublishedListingsSkusQueryOptions,
} from "../../src/api/routes/store/published-listings/skus";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestIds = ["api:http:GET:/store/published-listings/skus/"];
const assignedPath = "/store/published-listings/skus";
const assignedRouteName = "GET_STORE_PUBLISHED_LISTINGS_SKUS";

type JsonSchema = {
    $ref?: string;
    type?: string;
    required?: string[];
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
};

describe("GET /store/published-listings/skus", () => {
    test("documents the assigned manifest id and stays behind bearer auth", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/store/published-listings/skus/"]);
        assert.equal(isNoAuthorizationRoute("GET", "/store/published-listings/skus?application_id=100000000000000001"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v10/store/published-listings/skus/?application_id=100000000000000001"), false);

        const response = await requestJson(createAuthenticatedApp(), "/store/published-listings/skus?application_id=100000000000000001");

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("parses documented query fields and returns provider-backed listings", async () => {
        let receivedOptions: StorePublishedListingsSkusQueryOptions | undefined;
        const listing = {
            id: "200000000000000001",
            summary: "Published listing",
            sku: {
                id: "300000000000000001",
                application_id: "100000000000000001",
            },
        };
        const provider: StorePublishedListingsSkusProvider = (options) => {
            receivedOptions = options;
            return [listing];
        };

        assert.deepEqual(
            parseStorePublishedListingsSkusQuery({
                application_id: ["100000000000000001", "ignored"],
                guild_id: ["400000000000000001"],
                country_code: ["DE"],
                localize: ["0"],
            } as never),
            {
                application_id: "100000000000000001",
                guild_id: "400000000000000001",
                country_code: "DE",
                localize: false,
            },
        );

        const response = await requestJson(
            createRouteApp(provider),
            "/store/published-listings/skus?application_id=100000000000000001&guild_id=400000000000000001&country_code=DE&localize=false",
        );

        assert.equal(response.status, 200);
        assert.deepEqual(receivedOptions, {
            application_id: "100000000000000001",
            guild_id: "400000000000000001",
            country_code: "DE",
            localize: false,
        });
        assert.deepEqual(response.body, [listing]);
    });

    test("returns a conservative empty catalog without fabricating store listings", async () => {
        const query: StorePublishedListingsSkusQueryOptions = { application_id: "100000000000000001" };

        assert.deepEqual(getStorePublishedListingsSkus(query), []);
        assert.deepEqual(listStorePublishedListingsSkus(query), []);
        assert.notEqual(listStorePublishedListingsSkus(query), listStorePublishedListingsSkus(query), "callers should receive a fresh list");

        const response = await requestJson(createRouteApp(), "/store/published-listings/skus?application_id=100000000000000001");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
    });

    test("rejects missing or malformed required query fields", async () => {
        assert.throws(() => parseStorePublishedListingsSkusQuery({} as never), {
            code: DiscordApiErrors.INVALID_FORM_BODY.code,
        });
        assert.throws(() => parseStorePublishedListingsSkusQuery({ application_id: "not-a-snowflake" } as never), {
            code: DiscordApiErrors.INVALID_FORM_BODY.code,
        });
        assert.throws(() => parseStorePublishedListingsSkusQuery({ application_id: "100000000000000001", guild_id: "guild" } as never), {
            code: DiscordApiErrors.INVALID_FORM_BODY.code,
        });

        const response = await requestJson(createRouteApp(), "/store/published-listings/skus");

        assert.equal(response.status, 400);
        assert.equal((response.body as { code?: unknown }).code, DiscordApiErrors.INVALID_FORM_BODY.code);
    });

    test("declares source-backed metadata and generated artifacts for the exact owned path", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "store", "published-listings", "skus.ts"), "utf8");
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

        assert.match(routeSource, /summary:\s*"Get Application Published Store Listings"/);
        assert.match(routeSource, /description:\s*"Returns published store listing objects for an application\."/);
        assert.match(routeSource, /application_id:\s*\{\s*type:\s*"string",\s*required:\s*true/s);
        assert.match(routeSource, /guild_id:\s*\{\s*type:\s*"string"/s);
        assert.match(routeSource, /country_code:\s*\{\s*type:\s*"string"/s);
        assert.match(routeSource, /localize:\s*\{\s*type:\s*"boolean"/s);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"StorePublishedListingsSkusResponse"/s);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);

        assert.equal(schemas.StorePublishedListingsSkusResponse.type, "array");
        assert.deepEqual(schemas.StorePublishedListingsSkusResponse.items, {});

        const route = openapi.paths?.["/store/published-listings/skus/"]?.get;
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "application_id" && parameter.in === "query" && parameter.required === true),
            true,
        );
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "guild_id" && parameter.in === "query"),
            true,
        );
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "country_code" && parameter.in === "query"),
            true,
        );
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "localize" && parameter.in === "query" && parameter.schema?.type === "boolean"),
            true,
        );
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/StorePublishedListingsSkusResponse");
        assert.equal(route?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.path, "/store/published-listings/skus/");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/store/published-listings/skus.ts");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("StorePublishedListingsSkusResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 400, 401],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === assignedPath);
        assert.equal(catalogEntry?.route_name, assignedRouteName);
        assert.equal(catalogEntry?.source, "src/api/routes/store/published-listings/skus.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "StorePublishedListingsSkusResponse"]);
        assert.equal(
            sourceCatalog.some((entry) => entry.method === "GET" && entry.route === "/store/published-listings/skus/{sku_id}"),
            true,
        );

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === assignedPath && entry.route_name === assignedRouteName),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.route === "/store/published-listings/skus/subscription-plans"),
            true,
        );

        const contract = contractTests.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse", "StorePublishedListingsSkusResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [200, 400, 401]);
    });
});

function createRouteApp(listingProvider?: StorePublishedListingsSkusProvider) {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/store/published-listings/skus", createStorePublishedListingsSkusRouter(listingProvider));
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp() {
    const app = express();

    app.use(Authentication);
    app.use("/store/published-listings/skus", createStorePublishedListingsSkusRouter());
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
