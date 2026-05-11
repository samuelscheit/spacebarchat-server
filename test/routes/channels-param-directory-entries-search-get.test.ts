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
import Ajv from "ajv";
import express from "express";

const requireModule = require;
const coveredManifestId = "api:http:GET:/channels/:channel_id/directory-entries/search";

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

const routeModulePath = distModulePath("api", "routes", "channels", "#channel_id", "directory-entries.js");

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("GET /channels/:channel_id/directory-entries/search", () => {
    test("returns empty directory entry search results while directory entries are not persisted", async (t) => {
        const harness = setupDirectoryEntriesRoute(t, harnessChannelTypes().GUILD_DIRECTORY);

        const response = await requestJson(harness.app, "/channels/directory-channel/directory-entries/search?query=study&type=0&category_id=1");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
        assert.deepEqual(harness.channelFindOptions, [
            {
                where: { id: "directory-channel" },
                select: {
                    id: true,
                    guild_id: true,
                    type: true,
                },
            },
        ]);
        assert.deepEqual(harness.routeModule.getDirectoryEntrySearchResults({ query: "study", type: 0, category_id: 1 }), []);
    });

    test("rejects search for non-directory channels", async (t) => {
        const harness = setupDirectoryEntriesRoute(t, harnessChannelTypes().GUILD_TEXT);

        const response = await requestJson(harness.app, "/channels/text-channel/directory-entries/search?query=study");

        assert.equal(response.status, 400);
        assert.deepEqual(response.body, {
            code: harness.apiErrors.CANNOT_EXECUTE_ON_THIS_CHANNEL_TYPE.code,
            message: harness.apiErrors.CANNOT_EXECUTE_ON_THIS_CHANNEL_TYPE.message,
        });
    });

    test("validates documented search query fields", (t) => {
        const harness = setupDirectoryEntriesRoute(t, harnessChannelTypes().GUILD_DIRECTORY);

        assert.deepEqual(
            harness.routeModule.parseDirectoryEntrySearchQuery({
                query: "study",
                type: "1",
                category_id: "5",
            } as never),
            {
                query: "study",
                type: 1,
                category_id: 5,
            },
        );
        assertDirectorySearchFieldError(() => harness.routeModule.parseDirectoryEntrySearchQuery({} as never), "query", "BASE_TYPE_REQUIRED");
        assertDirectorySearchFieldError(() => harness.routeModule.parseDirectoryEntrySearchQuery({ query: "" } as never), "query", "BASE_TYPE_BAD_LENGTH");
        assertDirectorySearchFieldError(() => harness.routeModule.parseDirectoryEntrySearchQuery({ query: "x".repeat(101) } as never), "query", "BASE_TYPE_BAD_LENGTH");
        assertDirectorySearchFieldError(() => harness.routeModule.parseDirectoryEntrySearchQuery({ query: "study", type: "2" } as never), "type", "BASE_TYPE_CHOICES");
        assertDirectorySearchFieldError(
            () => harness.routeModule.parseDirectoryEntrySearchQuery({ query: "study", category_id: "4" } as never),
            "category_id",
            "BASE_TYPE_CHOICES",
        );
    });

    test("declares VIEW_CHANNEL metadata, query metadata, and compatibility response schemas", (t) => {
        const harness = setupDirectoryEntriesRoute(t, harnessChannelTypes().GUILD_DIRECTORY);

        assert.deepEqual(harness.routeOptions[1], {
            permission: "VIEW_CHANNEL",
            summary: "Search Directory Entries",
            query: {
                query: {
                    type: "string",
                    required: true,
                    description: "Directory entry search text to match. Discord documents 1 to 100 characters.",
                },
                type: {
                    type: "integer",
                    description: "Directory entry type to filter by.",
                    values: ["0", "1"],
                },
                category_id: {
                    type: "integer",
                    description: "Directory entry primary category to filter by.",
                    values: ["0", "1", "2", "3", "5"],
                },
            },
            responses: {
                200: {
                    body: "HubDirectoryEntriesResponse",
                },
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
                403: {
                    body: "APIErrorResponse",
                },
                404: {
                    body: "APIErrorResponse",
                },
            },
        });
    });

    test("validates the generated directory entries response schema", () => {
        const schemas = JSON.parse(readFileSync(path.join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, unknown>;
        const ajv = new Ajv({
            allErrors: true,
            schemas: JSON.parse(JSON.stringify(schemas).replaceAll("#/definitions/", "")),
            strict: true,
            strictRequired: true,
            allowUnionTypes: true,
        });

        const validate = ajv.getSchema("HubDirectoryEntriesResponse");
        assert.ok(validate);
        assert.equal(validate([]), true);
    });

    test("declares generated route catalog, OpenAPI, manifest, contract, and missing-route metadata", () => {
        const openapi = readJson<OpenApiDocument>(path.join(process.cwd(), "assets", "openapi.json"));
        const manifest = readJson<TestingManifest>(path.join(process.cwd(), "assets", "testing-manifest.json"));
        const sourceCatalog = readJson<SourceRouteCatalogEntry[]>(
            path.join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"),
        );
        const contracts = readJson<HttpContractCatalog>(path.join(process.cwd(), "test", "generated", "http-contracts.json"));
        const suiteCoverage = readJson<SuiteCoverageCatalog>(path.join(process.cwd(), "test", "generated", "suite-coverage.json"));
        const missingRoutes = readJson<MissingRoutesReport>(path.join(process.cwd(), "packages", "missing-routes", "missing.json"));

        const route = openapi.paths?.["/channels/{channel_id}/directory-entries/search"]?.get;
        assert.equal(route?.summary, "Search Directory Entries");
        assert.equal(route?.["x-permission-required"], "VIEW_CHANNEL");
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/HubDirectoryEntriesResponse");
        assert.equal(route?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(
            route?.parameters?.filter((parameter) => parameter.in === "query").map((parameter) => [parameter.name, parameter.required, parameter.schema?.type]),
            [
                ["query", true, "string"],
                ["type", undefined, "integer"],
                ["category_id", undefined, "integer"],
            ],
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/channels/#channel_id/directory-entries.ts");
        assert.equal(manifestEntry?.routeMetadata?.permission, "VIEW_CHANNEL");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("HubDirectoryEntriesResponse"), true);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [200, 400, 401, 403, 404],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/channels/{channel_id}/directory-entries/search");
        assert.equal(catalogEntry?.route_name, "GET_CHANNELS_CHANNEL_ID_DIRECTORY_ENTRIES_SEARCH");
        assert.equal(catalogEntry?.source, "src/api/routes/channels/#channel_id/directory-entries.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "HubDirectoryEntriesResponse"]);

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestId);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.path, "/channels/:channel_id/directory-entries/search");
        assert.equal(contract?.routeMetadata?.permission, "VIEW_CHANNEL");
        assert.equal(contract?.routeMetadata?.responses?.includes("HubDirectoryEntriesResponse"), true);
        assert.equal(contract?.routeMetadata?.responseStatuses?.includes(403), true);
        assert.equal(contract?.contractChecks?.includes("permission-denied"), true);

        assert.equal(JSON.stringify(suiteCoverage).includes(coveredManifestId), true);
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "GET" && entry.route === "/channels/{param}/directory-entries/search"),
            false,
        );
    });
});

function harnessChannelTypes() {
    return (requireModule("@spacebar/schemas") as typeof import("../../src/schemas")).ChannelType;
}

function setupDirectoryEntriesRoute(t: TestContext, channelType: number) {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../src/api/util/handlers/route");
    const util = requireModule("@spacebar/util") as typeof import("../../src/util");

    const routeOptions: unknown[] = [];
    const channelFindOptions: unknown[] = [];

    t.mock.method(routeHandler, "route", (options: unknown) => {
        routeOptions.push(options);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });
    t.mock.method(util.Channel, "findOneOrFail", async (options: unknown) => {
        channelFindOptions.push(options);

        return {
            id: "directory-channel",
            guild_id: "hub-guild",
            type: channelType,
        };
    });

    delete require.cache[routeModulePath];
    const routeModule = requireModule(routeModulePath) as typeof import("../../src/api/routes/channels/#channel_id/directory-entries");
    const app = express();
    app.use("/channels/:channel_id/directory-entries", routeModule.default);
    app.use(
        (
            error: { code?: number; message?: string; status?: number; statusCode?: number; errors?: unknown },
            _req: express.Request,
            res: express.Response,
            _next: express.NextFunction,
        ) => {
            res.status(error.status ?? error.statusCode ?? 400).json({
                code: error.code,
                message: error.message,
                ...(error.errors ? { errors: error.errors } : {}),
            });
        },
    );

    return {
        app,
        apiErrors: util.DiscordApiErrors,
        routeModule,
        get routeOptions() {
            return routeOptions;
        },
        get channelFindOptions() {
            return channelFindOptions;
        },
    };
}

function assertDirectorySearchFieldError(action: () => unknown, field: string, code: string) {
    assert.throws(action, (error) => {
        const fieldError = error as { errors?: Record<string, { _errors?: { code?: string }[] }> };
        assert.equal(fieldError.errors?.[field]?._errors?.[0]?.code, code);
        return true;
    });
}

async function requestJson(app: express.Express, requestPath: string): Promise<{ status: number; body: unknown }> {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`);

        return {
            status: response.status,
            body: (await response.json()) as unknown,
        };
    } finally {
        server.close();
    }
}

function readJson<T>(filePath: string): T {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

type JsonSchema = {
    $ref?: string;
    type?: string;
    additionalProperties?: JsonSchema | boolean;
};

type OpenApiDocument = {
    paths?: Record<
        string,
        {
            get?: {
                summary?: string;
                "x-permission-required"?: string;
                security?: unknown;
                responses?: Record<string, { content?: Record<string, { schema?: JsonSchema }> }>;
                parameters?: Array<{
                    name?: string;
                    in?: string;
                    required?: boolean;
                    schema?: JsonSchema;
                }>;
            };
        }
    >;
};

type TestingManifest = {
    entries?: Array<{
        id?: string;
        authMode?: string;
        sourceFile?: string;
        routeMetadata?: {
            permission?: string;
            responseBodies?: string[];
            responseStatuses?: number[];
        };
    }>;
};

type SourceRouteCatalogEntry = {
    method?: string;
    route?: string;
    route_name?: string;
    source?: string;
    response_schema_refs?: string[];
};

type HttpContractCatalog = {
    contracts?: Array<{
        manifestId?: string;
        authMode?: string;
        path?: string;
        contractChecks?: string[];
        routeMetadata?: {
            permission?: string;
            responses?: string[];
            responseStatuses?: number[];
        };
    }>;
};

type SuiteCoverageCatalog = {
    suites?: unknown[];
};

type MissingRoutesReport = {
    missing_entries: Array<{
        method: string;
        route: string;
    }>;
};
