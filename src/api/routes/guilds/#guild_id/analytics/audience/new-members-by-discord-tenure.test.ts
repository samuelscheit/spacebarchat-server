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
import Module from "node:module";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { afterEach, describe, test, type TestContext } from "node:test";
import express from "express";

const coveredManifestIds = ["api:http:GET:/guilds/:guild_id/analytics/audience/new-members-by-discord-tenure/"];

type LoadFunction = (request: string, parent?: NodeJS.Module | null, isMain?: boolean) => unknown;
type JsonSchema = {
    $ref?: string;
    type?: string;
    items?: JsonSchema;
    required?: string[];
    properties?: Record<string, JsonSchema>;
};

const requireModule = require;
const routeModulePath = require.resolve("./new-members-by-discord-tenure");
const moduleLoader = Module as unknown as { _load: LoadFunction };
const originalLoad = moduleLoader._load;

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("GET /guilds/:guild_id/analytics/audience/new-members-by-discord-tenure", () => {
    test("declares the guild analytics manifest route id covered by this suite", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/guilds/:guild_id/analytics/audience/new-members-by-discord-tenure/"]);
    });

    test("uses guild insights auth metadata and documents the response schema", (t) => {
        const harness = setupGuildAudienceRoute(t);

        assert.deepEqual(harness.routeOptions, [
            {
                summary: "Get Guild Audience New Members by Discord Tenure",
                description: "Returns new member statistics categorized by account age per aggregation interval.",
                permission: "VIEW_GUILD_INSIGHTS",
                query: {
                    start: {
                        type: "string",
                        description: "ISO8601 start timestamp for the insights data",
                    },
                    end: {
                        type: "string",
                        description: "ISO8601 end timestamp for the insights data",
                    },
                    interval: {
                        type: "integer",
                        description: "Data aggregation interval: 0 hourly, 1 daily, 2 weekly, or 3 monthly",
                    },
                },
                responses: {
                    200: {
                        body: "GuildAudienceNewMembersByDiscordTenureResponse",
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
            },
        ]);
    });

    test("returns a conservative empty analytics list until source-backed aggregates exist", async (t) => {
        const harness = setupGuildAudienceRoute(t);

        const response = await requestJson(
            harness.app,
            "/guilds/guild-id/analytics/audience/new-members-by-discord-tenure?start=2026-05-01T00%3A00%3A00Z&end=2026-05-08T00%3A00%3A00Z&interval=1",
        );

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
        assert.deepEqual(harness.routeModule.getGuildAudienceNewMembersByDiscordTenure(), []);
    });

    test("generates response schema, route catalogs, and manifest metadata", () => {
        const schemas = readJson<Record<string, JsonSchema>>(join(process.cwd(), "assets", "schemas.json"));
        const openapi = readJson<{
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
        }>(join(process.cwd(), "assets", "openapi.json"));
        const sourceCatalog = readJson<
            {
                method?: string;
                route?: string;
                source?: string;
                response_schema_refs?: string[];
            }[]
        >(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const manifest = readJson<{
            entries?: {
                id?: string;
                authMode?: string;
                sourceFile?: string;
                routeMetadata?: {
                    permission?: string;
                    responseBodies?: string[];
                    responseStatuses?: number[];
                    hasQuery?: boolean;
                };
            }[];
        }>(join(process.cwd(), "assets", "testing-manifest.json"));
        const contracts = readJson<{
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
        }>(join(process.cwd(), "test", "generated", "http-contracts.json"));
        const missingRoutes = readJson<{
            missing_entries?: { method?: string; route?: string; route_name?: string }[];
        }>(join(process.cwd(), "packages", "missing-routes", "missing.json"));

        assert.equal(schemas.GuildAudienceNewMembersByDiscordTenureResponse.type, "array");
        assert.equal(schemas.GuildAudienceNewMembersByDiscordTenureResponse.items?.$ref, "#/definitions/GuildAudienceNewMembersByDiscordTenureBucket");
        assert.deepEqual(schemas.GuildAudienceNewMembersByDiscordTenureBucket.required, ["day_pt", "new_members", "tenure"]);
        assert.equal(schemas.GuildAudienceNewMembersByDiscordTenureBucket.properties?.day_pt?.type, "string");
        assert.equal(schemas.GuildAudienceNewMembersByDiscordTenureBucket.properties?.tenure?.type, "string");
        assert.equal(schemas.GuildAudienceNewMembersByDiscordTenureBucket.properties?.new_members?.type, "integer");

        const route = openapi.paths?.["/guilds/{guild_id}/analytics/audience/new-members-by-discord-tenure/"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/GuildAudienceNewMembersByDiscordTenureResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.deepEqual(
            route?.parameters?.filter((parameter) => parameter.in === "query").map((parameter) => parameter.name),
            ["start", "end", "interval"],
        );

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/guilds/{guild_id}/analytics/audience/new-members-by-discord-tenure");
        assert.equal(sourceEntry?.source, "src/api/routes/guilds/#guild_id/analytics/audience/new-members-by-discord-tenure.ts");
        assert.equal(sourceEntry?.response_schema_refs?.includes("GuildAudienceNewMembersByDiscordTenureResponse"), true);
        assert.equal(sourceEntry?.response_schema_refs?.includes("APIErrorResponse"), true);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/guilds/#guild_id/analytics/audience/new-members-by-discord-tenure.ts");
        assert.equal(manifestEntry?.routeMetadata?.permission, "VIEW_GUILD_INSIGHTS");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("GuildAudienceNewMembersByDiscordTenureResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(200), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(401), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(403), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(404), true);

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.path, "/guilds/:guild_id/analytics/audience/new-members-by-discord-tenure/");
        assert.equal(contract?.routeMetadata?.permission, "VIEW_GUILD_INSIGHTS");
        assert.equal(contract?.routeMetadata?.responses?.includes("GuildAudienceNewMembersByDiscordTenureResponse"), true);
        assert.equal(contract?.routeMetadata?.responseStatuses?.includes(403), true);

        assert.equal(
            missingRoutes.missing_entries?.some(
                (entry) =>
                    entry.method === "GET" &&
                    entry.route === "/guilds/{param}/analytics/audience/new-members-by-discord-tenure" &&
                    entry.route_name === "GET_GUILDS_GUILD_ID_ANALYTICS_AUDIENCE_NEW_MEMBERS_BY_DISCORD_TENURE",
            ),
            false,
        );
    });
});

function setupGuildAudienceRoute(t: TestContext) {
    const routeOptions: unknown[] = [];

    moduleLoader._load = (request: string, parent?: NodeJS.Module | null, isMain?: boolean) => {
        if (request === "@spacebar/api") {
            return {
                route: (options: unknown) => {
                    routeOptions.push(options);
                    return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
                },
            };
        }

        return originalLoad(request, parent, isMain);
    };
    t.after(() => {
        moduleLoader._load = originalLoad;
    });

    delete require.cache[routeModulePath];
    const routeModule = requireModule(routeModulePath) as typeof import("./new-members-by-discord-tenure");
    const app = express();
    app.use("/guilds/:guild_id/analytics/audience/new-members-by-discord-tenure", routeModule.default);

    return {
        app,
        routeModule,
        get routeOptions() {
            return routeOptions;
        },
    };
}

function readJson<T>(path: string): T {
    return JSON.parse(readFileSync(path, "utf8")) as T;
}

async function requestJson(app: express.Express, requestPath: string): Promise<{ status: number; body: unknown }> {
    const server = await new Promise<ReturnType<express.Express["listen"]>>((resolve) => {
        const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });

    try {
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
        const response = await fetch(`http://127.0.0.1:${(address as AddressInfo).port}${requestPath}`);

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
