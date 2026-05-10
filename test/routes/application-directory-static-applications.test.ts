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
    createApplicationDirectoryStaticRouter,
    getApplicationDirectoryApplication,
    parseApplicationDirectoryApplicationQuery,
    type ApplicationDirectoryApplicationProvider,
    type ApplicationDirectoryApplicationQueryOptions,
} from "../../src/api/routes/application-directory-static";
import type { ApplicationDirectoryApplication } from "../../src/schemas";
import { DiscordApiErrors } from "../../src/util";

const coveredManifestIds = ["api:http:GET:/application-directory-static/applications/:application_id"];

type JsonSchema = {
    $ref?: string;
    type?: string | string[];
    required?: string[];
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
};

function sampleApplication(): ApplicationDirectoryApplication {
    return {
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
            supported_locales: ["en-US", "de"],
            external_urls: [{ name: "Example", url: "https://example.invalid" }],
            detailed_description: "Detailed source-backed application directory description.",
            short_description: "Example public app directory description.",
            short_description_localizations: {
                de: "Beispielbeschreibung",
            },
            detailed_description_localizations: {
                de: "Ausfuehrliche Beispielbeschreibung",
            },
        },
    };
}

function createRouteApp(options: { authentication?: boolean; applicationProvider?: ApplicationDirectoryApplicationProvider } = {}) {
    const app = express();

    if (options.authentication) app.use(Authentication);
    app.use("/application-directory-static", createApplicationDirectoryStaticRouter({ applicationProvider: options.applicationProvider }));
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

describe("GET /application-directory-static/applications/{application_id}", () => {
    test("declares the assigned manifest route id and public auth boundary", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/application-directory-static/applications/:application_id"]);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/application-directory-static/applications/1217877285923979415?locale=en-US"), true);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v10/application-directory-static/applications/1217877285923979415/"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v10/application-directory-static/applications/1217877285923979415"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/application-directory-static/applications/1217877285923979415/similar"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/application-directory-static/search?query=activity"), true);

        const response = await requestJson(createRouteApp({ authentication: true }), "/application-directory-static/applications/1217877285923979415");

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
            message: DiscordApiErrors.UNKNOWN_APPLICATION.message,
        });
    });

    test("parses documented query fields and returns provider-backed application details", async () => {
        const application = sampleApplication();
        let receivedApplicationId: string | undefined;
        let receivedOptions: ApplicationDirectoryApplicationQueryOptions | undefined;
        const app = createRouteApp({
            authentication: true,
            applicationProvider: async (applicationId, options) => {
                receivedApplicationId = applicationId;
                receivedOptions = options;
                return application;
            },
        });

        const response = await requestJson(app, "/application-directory-static/applications/1217877285923979415?locale=en-US&nocache=true&with_localizations=false");

        assert.equal(response.status, 200);
        assert.equal(response.headers.get("cache-control"), APPLICATION_DIRECTORY_STATIC_CACHE_CONTROL);
        assert.equal(receivedApplicationId, "1217877285923979415");
        assert.deepEqual(receivedOptions, {
            locale: "en-US",
            nocache: true,
            with_localizations: false,
        });
        assert.deepEqual(response.body, application);
    });

    test("returns unknown application by default without fabricating directory records", async () => {
        assert.equal(getApplicationDirectoryApplication("1217877285923979415"), undefined);
        assert.deepEqual(
            parseApplicationDirectoryApplicationQuery({
                locale: "",
                nocache: "maybe",
                with_localizations: "1",
            } as never),
            {
                locale: undefined,
                nocache: undefined,
                with_localizations: undefined,
            },
        );

        const response = await requestJson(createRouteApp(), "/application-directory-static/applications/not-a-directory-application");

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
            message: DiscordApiErrors.UNKNOWN_APPLICATION.message,
        });
    });

    test("allows Express HEAD handling for the public GET route", async () => {
        const response = await requestJson(
            createRouteApp({
                applicationProvider: () => sampleApplication(),
            }),
            "/application-directory-static/applications/1217877285923979415",
            { method: "HEAD" },
        );

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
        const missingRoutes = JSON.parse(readFileSync(join(process.cwd(), "packages", "missing-routes", "missing.json"), "utf8")) as {
            missing_entries?: { method?: string; route?: string }[];
        };
        const contracts = JSON.parse(readFileSync(join(process.cwd(), "test", "generated", "http-contracts.json"), "utf8")) as {
            contracts?: {
                authMode?: string;
                manifestId?: string;
                routeMetadata?: {
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
        };
        const ajv = new Ajv({ schemas: Object.entries(schemas).map(([key, schema]) => ({ ...schema, $id: key })) });
        const validate = ajv.compile({ ...schemas.ApplicationDirectoryApplication, definitions: schemas });

        assert.equal(validate(sampleApplication()), true);
        assert.equal(validate({ id: "1217877285923979415", name: "Incomplete Activity" }), false);
        assert.deepEqual(schemas.ApplicationDirectoryApplication.required, ["description", "flags", "icon", "id", "name", "type", "verify_key"]);
        assert.equal(schemas.ApplicationDirectoryApplication.properties?.directory_entry?.$ref, "#/definitions/ApplicationDirectoryEntry");
        assert.equal(schemas.ApplicationDirectoryApplication.properties?.categories?.items?.$ref, "#/definitions/ApplicationDirectoryCategory");

        const route = openapi.paths?.["/application-directory-static/applications/{application_id}"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ApplicationDirectoryApplication");
        assert.equal(route?.responses?.["401"], undefined);
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.security, undefined);
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "locale" && parameter.in === "query" && parameter.schema?.type === "string"),
            true,
        );
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "nocache" && parameter.in === "query" && parameter.schema?.type === "boolean"),
            true,
        );
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "with_localizations" && parameter.in === "query" && parameter.schema?.type === "boolean"),
            true,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.authMode, "public");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/application-directory-static.ts");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, true);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse", "ApplicationDirectoryApplication"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [200, 404]);

        const catalogEntry = catalog.find((entry) => entry.method === "GET" && entry.route === "/application-directory-static/applications/{application_id}");
        assert.equal(catalogEntry?.route_name, "GET_APPLICATION_DIRECTORY_STATIC_APPLICATIONS_APPLICATION_ID");
        assert.equal(catalogEntry?.source, "src/api/routes/application-directory-static.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs, ["APIErrorResponse", "ApplicationDirectoryApplication"]);
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/application-directory-static/applications/{param}"),
            false,
        );

        const contractEntry = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contractEntry?.authMode, "public");
        assert.deepEqual(contractEntry?.routeMetadata?.responses, ["APIErrorResponse", "ApplicationDirectoryApplication"]);
        assert.deepEqual(contractEntry?.routeMetadata?.responseStatuses, [200, 404]);
    });
});
