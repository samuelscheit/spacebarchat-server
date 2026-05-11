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
const coveredManifestId = "api:http:GET:/channels/:channel_id/directory-entries/list";

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

const routeModulePath = distModulePath("api", "routes", "channels", "#channel_id", "directory-entries.js");

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("GET /channels/:channel_id/directory-entries/list", () => {
    test("returns an empty partial directory entry list while entries are not persisted", async (t) => {
        const harness = setupDirectoryEntriesRoute(t, harnessChannelTypes().GUILD_DIRECTORY);

        const response = await requestJson(harness.app, "/channels/directory-channel/directory-entries/list?entity_ids=111,222&entity_ids[]=333");

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
        assert.deepEqual(harness.routeModule.parseDirectoryEntryListQuery({ entity_ids: ["111, 222", "111"], "entity_ids[]": "333" }), {
            entity_ids: ["111", "222", "333"],
        });
    });

    test("rejects list requests for non-directory channels", async (t) => {
        const harness = setupDirectoryEntriesRoute(t, harnessChannelTypes().GUILD_TEXT);

        const response = await requestJson(harness.app, "/channels/text-channel/directory-entries/list");

        assert.equal(response.status, 400);
        assert.deepEqual(response.body, {
            code: harness.apiErrors.CANNOT_EXECUTE_ON_THIS_CHANNEL_TYPE.code,
            message: harness.apiErrors.CANNOT_EXECUTE_ON_THIS_CHANNEL_TYPE.message,
        });
    });

    test("validates entity_ids as an optional max-100 snowflake array", async (t) => {
        const harness = setupDirectoryEntriesRoute(t, harnessChannelTypes().GUILD_DIRECTORY);

        assert.deepEqual(harness.routeModule.parseDirectoryEntryListQuery({}), { entity_ids: [] });
        assert.throws(() => harness.routeModule.parseDirectoryEntryListQuery({ entity_ids: "not-a-snowflake" }), {
            code: 50035,
            message: "Invalid Form Body",
        });
        assert.throws(() => harness.routeModule.parseDirectoryEntryListQuery({ entity_ids: Array.from({ length: 101 }, (_, index) => `${index + 1}`) }), {
            code: 50035,
            message: "Invalid Form Body",
        });

        const response = await requestJson(harness.app, "/channels/directory-channel/directory-entries/list?entity_ids=not-a-snowflake");

        assert.equal(response.status, 400);
        assert.deepEqual(response.body, {
            code: 50035,
            message: "Invalid Form Body",
            errors: {
                entity_ids: {
                    _errors: [
                        {
                            code: "BASE_TYPE_INVALID",
                            message: "entity_ids must contain valid snowflakes",
                        },
                    ],
                },
            },
        });
    });

    test("declares VIEW_CHANNEL metadata, entity_ids query metadata, and compatibility response schemas", (t) => {
        const harness = setupDirectoryEntriesRoute(t, harnessChannelTypes().GUILD_DIRECTORY);
        const listRouteOptions = harness.routeOptions.find((option) => (option as { summary?: string }).summary === "Get Partial Directory Entries");

        assert.deepEqual(listRouteOptions, {
            permission: "VIEW_CHANNEL",
            summary: "Get Partial Directory Entries",
            query: {
                entity_ids: {
                    type: "array",
                    description: "The IDs of the directory entries to retrieve (max 100).",
                },
            },
            responses: {
                200: {
                    body: "HubPartialDirectoryEntriesResponse",
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

    test("validates the generated partial directory entry response schema", () => {
        const schemas = readJson<Record<string, JsonSchema>>(path.join(process.cwd(), "assets", "schemas.json"));
        const ajv = new Ajv({
            allErrors: true,
            schemas: JSON.parse(JSON.stringify(schemas).replaceAll("#/definitions/", "")),
            strict: true,
            strictRequired: true,
            allowUnionTypes: true,
        });

        const validate = ajv.getSchema("HubPartialDirectoryEntriesResponse");
        assert.ok(validate);

        assert.equal(schemas.HubPartialDirectoryEntriesResponse?.items?.$ref, "#/definitions/HubPartialDirectoryEntry");
        assert.equal(schemas.HubPartialDirectoryEntry?.properties?.guild, undefined);
        assert.equal(schemas.HubPartialDirectoryEntry?.properties?.guild_scheduled_event, undefined);
        assert.equal(validate([]), true);
        assert.equal(
            validate([
                {
                    type: 0,
                    directory_channel_id: "123",
                    entity_id: "456",
                    created_at: "2026-05-06T00:00:00.000Z",
                    description: null,
                    author_id: "789",
                },
            ]),
            true,
        );
        assert.equal(
            validate([
                {
                    type: 0,
                    directory_channel_id: "123",
                    entity_id: "456",
                    created_at: "2026-05-06T00:00:00.000Z",
                    description: null,
                    author_id: "789",
                    guild: {
                        id: "456",
                        name: "Directory Guild",
                    },
                },
            ]),
            false,
        );
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

        const route = openapi.paths?.["/channels/{channel_id}/directory-entries/list"]?.get;
        assert.equal(route?.summary, "Get Partial Directory Entries");
        assert.equal(route?.["x-permission-required"], "VIEW_CHANNEL");
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/HubPartialDirectoryEntriesResponse");
        assert.equal(route?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(
            route?.parameters?.some((parameter) => parameter.in === "query" && parameter.name === "entity_ids"),
            true,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/channels/#channel_id/directory-entries.ts");
        assert.equal(manifestEntry?.routeMetadata?.permission, "VIEW_CHANNEL");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("HubPartialDirectoryEntriesResponse"), true);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [200, 400, 401, 403, 404],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/channels/{channel_id}/directory-entries/list");
        assert.equal(catalogEntry?.route_name, "GET_CHANNELS_CHANNEL_ID_DIRECTORY_ENTRIES_LIST");
        assert.equal(catalogEntry?.source, "src/api/routes/channels/#channel_id/directory-entries.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "HubPartialDirectoryEntriesResponse"]);

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestId);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.path, "/channels/:channel_id/directory-entries/list");
        assert.equal(contract?.routeMetadata?.permission, "VIEW_CHANNEL");
        assert.equal(contract?.routeMetadata?.responses?.includes("HubPartialDirectoryEntriesResponse"), true);
        assert.equal(contract?.routeMetadata?.responseStatuses?.includes(403), true);
        assert.equal(contract?.contractChecks?.includes("permission-denied"), true);

        assert.equal(JSON.stringify(suiteCoverage).includes(coveredManifestId), true);
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "GET" && entry.route === "/channels/{param}/directory-entries/list"),
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
            error: { code?: number; errors?: unknown; message?: string; status?: number; statusCode?: number },
            _req: express.Request,
            res: express.Response,
            _next: express.NextFunction,
        ) => {
            const body: { code?: number; errors?: unknown; message?: string } = {
                code: error.code,
                message: error.message,
            };
            if (error.errors) body.errors = error.errors;
            res.status(error.status ?? error.statusCode ?? 400).json(body);
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
    type?: string | string[];
    items?: JsonSchema;
    properties?: Record<string, JsonSchema | undefined>;
};

type OpenApiDocument = {
    paths?: Record<
        string,
        {
            get?: {
                summary?: string;
                "x-permission-required"?: string;
                security?: unknown;
                parameters?: { name?: string; in?: string; schema?: JsonSchema }[];
                responses?: Record<string, { content?: Record<string, { schema?: JsonSchema }> }>;
            };
        }
    >;
};

type TestingManifest = {
    entries?: {
        id?: string;
        authMode?: string;
        sourceFile?: string;
        routeMetadata?: {
            permission?: string;
            responseBodies?: string[];
            responseStatuses?: number[];
        };
    }[];
};

type SourceRouteCatalogEntry = {
    method?: string;
    route?: string;
    route_name?: string;
    source?: string;
    response_schema_refs?: string[];
};

type HttpContractCatalog = {
    contracts?: {
        manifestId?: string;
        authMode?: string;
        path?: string;
        contractChecks?: string[];
        routeMetadata?: {
            permission?: string;
            responses?: string[];
            responseStatuses?: number[];
        };
    }[];
};

type SuiteCoverageCatalog = {
    suites?: unknown[];
};

type MissingRoutesReport = {
    missing_entries: {
        method: string;
        route: string;
    }[];
};
