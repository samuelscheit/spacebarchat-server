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
const coveredManifestId = "api:http:GET:/guilds/:guild_id/analytics/engagement/overview/";

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

const routeModulePath = distModulePath("api", "routes", "guilds", "#guild_id", "analytics", "engagement", "overview.js");

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("GET /guilds/:guild_id/analytics/engagement/overview", () => {
    test("declares the guild analytics manifest route id covered by this suite", () => {
        assert.equal(coveredManifestId, "api:http:GET:/guilds/:guild_id/analytics/engagement/overview/");
    });

    test("registers the guild insights route metadata", (t) => {
        const harness = setupGuildEngagementOverviewRoute(t);

        assert.deepEqual(harness.routeOptions, {
            summary: "Get Guild Engagement Overview",
            description: "Returns general guild engagement statistics per aggregation interval.",
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
                    body: "GuildEngagementOverviewResponse",
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

    test("returns a conservative empty engagement overview list for a valid analytics query", async (t) => {
        const harness = setupGuildEngagementOverviewRoute(t);

        const response = await requestJson(harness.app, "/guilds/guild-id/analytics/engagement/overview?start=2026-05-01T00%3A00%3A00Z&end=2026-05-08T00%3A00%3A00Z&interval=1");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
        assert.deepEqual(harness.routeModule.createGuildEngagementOverviewResponse(), []);
        assert.deepEqual(harness.guildFindOptions, [
            {
                where: { id: "guild-id" },
                select: { id: true },
            },
        ]);
    });

    test("rejects unsupported aggregation intervals before guild lookup", async (t) => {
        const harness = setupGuildEngagementOverviewRoute(t);

        const response = await requestJson(harness.app, "/guilds/guild-id/analytics/engagement/overview?interval=4");

        assert.equal(response.status, 422);
        assert.deepEqual(response.body, { message: "interval must be one of 0, 1, 2, or 3" });
        assert.deepEqual(harness.guildFindOptions, []);
    });

    test("rejects inverted time ranges before guild lookup", async (t) => {
        const harness = setupGuildEngagementOverviewRoute(t);

        const response = await requestJson(harness.app, "/guilds/guild-id/analytics/engagement/overview?start=2026-05-08T00%3A00%3A00Z&end=2026-05-01T00%3A00%3A00Z");

        assert.equal(response.status, 422);
        assert.deepEqual(response.body, { message: "start must be before or equal to end" });
        assert.deepEqual(harness.guildFindOptions, []);
    });

    test("declares generated response schema, route catalog, manifest, and contract metadata", () => {
        const schemas = readJson<Record<string, JsonSchema>>(path.join(process.cwd(), "assets", "schemas.json"));
        const openapi = readJson<OpenApiDocument>(path.join(process.cwd(), "assets", "openapi.json"));
        const manifest = readJson<TestingManifest>(path.join(process.cwd(), "assets", "testing-manifest.json"));
        const contracts = readJson<HttpContracts>(path.join(process.cwd(), "test", "generated", "http-contracts.json"));
        const sourceCatalog = readJson<SourceRouteCatalogEntry[]>(
            path.join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"),
        );
        const missingRoutes = readJson<MissingRoutesReport>(path.join(process.cwd(), "packages", "missing-routes", "missing.json"));

        assert.equal(schemas.GuildEngagementOverviewResponse?.type, "array");
        assert.equal(schemas.GuildEngagementOverviewResponse?.items?.$ref, "#/definitions/GuildEngagementOverviewBucket");
        assert.deepEqual(schemas.GuildEngagementOverviewBucket?.required?.sort(), ["communicators", "day_pt", "messages", "speaking_minutes", "visitors"]);
        assert.equal(schemas.GuildEngagementOverviewBucket?.properties?.day_pt?.type, "string");
        assert.equal(schemas.GuildEngagementOverviewBucket?.properties?.visitors?.type, "integer");
        assert.equal(schemas.GuildEngagementOverviewBucket?.properties?.communicators?.type, "integer");
        assert.equal(schemas.GuildEngagementOverviewBucket?.properties?.messages?.type, "integer");
        assert.equal(schemas.GuildEngagementOverviewBucket?.properties?.speaking_minutes?.type, "integer");

        const route = openapi.paths?.["/guilds/{guild_id}/analytics/engagement/overview/"]?.get;
        assert.equal(route?.summary, "Get Guild Engagement Overview");
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/GuildEngagementOverviewResponse");
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
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/guilds/#guild_id/analytics/engagement/overview.ts");
        assert.equal(manifestEntry?.routeMetadata?.permission, "VIEW_GUILD_INSIGHTS");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("GuildEngagementOverviewResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [200, 401, 403, 404, 422],
        );

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestId);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.path, "/guilds/:guild_id/analytics/engagement/overview/");
        assert.equal(contract?.routeMetadata?.permission, "VIEW_GUILD_INSIGHTS");
        assert.equal(contract?.routeMetadata?.responses?.includes("GuildEngagementOverviewResponse"), true);
        assert.equal(contract?.routeMetadata?.responseStatuses?.includes(422), true);

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/guilds/{guild_id}/analytics/engagement/overview");
        assert.equal(catalogEntry?.route_name, "GET_GUILDS_GUILD_ID_ANALYTICS_ENGAGEMENT_OVERVIEW");
        assert.equal(catalogEntry?.source, "src/api/routes/guilds/#guild_id/analytics/engagement/overview.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "GuildEngagementOverviewResponse"]);

        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "GET" && entry.route === "/guilds/{param}/analytics/engagement/overview"),
            false,
        );
    });
});

function setupGuildEngagementOverviewRoute(t: TestContext) {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../../../util/handlers/route");
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
    const routeModule = requireModule(routeModulePath) as typeof import("./overview");
    const app = express();
    app.use("/guilds/:guild_id/analytics/engagement/overview", routeModule.default);
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

type HttpContracts = {
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

type SourceRouteCatalogEntry = {
    method?: string;
    response_schema_refs?: string[];
    route?: string;
    route_name?: string;
    source?: string;
};

type MissingRoutesReport = {
    missing_entries: {
        method?: string;
        route?: string;
    }[];
};
