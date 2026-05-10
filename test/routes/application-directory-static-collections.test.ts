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
import express from "express";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../src/api/middlewares";
import {
    APPLICATION_DIRECTORY_COLLECTIONS_CACHE_CONTROL,
    createApplicationDirectoryCollectionsRouter,
    getApplicationDirectoryCollections,
    parseApplicationDirectoryCollectionsQuery,
    type ApplicationDirectoryCollectionsProvider,
    type ApplicationDirectoryCollectionsQueryOptions,
} from "../../src/api/routes/application-directory-static/collections";
import type { ApplicationDirectoryCollection } from "../../src/schemas";

const coveredManifestIds = ["api:http:GET:/application-directory-static/collections/"];

type JsonSchema = {
    $ref?: string;
    type?: string;
    required?: string[];
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
};

function sampleCollection(): ApplicationDirectoryCollection {
    return {
        id: "1347675452709408842",
        type: 1,
        position: 8,
        surface: 1,
        platforms: 4,
        active_state: 1,
        flags: 0,
        title: "Action Games",
        description: "Source-backed application directory collection",
        application_directory_collection_items: [
            {
                id: "1347675452709408845",
                type: 1,
                image_hash: null,
                position: 3,
                flags: 0,
                application: {
                    id: "1217877285923979415",
                    name: "Example Activity",
                    icon: null,
                    description: "Example public application directory entry",
                    summary: "",
                    type: null,
                    is_monetized: false,
                    is_verified: true,
                    is_discoverable: true,
                    cover_image: null,
                    bot: {
                        id: "1217877285923979415",
                        username: "Example Activity",
                        discriminator: "4579",
                        global_name: null,
                        avatar: null,
                        bot: true,
                    },
                    hook: true,
                    guild_id: "651719864473485313",
                    storefront_available: false,
                    bot_public: true,
                    bot_require_code_grant: false,
                    terms_of_service_url: null,
                    privacy_policy_url: null,
                    install_params: {
                        scopes: ["applications.commands"],
                        permissions: "0",
                    },
                    verify_key: "f15d0bebe98ec4df7e7814d4514313ea24dbc622269ca0753f5508a13f08591f",
                    flags: 131082,
                    flags_new: "131082",
                    max_participants: 24,
                    tags: ["Action", "Arcade", "Multiplayer"],
                    categories: [{ id: 6, name: "Games" }],
                    directory_entry: {
                        guild_count: 13900,
                        supported_locales: ["en-US"],
                        external_urls: [{ name: "Example", url: "https://example.invalid" }],
                        short_description: "Example public app directory description.",
                    },
                },
            },
        ],
    };
}

function createRouteApp(options: { authentication?: boolean; collectionsProvider?: ApplicationDirectoryCollectionsProvider } = {}) {
    const app = express();

    if (options.authentication) app.use(Authentication);
    app.use("/application-directory-static/collections", createApplicationDirectoryCollectionsRouter(options.collectionsProvider));
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
            headers: response.headers,
            body: (await response.json()) as unknown,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

describe("GET /application-directory-static/collections", () => {
    test("declares the assigned manifest route id covered by this suite", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/application-directory-static/collections/"]);
    });

    test("parses documented query fields and returns provider-backed collections", async () => {
        const collections = [sampleCollection()];
        let receivedOptions: ApplicationDirectoryCollectionsQueryOptions | undefined;
        const app = createRouteApp({
            collectionsProvider: (options) => {
                receivedOptions = options;
                return collections;
            },
        });

        const response = await requestJson(app, "/application-directory-static/collections?surface=1&active_state=1&platform=4&locale=en-US&cache=false");

        assert.equal(response.status, 200);
        assert.deepEqual(receivedOptions, {
            surface: 1,
            active_state: 1,
            platform: 4,
            locale: "en-US",
            cache: false,
        });
        assert.deepEqual(response.body, collections);
        assert.equal(response.headers.get("cache-control"), APPLICATION_DIRECTORY_COLLECTIONS_CACHE_CONTROL);
    });

    test("returns an empty source-compatible catalog without fabricating application records", async () => {
        assert.deepEqual(getApplicationDirectoryCollections(), []);
        assert.deepEqual(
            parseApplicationDirectoryCollectionsQuery({
                surface: "invalid",
                active_state: "1.5",
                platform: "4",
                locale: "",
                cache: "maybe",
            } as never),
            {
                surface: undefined,
                active_state: undefined,
                platform: 4,
                locale: undefined,
                cache: undefined,
            },
        );

        const response = await requestJson(createRouteApp(), "/application-directory-static/collections?surface=1");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
    });

    test("is public through the authentication middleware", async () => {
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/application-directory-static/collections"), true);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v10/application-directory-static/collections/"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v10/application-directory-static/collections"), false);

        const response = await requestJson(createRouteApp({ authentication: true }), "/application-directory-static/collections");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
    });

    test("declares public response metadata in generated route artifacts", () => {
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

        assert.equal(schemas.ApplicationDirectoryCollectionsResponse.type, "array");
        assert.equal(schemas.ApplicationDirectoryCollectionsResponse.items?.$ref, "#/definitions/ApplicationDirectoryCollection");
        assert.deepEqual(schemas.ApplicationDirectoryCollection.required, [
            "active_state",
            "application_directory_collection_items",
            "description",
            "flags",
            "id",
            "platforms",
            "position",
            "title",
            "type",
        ]);
        assert.equal(schemas.ApplicationDirectoryCollection.properties?.application_directory_collection_items?.items?.$ref, "#/definitions/ApplicationDirectoryCollectionItem");

        const route = openapi.paths?.["/application-directory-static/collections/"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ApplicationDirectoryCollectionsResponse");
        assert.equal(route?.responses?.["401"], undefined);
        assert.equal(route?.security, undefined);
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "surface" && parameter.in === "query" && parameter.schema?.type === "integer"),
            true,
        );
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "cache" && parameter.in === "query" && parameter.schema?.type === "boolean"),
            true,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === "api:http:GET:/application-directory-static/collections/");
        assert.equal(manifestEntry?.authMode, "public");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/application-directory-static/collections.ts");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, true);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["ApplicationDirectoryCollectionsResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [200]);

        const catalogEntry = catalog.find((entry) => entry.method === "GET" && entry.route === "/application-directory-static/collections");
        assert.equal(catalogEntry?.route_name, "GET_APPLICATION_DIRECTORY_STATIC_COLLECTIONS");
        assert.equal(catalogEntry?.source, "src/api/routes/application-directory-static/collections.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs, ["ApplicationDirectoryCollectionsResponse"]);
    });
});
