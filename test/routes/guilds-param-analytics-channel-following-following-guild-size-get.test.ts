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
import express from "express";

const requireModule = require;
const coveredManifestId = "api:http:GET:/guilds/:guild_id/analytics/channel-following/following-guild-size/";

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

const routeModulePath = distModulePath("api", "routes", "guilds", "#guild_id", "analytics", "channel-following", "following-guild-size.js");

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("GET /guilds/:guild_id/analytics/channel-following/following-guild-size", () => {
    test("registers the guild insights route metadata", (t) => {
        const harness = setupGuildChannelFollowingGuildSizeRoute(t);

        assert.deepEqual(harness.routeOptions, {
            summary: "Get Guild Channel Following Guild Size",
            description: "Returns followed channel statistics categorized by following guild size per aggregation interval.",
            permission: "VIEW_GUILD_INSIGHTS",
            query: {
                start: {
                    type: "string",
                    description: "Start date for the insights data as an ISO8601 timestamp.",
                },
                end: {
                    type: "string",
                    description: "End date for the insights data as an ISO8601 timestamp.",
                },
                interval: {
                    type: "integer",
                    description: "Aggregation interval: 0 hourly, 1 daily, 2 weekly, or 3 monthly.",
                    values: ["0", "1", "2", "3"],
                },
            },
            responses: {
                200: {
                    body: "GuildChannelFollowingGuildSizeResponse",
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
                422: {
                    body: "APIErrorResponse",
                },
            },
        });
    });

    test("returns a conservative empty channel-following guild-size list for a valid analytics query", async (t) => {
        const harness = setupGuildChannelFollowingGuildSizeRoute(t);

        const response = await requestJson(
            harness.app,
            "/guilds/guild-id/analytics/channel-following/following-guild-size?start=2026-01-01T00%3A00%3A00.000Z&end=2026-01-02T00%3A00%3A00.000Z&interval=1",
        );

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
        assert.deepEqual(harness.guildFindOptions, [
            {
                where: { id: "guild-id" },
                select: { id: true },
            },
        ]);
        assert.deepEqual(harness.routeModule.createGuildChannelFollowingGuildSizeResponse(), []);
    });

    test("rejects unsupported aggregation intervals before guild lookup", async (t) => {
        const harness = setupGuildChannelFollowingGuildSizeRoute(t);

        const response = await requestJson(harness.app, "/guilds/guild-id/analytics/channel-following/following-guild-size?interval=4");

        assert.equal(response.status, 422);
        assert.deepEqual(response.body, { message: "interval must be one of 0, 1, 2, or 3" });
        assert.deepEqual(harness.guildFindOptions, []);
    });

    test("rejects reversed analytics windows before guild lookup", async (t) => {
        const harness = setupGuildChannelFollowingGuildSizeRoute(t);

        const response = await requestJson(
            harness.app,
            "/guilds/guild-id/analytics/channel-following/following-guild-size?start=2026-01-02T00%3A00%3A00.000Z&end=2026-01-01T00%3A00%3A00.000Z",
        );

        assert.equal(response.status, 422);
        assert.deepEqual(response.body, { message: "start must be before or equal to end" });
        assert.deepEqual(harness.guildFindOptions, []);
    });

    test("validates documented channel-following guild-size buckets", () => {
        const validator = requireModule(distModulePath("schemas", "Validator.js")) as typeof import("../../src/schemas/Validator");
        const response = [
            {
                day_pt: "2026-05-01T00:00:00Z",
                guild_size: "1-99",
                total_guilds_following: 128,
            },
        ];

        assert.equal(validator.ajv.validate("GuildChannelFollowingGuildSizeResponse", response), true);
        assert.equal(validator.ajv.validate("GuildChannelFollowingGuildSizeResponse", []), true);
        assert.equal(
            validator.ajv.validate("GuildChannelFollowingGuildSizeResponse", [
                {
                    day_pt: "2026-05-01T00:00:00Z",
                    guild_size: "1-99",
                },
            ]),
            false,
        );
    });

    test("declares generated response schema, route catalog, contract, and manifest metadata", () => {
        const schemas = readJson<Record<string, JsonSchema>>(path.join(process.cwd(), "assets", "schemas.json"));
        const openapi = readJson<OpenApiDocument>(path.join(process.cwd(), "assets", "openapi.json"));
        const manifest = readJson<TestingManifest>(path.join(process.cwd(), "assets", "testing-manifest.json"));
        const sourceCatalog = readJson<SourceRouteCatalogEntry[]>(
            path.join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"),
        );
        const contracts = readJson<HttpContractCatalog>(path.join(process.cwd(), "test", "generated", "http-contracts.json"));
        const missingRoutes = readJson<MissingRoutesReport>(path.join(process.cwd(), "packages", "missing-routes", "missing.json"));

        assert.equal(schemas.GuildChannelFollowingGuildSizeResponse?.type, "array");
        assert.equal(schemas.GuildChannelFollowingGuildSizeResponse?.items?.$ref, "#/definitions/GuildChannelFollowingGuildSizeBucket");
        assert.deepEqual(schemas.GuildChannelFollowingGuildSizeBucket?.required?.sort(), ["day_pt", "guild_size", "total_guilds_following"]);
        assert.equal(schemas.GuildChannelFollowingGuildSizeBucket?.properties?.day_pt?.type, "string");
        assert.equal(schemas.GuildChannelFollowingGuildSizeBucket?.properties?.guild_size?.type, "string");
        assert.equal(schemas.GuildChannelFollowingGuildSizeBucket?.properties?.total_guilds_following?.type, "integer");

        const route = openapi.paths?.["/guilds/{guild_id}/analytics/channel-following/following-guild-size/"]?.get;
        assert.equal(route?.summary, "Get Guild Channel Following Guild Size");
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/GuildChannelFollowingGuildSizeResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["422"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.deepEqual(
            route?.parameters?.filter((parameter) => parameter.in === "query").map((parameter) => parameter.name),
            ["start", "end", "interval"],
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/guilds/#guild_id/analytics/channel-following/following-guild-size.ts");
        assert.equal(manifestEntry?.routeMetadata?.permission, "VIEW_GUILD_INSIGHTS");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("GuildChannelFollowingGuildSizeResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [200, 401, 403, 404, 422],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/guilds/{guild_id}/analytics/channel-following/following-guild-size");
        assert.equal(catalogEntry?.route_name, "GET_GUILDS_GUILD_ID_ANALYTICS_CHANNEL_FOLLOWING_FOLLOWING_GUILD_SIZE");
        assert.equal(catalogEntry?.source, "src/api/routes/guilds/#guild_id/analytics/channel-following/following-guild-size.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "GuildChannelFollowingGuildSizeResponse"]);

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestId);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.path, "/guilds/:guild_id/analytics/channel-following/following-guild-size/");
        assert.equal(contract?.routeMetadata?.permission, "VIEW_GUILD_INSIGHTS");
        assert.equal(contract?.routeMetadata?.responses?.includes("GuildChannelFollowingGuildSizeResponse"), true);
        assert.equal(contract?.routeMetadata?.responseStatuses?.includes(401), true);
        assert.equal(contract?.routeMetadata?.responseStatuses?.includes(403), true);

        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "GET" && entry.route === "/guilds/{param}/analytics/channel-following/following-guild-size"),
            false,
        );
    });
});

function setupGuildChannelFollowingGuildSizeRoute(t: TestContext) {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../src/api/util/handlers/route");
    const util = requireModule("@spacebar/util") as typeof import("@spacebar/util");
    const routeOptions: unknown[] = [];
    const guildFindOptions: unknown[] = [];

    t.mock.method(routeHandler, "route", (options: unknown) => {
        routeOptions.push(options);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });
    t.mock.method(util.Guild, "findOneOrFail", async (findOptions: unknown) => {
        guildFindOptions.push(findOptions);
        return { id: "guild-id" };
    });

    delete require.cache[routeModulePath];
    const routeModule = requireModule(routeModulePath) as typeof import("../../src/api/routes/guilds/#guild_id/analytics/channel-following/following-guild-size");
    const app = express();
    app.use("/guilds/:guild_id/analytics/channel-following/following-guild-size", routeModule.default);
    app.use((error: { code?: number; message?: string; status?: number; statusCode?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(error.status ?? error.statusCode ?? error.code ?? 500).json({ message: error.message });
    });

    return {
        app,
        routeModule,
        get routeOptions() {
            return routeOptions[0];
        },
        get guildFindOptions() {
            return guildFindOptions;
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
            body: await response.json(),
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

function readJson<T>(filename: string): T {
    return JSON.parse(readFileSync(filename, "utf8")) as T;
}

type JsonSchema = {
    type?: string;
    $ref?: string;
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
    required?: string[];
};

type OpenApiDocument = {
    paths?: Record<
        string,
        {
            get?: {
                summary?: string;
                parameters?: { name?: string; in?: string }[];
                responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                security?: unknown;
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
            hasQuery?: boolean;
            responseBodies?: string[];
            responseStatuses?: number[];
        };
    }[];
};

type SourceRouteCatalogEntry = {
    method?: string;
    response_schema_refs?: string[];
    route?: string;
    route_name?: string;
    source?: string;
};

type HttpContractCatalog = {
    contracts?: {
        manifestId?: string;
        authMode?: string;
        path?: string;
        routeMetadata?: {
            permission?: string;
            responses?: string[];
            responseStatuses?: number[];
        };
    }[];
};

type MissingRoutesReport = {
    missing_entries: {
        method?: string;
        route?: string;
    }[];
};
