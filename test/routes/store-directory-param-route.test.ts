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
import type { StoreDirectoryResponse } from "@spacebar/schemas";
import express from "express";
import {
    createStoreDirectoryRouter,
    getConfiguredStoreDirectory,
    getStoreDirectory,
    parseStoreDirectoryQuery,
    UNKNOWN_STORE_DIRECTORY_ERROR,
    type StoreDirectoryProvider,
    type StoreDirectoryProviderOptions,
} from "../../src/api/routes/store/directory/#param";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestIds = ["api:http:GET:/store/directory/:param/"];
const assignedPath = "/store/directory/{param}";
const assignedRouteName = "STORE_DIRECTORY";
const assignedSourceRouteName = "GET_STORE_DIRECTORY_PARAM";
const directoryId = "100000000000000001";

type JsonSchema = {
    $schema?: string;
    $ref?: string;
    type?: string | string[];
    required?: string[];
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
};

describe("GET /store/directory/:param", () => {
    test("documents the assigned manifest id and stays behind bearer auth without exposing adjacent directory routes", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/store/directory/:param/"]);
        assert.equal(isNoAuthorizationRoute("GET", `/api/v10/store/directory/${directoryId}`), false);
        assert.equal(isNoAuthorizationRoute("HEAD", `/api/v10/store/directory/${directoryId}/`), false);
        assert.equal(isNoAuthorizationRoute("GET", `/api/v10/store/directory-layouts/${directoryId}`), false);
        assert.equal(isNoAuthorizationRoute("GET", `/api/v10/store/skus/${directoryId}/purchase`), false);

        const response = await requestJson(createAuthenticatedApp(), `/store/directory/${directoryId}`);

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("parses localization query fields and returns provider-backed local directory data", async () => {
        let receivedOptions: StoreDirectoryProviderOptions | undefined;
        const directory: StoreDirectoryResponse = {
            id: directoryId,
            rows: [],
        };
        const provider: StoreDirectoryProvider = (options) => {
            receivedOptions = options;
            return directory;
        };

        assert.deepEqual(parseStoreDirectoryQuery({ country_code: ["DE"], localize: "0" } as never), {
            country_code: "DE",
            localize: false,
        });

        const response = await requestJson(createRouteApp(provider), `/store/directory/${directoryId}?country_code=DE&localize=false`);

        assert.equal(response.status, 200);
        assert.deepEqual(receivedOptions, {
            directory_id: directoryId,
            country_code: "DE",
            localize: false,
        });
        assert.deepEqual(response.body, directory);
    });

    test("fails closed for missing or malformed directory IDs without fabricating store curation", async () => {
        assert.equal(getConfiguredStoreDirectory({ directory_id: directoryId, localize: true }), undefined);
        assert.equal(UNKNOWN_STORE_DIRECTORY_ERROR.code, 10033);
        assert.equal(UNKNOWN_STORE_DIRECTORY_ERROR.httpStatus, 404);

        await assert.rejects(() => getStoreDirectory(directoryId, { localize: true }), isUnknownStoreDirectoryError);
        await assert.rejects(() => getStoreDirectory("not-a-snowflake", { localize: true }, () => ({ id: "ignored" })), isUnknownStoreDirectoryError);

        const missingResponse = await requestJson(createRouteApp(), `/store/directory/${directoryId}`);
        const invalidResponse = await requestJson(
            createRouteApp(() => ({ id: "ignored" })),
            "/store/directory/not-a-snowflake",
        );

        assert.equal(missingResponse.status, 404);
        assert.deepEqual(missingResponse.body, {
            code: UNKNOWN_STORE_DIRECTORY_ERROR.code,
            message: UNKNOWN_STORE_DIRECTORY_ERROR.message,
        });
        assert.equal(invalidResponse.status, 404);
        assert.deepEqual(invalidResponse.body, {
            code: UNKNOWN_STORE_DIRECTORY_ERROR.code,
            message: UNKNOWN_STORE_DIRECTORY_ERROR.message,
        });
    });

    test("rejects malformed query booleans before calling the provider", async () => {
        let called = false;
        const response = await requestJson(
            createRouteApp(() => {
                called = true;
                return { id: directoryId };
            }),
            `/store/directory/${directoryId}?localize=sometimes`,
        );

        assert.equal(called, false);
        assert.equal(response.status, 400);
        assert.equal((response.body as { code?: unknown }).code, 50035);
        assert.throws(() => parseStoreDirectoryQuery({ localize: "sometimes" } as never), { code: 50035 });
    });

    test("declares source-backed metadata and generated artifacts for the exact owned path", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "store", "directory", "#param.ts"), "utf8");
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

        assert.match(routeSource, /summary:\s*"Get Store Directory"/);
        assert.match(routeSource, /description:\s*"Returns a locally backed store directory object for the given directory ID when one is configured\."/);
        assert.match(routeSource, /country_code:\s*\{\s*type:\s*"string"/s);
        assert.match(routeSource, /localize:\s*\{\s*type:\s*"boolean"/s);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"StoreDirectoryResponse"/s);
        for (const status of ["400", "401", "404"]) {
            assert.match(routeSource, new RegExp(`${status}:\\s*\\{\\s*body:\\s*"APIErrorResponse"`, "s"));
        }
        assert.doesNotMatch(routeSource, /403:\s*\{\s*body:\s*"APIErrorResponse"/s);

        assert.equal(schemas.StoreDirectoryResponse?.$schema, "http://json-schema.org/draft-07/schema#");
        assert.equal(schemas.StoreDirectoryResponse?.type, undefined);

        const route = openapi.paths?.["/store/directory/{param}/"]?.get;
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "param" && parameter.in === "path" && parameter.required === true),
            true,
        );
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "country_code" && parameter.in === "query" && parameter.schema?.type === "string"),
            true,
        );
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "localize" && parameter.in === "query" && parameter.schema?.type === "boolean"),
            true,
        );
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/StoreDirectoryResponse");
        for (const status of ["400", "401", "404"]) {
            assert.equal(route?.responses?.[status]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        }
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.path, "/store/directory/:param/");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/store/directory/#param.ts");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("StoreDirectoryResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 400, 401, 404],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === assignedPath);
        assert.equal(catalogEntry?.route_name, assignedSourceRouteName);
        assert.equal(catalogEntry?.source, "src/api/routes/store/directory/#param.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "StoreDirectoryResponse"]);
        assert.equal(
            sourceCatalog.some((entry) => entry.method === "GET" && entry.route === "/store/directory-layouts/{param}"),
            false,
        );

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === assignedPath && entry.route_name === assignedRouteName),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/store/directory-layouts/{param}"),
            true,
        );

        const contract = contractTests.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.deepEqual(contract?.routeMetadata?.responses?.sort(), ["APIErrorResponse", "StoreDirectoryResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [200, 400, 401, 404]);
    });
});

function isUnknownStoreDirectoryError(error: unknown) {
    return (
        (error as { code?: unknown; message?: unknown })?.code === UNKNOWN_STORE_DIRECTORY_ERROR.code &&
        (error as { message?: unknown })?.message === UNKNOWN_STORE_DIRECTORY_ERROR.message
    );
}

function createRouteApp(directoryProvider?: StoreDirectoryProvider) {
    const app = express();

    app.use("/store/directory/:param", createStoreDirectoryRouter(directoryProvider));
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp() {
    const app = express();

    app.use(Authentication);
    app.use("/store/directory/:param", createStoreDirectoryRouter());
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
