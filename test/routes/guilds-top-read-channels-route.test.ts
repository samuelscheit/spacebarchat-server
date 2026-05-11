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
import { join } from "node:path";
import { describe, test, type TestContext } from "node:test";
import express from "express";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../src/api/middlewares";
import {
    createGuildTopReadChannelsRouter,
    getGuildTopReadChannelsResponse,
    isGuildVisibleToNonMember,
    type GuildTopReadChannelsDependencies,
    type GuildTopReadChannelsGuild,
} from "../../src/api/routes/guilds/#guild_id/top-read-channels";
import { requestJson } from "../../src/api/tests/helpers/UserRouteTestHelpers";
import { DiscordApiErrors, GuildFeature } from "../../src/util";

const guildId = "200000000000000002";
const viewerId = "100000000000000001";
const coveredManifestId = "api:http:GET:/guilds/:guild_id/top-read-channels/";

describe("GET /guilds/:guild_id/top-read-channels", () => {
    test("stays behind bearer authentication", async (t) => {
        const dependencies = createThrowingDependencies(t);

        assert.equal(isNoAuthorizationRoute("GET", `/api/v9/guilds/${guildId}/top-read-channels`), false);

        const response = await requestJson(createAuthenticatedApp(dependencies), `/guilds/${guildId}/top-read-channels`);

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
        assert.equal(mockOf(dependencies.findGuild).mock.callCount(), 0);
        assert.equal(mockOf(dependencies.isGuildMember).mock.callCount(), 0);
        assert.equal(mockOf(dependencies.findTopReadChannelIds).mock.callCount(), 0);
    });

    test("returns conservative empty rankings for authenticated guild members when no usage source exists", async (t) => {
        const dependencies = createDependencies(t);

        const response = await requestJson(createApp(dependencies), `/guilds/${guildId}/top-read-channels`);

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
        assert.deepEqual(mockOf(dependencies.findGuild).mock.calls[0].arguments[0], {
            where: { id: guildId },
            select: { id: true, features: true, discovery_excluded: true },
        });
        assert.deepEqual(mockOf(dependencies.isGuildMember).mock.calls[0].arguments, [viewerId, guildId]);
        assert.deepEqual(mockOf(dependencies.findTopReadChannelIds).mock.calls[0].arguments, [guildId, viewerId]);
    });

    test("allows authenticated non-members to request discoverable guild rankings", async (t) => {
        const dependencies = createDependencies(t, {
            isGuildMember: t.mock.fn(async () => false),
        });

        const response = await requestJson(createApp(dependencies), `/guilds/${guildId}/top-read-channels`);

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
        assert.equal(mockOf(dependencies.findTopReadChannelIds).mock.callCount(), 1);
    });

    test("returns source-backed rankings capped to the documented limit", async (t) => {
        const channelIds = Array.from({ length: 12 }, (_, index) => `${300000000000000000n + BigInt(index)}`);
        const dependencies = createDependencies(t, {
            findTopReadChannelIds: t.mock.fn(async () => channelIds),
        });

        assert.deepEqual(await getGuildTopReadChannelsResponse(guildId, viewerId, dependencies), channelIds.slice(0, 10));
    });

    test("returns unknown guild before membership or usage lookups", async (t) => {
        const dependencies = createDependencies(t, {
            findGuild: t.mock.fn(async () => null),
        });

        const response = await requestJson(createApp(dependencies), `/guilds/${guildId}/top-read-channels`);

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.UNKNOWN_GUILD.code,
            message: DiscordApiErrors.UNKNOWN_GUILD.message,
        });
        assert.equal(mockOf(dependencies.isGuildMember).mock.callCount(), 0);
        assert.equal(mockOf(dependencies.findTopReadChannelIds).mock.callCount(), 0);
    });

    test("returns unknown guild for authenticated users outside a non-discoverable guild", async (t) => {
        const dependencies = createDependencies(t, {
            findGuild: t.mock.fn(async () => createGuild({ features: ["COMMUNITY"] })),
            isGuildMember: t.mock.fn(async () => false),
        });

        const response = await requestJson(createApp(dependencies), `/guilds/${guildId}/top-read-channels`);

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.UNKNOWN_GUILD.code,
            message: DiscordApiErrors.UNKNOWN_GUILD.message,
        });
        assert.equal(mockOf(dependencies.findTopReadChannelIds).mock.callCount(), 0);
    });

    test("returns unknown guild for authenticated users outside a discovery-excluded guild", async (t) => {
        const dependencies = createDependencies(t, {
            findGuild: t.mock.fn(async () => createGuild({ discovery_excluded: true })),
            isGuildMember: t.mock.fn(async () => false),
        });

        const response = await requestJson(createApp(dependencies), `/guilds/${guildId}/top-read-channels`);

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.UNKNOWN_GUILD.code,
            message: DiscordApiErrors.UNKNOWN_GUILD.message,
        });
        assert.equal(mockOf(dependencies.findTopReadChannelIds).mock.callCount(), 0);
    });

    test("detects discoverable guild visibility for non-member fallback", () => {
        assert.equal(isGuildVisibleToNonMember(createGuild()), true);
        assert.equal(isGuildVisibleToNonMember(createGuild({ features: ["COMMUNITY"] })), false);
        assert.equal(isGuildVisibleToNonMember(createGuild({ discovery_excluded: true })), false);
    });

    test("declares response schemas and generated route artifacts", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "guilds", "#guild_id", "top-read-channels.ts"), "utf8");
        const schemas = readJson<Record<string, JsonSchema>>(join("assets", "schemas.json"));
        const openapi = readJson<OpenApiDocument>(join("assets", "openapi.json"));
        const manifest = readJson<TestingManifest>(join("assets", "testing-manifest.json"));
        const sourceCatalog = readJson<SourceRouteCatalogEntry[]>(join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<MissingRoutesReport>(join("packages", "missing-routes", "missing.json"));

        assert.match(routeSource, /summary:\s*"Get Guild Top Read Channels"/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"GuildTopReadChannelsResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);

        assert.equal(schemas.GuildTopReadChannelsResponse?.type, "array");
        assert.equal(schemas.GuildTopReadChannelsResponse?.items?.type, "string");

        const route = openapi.paths?.["/guilds/{guild_id}/top-read-channels/"]?.get ?? openapi.paths?.["/guilds/{guild_id}/top-read-channels"]?.get;
        assert.equal(route?.summary, "Get Guild Top Read Channels");
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/GuildTopReadChannelsResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId || entry.id === coveredManifestId.slice(0, -1));
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.permission, undefined);
        assert.equal(manifestEntry?.routeMetadata?.right, undefined);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("GuildTopReadChannelsResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [200, 401, 404],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/guilds/{guild_id}/top-read-channels");
        assert.equal(catalogEntry?.route_name, "GET_GUILDS_GUILD_ID_TOP_READ_CHANNELS");
        assert.equal(catalogEntry?.source, "src/api/routes/guilds/#guild_id/top-read-channels.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "GuildTopReadChannelsResponse"]);

        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "GET" && entry.route === "/guilds/{param}/top-read-channels"),
            false,
        );
    });
});

function createApp(dependencies: GuildTopReadChannelsDependencies) {
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = viewerId;
        next();
    });
    app.use("/guilds/:guild_id/top-read-channels", createGuildTopReadChannelsRouter(dependencies));
    app.use(ErrorHandler);
    return app;
}

function createAuthenticatedApp(dependencies: GuildTopReadChannelsDependencies) {
    const app = express();
    app.use(Authentication);
    app.use("/guilds/:guild_id/top-read-channels", createGuildTopReadChannelsRouter(dependencies));
    app.use(ErrorHandler);
    return app;
}

function createThrowingDependencies(t: TestContext) {
    return createDependencies(t, {
        findGuild: t.mock.fn(async () => {
            throw new Error("guild lookup should not run");
        }),
        isGuildMember: t.mock.fn(async () => {
            throw new Error("membership lookup should not run");
        }),
        findTopReadChannelIds: t.mock.fn(async () => {
            throw new Error("top read channel lookup should not run");
        }),
    });
}

function createDependencies(t: TestContext, overrides: Partial<GuildTopReadChannelsDependencies> = {}): GuildTopReadChannelsDependencies {
    return {
        findGuild: t.mock.fn(async () => createGuild()),
        isGuildMember: t.mock.fn(async () => true),
        findTopReadChannelIds: t.mock.fn(async () => []),
        ...overrides,
    };
}

function createGuild(overrides: Partial<GuildTopReadChannelsGuild> = {}): GuildTopReadChannelsGuild {
    return {
        id: guildId,
        features: ["COMMUNITY", GuildFeature.Discoverable],
        discovery_excluded: false,
        ...overrides,
    };
}

function mockOf<T extends (...args: never[]) => unknown>(fn: T) {
    return fn as T & {
        mock: {
            callCount(): number;
            calls: Array<{ arguments: Parameters<T> }>;
        };
    };
}

function readJson<T>(relativePath: string): T {
    return JSON.parse(readFileSync(join(process.cwd(), relativePath), "utf8")) as T;
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
        routeMetadata?: {
            permission?: unknown;
            responseBodies?: string[];
            responseStatuses?: number[];
            right?: unknown;
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
