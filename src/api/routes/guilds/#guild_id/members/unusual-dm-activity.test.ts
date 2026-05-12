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
const coveredManifestId = "api:http:GET:/guilds/:guild_id/members/unusual-dm-activity/";

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

const routeModulePath = distModulePath("api", "routes", "guilds", "#guild_id", "members", "unusual-dm-activity.js");

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("GET /guilds/:guild_id/members/unusual-dm-activity", () => {
    test("registers documented route metadata without elevated permissions", (t) => {
        const harness = setupGuildMemberUnusualDmActivityRoute(t);

        assert.deepEqual(harness.routeOptions, {
            summary: "Get Guild Members With Unusual DM Activity",
            description: "Returns members with persisted unusual-DM activity. Spacebar does not currently persist this safety signal, so the local representation is empty.",
            query: {
                limit: {
                    type: "integer",
                    description: "Max number of members to return (max 1000, default 100).",
                },
                after: {
                    type: "string",
                    description: "Get members after this member ID.",
                },
            },
            responses: {
                200: {
                    body: "GuildMemberUnusualDmActivityResponse",
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
            },
        });
    });

    test("parses documented pagination defaults and bounds", (t) => {
        const harness = setupGuildMemberUnusualDmActivityRoute(t);

        assert.deepEqual(harness.routeModule.parseGuildMemberUnusualDmActivityQuery({}), { limit: 100 });
        assert.deepEqual(harness.routeModule.parseGuildMemberUnusualDmActivityQuery({ limit: "1000", after: "81384788765712384" }), {
            limit: 1000,
            after: "81384788765712384",
        });
        assert.throws(() => harness.routeModule.parseGuildMemberUnusualDmActivityQuery({ limit: "1001" }), /limit must be an integer between 1 and 1000/);
        assert.throws(() => harness.routeModule.parseGuildMemberUnusualDmActivityQuery({ after: "not-a-snowflake" }), /after must be a snowflake/);
    });

    test("returns a conservative empty activity list for guild members", async (t) => {
        const harness = setupGuildMemberUnusualDmActivityRoute(t);

        const response = await requestJson(harness.app, "/guilds/guild-id/members/unusual-dm-activity?limit=25&after=81384788765712384");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
        assert.deepEqual(harness.routeModule.getGuildMembersWithUnusualDmActivity(), []);
        assert.deepEqual(harness.memberChecks, [{ userId: "viewer", guildId: "guild-id" }]);
    });

    test("rejects invalid pagination before guild membership lookup", async (t) => {
        const harness = setupGuildMemberUnusualDmActivityRoute(t);

        const response = await requestJson(harness.app, "/guilds/guild-id/members/unusual-dm-activity?limit=0");

        assert.equal(response.status, 400);
        assert.deepEqual(response.body, { message: "limit must be an integer between 1 and 1000" });
        assert.deepEqual(harness.memberChecks, []);
    });

    test("requires the token user to be a guild member", async (t) => {
        const harness = setupGuildMemberUnusualDmActivityRoute(t, { memberCheckError: { status: 403, message: "You are not member of this guild" } });

        const response = await requestJson(harness.app, "/guilds/guild-id/members/unusual-dm-activity");

        assert.equal(response.status, 403);
        assert.deepEqual(response.body, { message: "You are not member of this guild" });
        assert.deepEqual(harness.memberChecks, [{ userId: "viewer", guildId: "guild-id" }]);
    });

    test("declares generated schema, route catalog, manifest, contract metadata, and GET missing-route removal", () => {
        const schemas = readJson<Record<string, JsonSchema>>(path.join(process.cwd(), "assets", "schemas.json"));
        const openapi = readJson<OpenApiDocument>(path.join(process.cwd(), "assets", "openapi.json"));
        const manifest = readJson<TestingManifest>(path.join(process.cwd(), "assets", "testing-manifest.json"));
        const sourceCatalog = readJson<SourceRouteCatalogEntry[]>(
            path.join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"),
        );
        const contracts = readJson<HttpContracts>(path.join(process.cwd(), "test", "generated", "http-contracts.json"));
        const missingRoutes = readJson<MissingRoutesReport>(path.join(process.cwd(), "packages", "missing-routes", "missing.json"));

        assert.equal(schemas.GuildMemberUnusualDmActivityResponse?.type, "array");
        assert.equal(schemas.GuildMemberUnusualDmActivityResponse?.items?.$ref, "#/definitions/GuildMemberUnusualDmActivity");
        assert.deepEqual(schemas.GuildMemberUnusualDmActivity?.required?.sort(), ["guild_id", "unusual_dm_activity_until", "user_id"]);
        assert.equal(schemas.GuildMemberUnusualDmActivity?.properties?.guild_id?.type, "string");
        assert.equal(schemas.GuildMemberUnusualDmActivity?.properties?.user_id?.type, "string");
        assert.equal(schemas.GuildMemberUnusualDmActivity?.properties?.unusual_dm_activity_until?.format, "date-time");

        const route = openapi.paths?.["/guilds/{guild_id}/members/unusual-dm-activity/"]?.get;
        assert.equal(route?.summary, "Get Guild Members With Unusual DM Activity");
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/GuildMemberUnusualDmActivityResponse");
        assert.equal(route?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.deepEqual(
            route?.parameters?.filter((parameter) => parameter.in === "query").map((parameter) => parameter.name),
            ["limit", "after"],
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/guilds/#guild_id/members/unusual-dm-activity.ts");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("GuildMemberUnusualDmActivityResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [200, 400, 401, 403],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/guilds/{guild_id}/members/unusual-dm-activity");
        assert.equal(catalogEntry?.route_name, "GET_GUILDS_GUILD_ID_MEMBERS_UNUSUAL_DM_ACTIVITY");
        assert.equal(catalogEntry?.source, "src/api/routes/guilds/#guild_id/members/unusual-dm-activity.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "GuildMemberUnusualDmActivityResponse"]);

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestId);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.path, "/guilds/:guild_id/members/unusual-dm-activity/");
        assert.equal(contract?.routeMetadata?.responses?.includes("GuildMemberUnusualDmActivityResponse"), true);
        assert.equal(contract?.routeMetadata?.responses?.includes("APIErrorResponse"), true);
        assert.equal(contract?.routeMetadata?.responseStatuses?.includes(400), true);
        assert.equal(contract?.routeMetadata?.responseStatuses?.includes(403), true);

        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "GET" && entry.route === "/guilds/{param}/members/unusual-dm-activity"),
            false,
        );
        assert.deepEqual(
            missingRoutes.missing_entries
                .filter((entry) => entry.route === "/guilds/{param}/members/unusual-dm-activity")
                .map((entry) => entry.method)
                .sort(),
            ["DELETE", "PATCH", "PUT"],
        );
    });
});

type SetupOptions = {
    memberCheckError?: {
        message: string;
        status: number;
    };
};

function setupGuildMemberUnusualDmActivityRoute(t: TestContext, options: SetupOptions = {}) {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../../util/handlers/route");
    const util = requireModule("@spacebar/util") as typeof import("@spacebar/util");
    const routeOptions: unknown[] = [];
    const memberChecks: { guildId: string; userId: string }[] = [];

    t.mock.method(routeHandler, "route", (routeOption: unknown) => {
        routeOptions.push(routeOption);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });
    t.mock.method(util.Member, "IsInGuildOrFail", async (userId: string, guildId: string) => {
        memberChecks.push({ userId, guildId });
        if (options.memberCheckError) {
            const error = new Error(options.memberCheckError.message) as Error & { status?: number };
            error.status = options.memberCheckError.status;
            throw error;
        }
    });

    delete require.cache[routeModulePath];
    const routeModule = requireModule(routeModulePath) as typeof import("./unusual-dm-activity");
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/guilds/:guild_id/members/unusual-dm-activity", routeModule.default);
    app.use((error: { code?: number; message?: string; status?: number; statusCode?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(error.status ?? error.statusCode ?? error.code ?? 500).json({ message: error.message });
    });

    return {
        app,
        routeModule,
        get routeOptions() {
            return routeOptions[0];
        },
        get memberChecks() {
            return memberChecks;
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
    format?: string;
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

type HttpContracts = {
    contracts?: {
        authMode?: string;
        manifestId?: string;
        path?: string;
        routeMetadata?: {
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
