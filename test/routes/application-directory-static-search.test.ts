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
import Ajv from "ajv";
import express from "express";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../src/api/middlewares";
import {
    APPLICATION_DIRECTORY_STATIC_CACHE_CONTROL,
    APPLICATION_DIRECTORY_STATIC_EMPTY_SEARCH_LOAD_ID,
    createApplicationDirectoryStaticRouter,
    getApplicationDirectorySearchResults,
    parseApplicationDirectorySearchQuery,
    type ApplicationDirectorySearchProvider,
    type ApplicationDirectorySearchQueryOptions,
} from "../../src/api/routes/application-directory-static";
import { ApplicationDirectoryItemType, type ApplicationDirectorySearchResponse } from "../../src/schemas";

const coveredManifestIds = ["api:http:GET:/application-directory-static/search"];

type JsonSchema = {
    $ref?: string;
    type?: string;
    required?: string[];
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
    additionalProperties?: JsonSchema | boolean;
};

function sampleSearchResponse(): ApplicationDirectorySearchResponse {
    return {
        results: [
            {
                type: ApplicationDirectoryItemType.APPLICATION,
                data: {
                    id: "1217877285923979415",
                    name: "Example Activity",
                    icon: null,
                    description: "Example public application directory entry",
                    type: null,
                    verify_key: "f15d0bebe98ec4df7e7814d4514313ea24dbc622269ca0753f5508a13f08591f",
                    flags: 131082,
                    directory_entry: {
                        guild_count: 13900,
                        supported_locales: ["en-US"],
                        short_description: "Example public app directory description.",
                    },
                },
            },
        ],
        num_pages: 1,
        counts_by_category: { "6": 1 },
        type: ApplicationDirectoryItemType.APPLICATION,
        load_id: "application_directory_search/test",
    };
}

function createRouteApp(options: { authentication?: boolean; searchProvider?: ApplicationDirectorySearchProvider } = {}) {
    const app = express();

    if (options.authentication) app.use(Authentication);
    app.use("/application-directory-static", createApplicationDirectoryStaticRouter({ searchProvider: options.searchProvider }));
    app.use(ErrorHandler);

    return app;
}

async function requestJson(app: express.Express, path: string, init: RequestInit = {}) {
    const server = await new Promise<ReturnType<express.Express["listen"]>>((resolve) => {
        const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });

    try {
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
        const response = await fetch(`http://127.0.0.1:${(address as AddressInfo).port}${path}`, init);

        return {
            status: response.status,
            headers: response.headers,
            body: init.method === "HEAD" ? undefined : ((await response.json()) as unknown),
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

describe("GET /application-directory-static/search", () => {
    test("declares the assigned manifest route id and public auth boundary", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/application-directory-static/search"]);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/application-directory-static/search?query=activity"), true);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v10/application-directory-static/search/"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v10/application-directory-static/search"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/application-directory-static/applications/1217877285923979415"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/application-directory-static/applications/1217877285923979415/similar"), false);

        const response = await requestJson(createRouteApp({ authentication: true }), "/application-directory-static/search?query=activity");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, getApplicationDirectorySearchResults());
    });

    test("parses documented query fields and returns provider-backed search results", async () => {
        const searchResponse = sampleSearchResponse();
        let receivedOptions: ApplicationDirectorySearchQueryOptions | undefined;
        const app = createRouteApp({
            searchProvider: (options) => {
                receivedOptions = options;
                return searchResponse;
            },
        });

        const response = await requestJson(
            app,
            "/application-directory-static/search?query=activity&guild_id=651719864473485313&page=3&page_size=25&category_id=6&locale=en-US&min_user_install_command_count=12&exclude_apps_with_custom_install_url=true&exclude_non_embedded_apps=false&exclude_embedded_apps_without_primary_entry_point_app_command=true&source=1",
        );

        assert.equal(response.status, 200);
        assert.equal(response.headers.get("cache-control"), APPLICATION_DIRECTORY_STATIC_CACHE_CONTROL);
        assert.deepEqual(receivedOptions, {
            query: "activity",
            guild_id: "651719864473485313",
            page: 3,
            page_size: 25,
            category_id: 6,
            locale: "en-US",
            min_user_install_command_count: 12,
            exclude_apps_with_custom_install_url: true,
            exclude_non_embedded_apps: false,
            exclude_embedded_apps_without_primary_entry_point_app_command: true,
            source: 1,
        });
        assert.deepEqual(response.body, searchResponse);
    });

    test("returns an empty source-compatible payload without fabricating search records", async () => {
        assert.deepEqual(getApplicationDirectorySearchResults(), {
            results: [],
            num_pages: 0,
            counts_by_category: {},
            type: ApplicationDirectoryItemType.APPLICATION,
            load_id: APPLICATION_DIRECTORY_STATIC_EMPTY_SEARCH_LOAD_ID,
        });
        assert.deepEqual(
            parseApplicationDirectorySearchQuery({
                query: "x".repeat(101),
                page: "1001",
                page_size: "0",
                category_id: "6.5",
                locale: "",
                min_user_install_command_count: "101",
                exclude_apps_with_custom_install_url: "maybe",
                exclude_non_embedded_apps: "0",
                exclude_embedded_apps_without_primary_entry_point_app_command: "1",
                source: "invalid",
            } as never),
            {
                query: undefined,
                guild_id: undefined,
                page: undefined,
                page_size: undefined,
                category_id: undefined,
                locale: undefined,
                min_user_install_command_count: undefined,
                exclude_apps_with_custom_install_url: undefined,
                exclude_non_embedded_apps: undefined,
                exclude_embedded_apps_without_primary_entry_point_app_command: undefined,
                source: undefined,
            },
        );

        const response = await requestJson(createRouteApp(), "/application-directory-static/search?page=1&page_size=50");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, getApplicationDirectorySearchResults());
        assert.equal(response.headers.get("cache-control"), APPLICATION_DIRECTORY_STATIC_CACHE_CONTROL);
    });

    test("allows Express HEAD handling for the public GET route", async () => {
        const response = await requestJson(createRouteApp(), "/application-directory-static/search", { method: "HEAD" });

        assert.equal(response.status, 200);
        assert.equal(response.headers.get("cache-control"), APPLICATION_DIRECTORY_STATIC_CACHE_CONTROL);
        assert.equal(response.body, undefined);
    });

    test("declares public generated metadata and the response schema", () => {
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
                sourceFile?: string;
                routeMetadata?: {
                    hasQuery?: boolean;
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
            }[];
        };
        const catalog = JSON.parse(readFileSync(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"), "utf8")) as {
            method?: string;
            response_schema_refs?: string[];
            route?: string;
            route_name?: string;
            source?: string;
        }[];
        const ajv = new Ajv({ schemas: Object.entries(schemas).map(([key, schema]) => ({ ...schema, $id: key })) });
        const validate = ajv.compile({ ...schemas.ApplicationDirectorySearchResponse, definitions: schemas });

        assert.equal(validate(getApplicationDirectorySearchResults()), true);
        assert.equal(validate(sampleSearchResponse()), true);
        assert.equal(validate({ results: [], num_pages: 0, counts_by_category: {}, type: 1 }), false);
        assert.equal(schemas.ApplicationDirectorySearchResponse.type, "object");
        assert.equal(schemas.ApplicationDirectorySearchResponse.properties?.results?.type, "array");
        assert.equal(schemas.ApplicationDirectorySearchResponse.properties?.results?.items?.$ref, "#/definitions/ApplicationDirectorySearchResult");
        assert.equal(schemas.ApplicationDirectorySearchResponse.properties?.counts_by_category?.$ref, "#/definitions/ApplicationDirectoryCategoryCountMap");
        assert.equal((schemas.ApplicationDirectoryCategoryCountMap.additionalProperties as JsonSchema | undefined)?.type, "integer");
        assert.equal(schemas.ApplicationDirectorySearchResult.properties?.data?.$ref, "#/definitions/ApplicationDirectoryApplication");

        const route = openapi.paths?.["/application-directory-static/search"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ApplicationDirectorySearchResponse");
        assert.equal(route?.responses?.["401"], undefined);
        assert.equal(route?.security, undefined);
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "page_size" && parameter.in === "query" && parameter.schema?.type === "integer"),
            true,
        );
        assert.equal(
            route?.parameters?.some(
                (parameter) =>
                    parameter.name === "exclude_embedded_apps_without_primary_entry_point_app_command" && parameter.in === "query" && parameter.schema?.type === "boolean",
            ),
            true,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === "api:http:GET:/application-directory-static/search");
        assert.equal(manifestEntry?.authMode, "public");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/application-directory-static.ts");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, true);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["ApplicationDirectorySearchResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [200]);

        const catalogEntry = catalog.find((entry) => entry.method === "GET" && entry.route === "/application-directory-static/search");
        assert.equal(catalogEntry?.route_name, "GET_APPLICATION_DIRECTORY_STATIC_SEARCH");
        assert.equal(catalogEntry?.source, "src/api/routes/application-directory-static.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs, ["ApplicationDirectorySearchResponse"]);
    });
});
