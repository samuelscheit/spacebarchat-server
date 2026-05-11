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
    createStorePublishedListingsApplicationsRouter,
    getStorePublishedListingsApplications,
    listStorePublishedListingsApplications,
    parseStorePublishedListingsApplicationsQuery,
    type StorePublishedListingsApplicationsProvider,
    type StorePublishedListingsApplicationsQueryOptions,
} from "../../src/api/routes/store/published-listings/applications";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestIds = ["api:http:GET:/store/published-listings/applications/"];
const assignedPath = "/store/published-listings/applications";
const assignedRouteName = "GET_STORE_PUBLISHED_LISTINGS_APPLICATIONS";

type JsonSchema = {
    $ref?: string;
    type?: string;
    required?: string[];
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
};

describe("GET /store/published-listings/applications", () => {
    test("documents the assigned manifest id and is public without exposing adjacent store routes", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/store/published-listings/applications/"]);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/store/published-listings/applications?application_ids=100000000000000001"), true);
        assert.equal(isNoAuthorizationRoute("HEAD", "/store/published-listings/applications/"), true);
        assert.equal(isNoAuthorizationRoute("GET", "/store/published-listings/applications/100000000000000001"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/store/published-listings/applications/100000000000000001/subscription-plans"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/store/published-listings/skus?application_id=100000000000000001"), false);

        const response = await requestJson(createAuthenticatedApp(), "/store/published-listings/applications?application_ids=100000000000000001");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
    });

    test("parses documented query fields and returns provider-backed listings", async () => {
        let receivedOptions: StorePublishedListingsApplicationsQueryOptions | undefined;
        const listing = {
            id: "200000000000000001",
            summary: "Primary listing",
            sku: {
                id: "300000000000000001",
                application_id: "100000000000000001",
            },
        };
        const provider: StorePublishedListingsApplicationsProvider = (options) => {
            receivedOptions = options;
            return [listing];
        };

        assert.deepEqual(
            parseStorePublishedListingsApplicationsQuery({
                application_ids: ["100000000000000001,200000000000000002", "100000000000000001"],
                "application_ids[]": ["300000000000000003"],
                country_code: ["DE"],
                localize: ["0"],
            } as never),
            {
                application_ids: ["100000000000000001", "200000000000000002", "300000000000000003"],
                country_code: "DE",
                localize: false,
            },
        );

        const response = await requestJson(
            createRouteApp(provider),
            "/store/published-listings/applications?application_ids=100000000000000001,200000000000000002&application_ids%5B%5D=300000000000000003&country_code=DE&localize=false",
        );

        assert.equal(response.status, 200);
        assert.deepEqual(receivedOptions, {
            application_ids: ["100000000000000001", "200000000000000002", "300000000000000003"],
            country_code: "DE",
            localize: false,
        });
        assert.deepEqual(response.body, [listing]);
    });

    test("returns a conservative empty catalog without fabricating primary store listings", async () => {
        const query: StorePublishedListingsApplicationsQueryOptions = {
            application_ids: ["100000000000000001"],
            localize: true,
        };

        assert.deepEqual(getStorePublishedListingsApplications(query), []);
        assert.deepEqual(listStorePublishedListingsApplications(query), []);
        assert.notEqual(listStorePublishedListingsApplications(query), listStorePublishedListingsApplications(query), "callers should receive a fresh list");

        const response = await requestJson(createRouteApp(), "/store/published-listings/applications?application_ids=100000000000000001");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
    });

    test("rejects missing, malformed, or oversized required query fields", async () => {
        assert.throws(() => parseStorePublishedListingsApplicationsQuery({} as never), { code: 50035 });
        assert.throws(() => parseStorePublishedListingsApplicationsQuery({ application_ids: "not-a-snowflake" } as never), { code: 50035 });
        assert.throws(
            () =>
                parseStorePublishedListingsApplicationsQuery({
                    application_ids: Array.from({ length: 101 }, (_, index) => String(100000000000000000n + BigInt(index))),
                } as never),
            { code: 50035 },
        );
        assert.throws(
            () =>
                parseStorePublishedListingsApplicationsQuery({
                    application_ids: "100000000000000001",
                    localize: "sometimes",
                } as never),
            { code: 50035 },
        );

        const response = await requestJson(createRouteApp(), "/store/published-listings/applications");

        assert.equal(response.status, 400);
        assert.equal((response.body as { code?: unknown }).code, 50035);
    });

    test("declares source-backed public metadata and generated artifacts for the exact owned path", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "store", "published-listings", "applications.ts"), "utf8");
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

        assert.match(routeSource, /summary:\s*"Get Bulk Application Primary Store Listing"/);
        assert.match(routeSource, /description:\s*"Returns published store listing objects for the primary SKUs of the given application IDs\."/);
        assert.match(routeSource, /application_ids:\s*\{\s*type:\s*"array",\s*required:\s*true/s);
        assert.match(routeSource, /country_code:\s*\{\s*type:\s*"string"/s);
        assert.match(routeSource, /localize:\s*\{\s*type:\s*"boolean"/s);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"StorePublishedListingsApplicationsResponse"/s);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);

        assert.equal(schemas.StorePublishedListingsApplicationsResponse.type, "array");
        assert.deepEqual(schemas.StorePublishedListingsApplicationsResponse.items, {});

        const route = openapi.paths?.["/store/published-listings/applications/"]?.get;
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "application_ids" && parameter.in === "query" && parameter.required === true),
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
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/StorePublishedListingsApplicationsResponse");
        assert.equal(route?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["401"], undefined);
        assert.equal(route?.security, undefined);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.path, "/store/published-listings/applications/");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/store/published-listings/applications.ts");
        assert.equal(manifestEntry?.authMode, "public");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("StorePublishedListingsApplicationsResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 400],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === assignedPath);
        assert.equal(catalogEntry?.route_name, assignedRouteName);
        assert.equal(catalogEntry?.source, "src/api/routes/store/published-listings/applications.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "StorePublishedListingsApplicationsResponse"]);
        assert.equal(
            sourceCatalog.some((entry) => entry.method === "GET" && entry.route === "/store/published-listings/applications/{application_id}"),
            true,
        );
        assert.equal(
            sourceCatalog.some((entry) => entry.method === "GET" && entry.route === "/store/published-listings/skus"),
            true,
        );
        assert.equal(
            sourceCatalog.some((entry) => entry.method === "GET" && entry.route === "/store/published-listings/skus/subscription-plans"),
            true,
        );

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === assignedPath && entry.route_name === assignedRouteName),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.route === "/store/published-listings/skus/subscription-plans"),
            false,
        );

        const contract = contractTests.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "public");
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse", "StorePublishedListingsApplicationsResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [200, 400]);
    });
});

function createRouteApp(listingProvider?: StorePublishedListingsApplicationsProvider) {
    const app = express();

    app.use("/store/published-listings/applications", createStorePublishedListingsApplicationsRouter(listingProvider));
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp() {
    const app = express();

    app.use(Authentication);
    app.use("/store/published-listings/applications", createStorePublishedListingsApplicationsRouter());
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
