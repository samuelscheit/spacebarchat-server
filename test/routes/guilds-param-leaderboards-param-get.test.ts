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
import { requestJson } from "../../src/api/tests/helpers/UserRouteTestHelpers";
import {
    GUILD_LEADERBOARD_UNSUPPORTED_MESSAGE,
    createGuildLeaderboardRouter,
    createGuildLeaderboardUnsupportedError,
    getGuildLeaderboard,
    type GuildLeaderboardDependencies,
} from "../../src/api/routes/guilds/#guild_id/leaderboards/#param";
import { DiscordApiErrors } from "../../src/util";

const guildId = "200000000000000002";
const viewerId = "100000000000000001";
const leaderboardId = "league-of-legends";
const coveredManifestId = "api:http:GET:/guilds/:guild_id/leaderboards/:param/";

describe("GET /guilds/:guild_id/leaderboards/:param", () => {
    test("declares the assigned manifest route id", () => {
        assert.equal(coveredManifestId, "api:http:GET:/guilds/:guild_id/leaderboards/:param/");
    });

    test("stays behind bearer authentication", async (t) => {
        const dependencies = createThrowingDependencies(t);

        assert.equal(isNoAuthorizationRoute("GET", `/api/v9/guilds/${guildId}/leaderboards/${leaderboardId}`), false);

        const response = await requestJson(createAuthenticatedApp(dependencies), `/guilds/${guildId}/leaderboards/${leaderboardId}`);

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
        assert.equal(mockOf(dependencies.findGuild).mock.callCount(), 0);
        assert.equal(mockOf(dependencies.isGuildMember).mock.callCount(), 0);
    });

    test("checks guild membership and fails closed for authenticated guild members", async (t) => {
        const dependencies = createDependencies(t);

        const response = await requestJson(createApp(dependencies), `/guilds/${guildId}/leaderboards/${leaderboardId}`);

        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: 0,
            message: GUILD_LEADERBOARD_UNSUPPORTED_MESSAGE,
        });
        assert.deepEqual(mockOf(dependencies.findGuild).mock.calls[0].arguments[0], {
            where: { id: guildId },
            select: { id: true },
        });
        assert.deepEqual(mockOf(dependencies.isGuildMember).mock.calls[0].arguments, [viewerId, guildId]);
    });

    test("returns unknown guild before membership checks", async (t) => {
        const dependencies = createDependencies(t, {
            findGuild: t.mock.fn(async () => null),
        });

        const response = await requestJson(createApp(dependencies), `/guilds/${guildId}/leaderboards/${leaderboardId}`);

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.UNKNOWN_GUILD.code,
            message: DiscordApiErrors.UNKNOWN_GUILD.message,
        });
        assert.equal(mockOf(dependencies.isGuildMember).mock.callCount(), 0);
    });

    test("returns 403 before unsupported handling for authenticated users outside the guild", async (t) => {
        const dependencies = createDependencies(t, {
            isGuildMember: t.mock.fn(async () => false),
        });

        const response = await requestJson(createApp(dependencies), `/guilds/${guildId}/leaderboards/${leaderboardId}`);

        assert.equal(response.status, 403);
        assert.match((response.body as { message?: string }).message ?? "", /not member/);
    });

    test("uses an explicit unsupported-provider API error", async (t) => {
        const error = createGuildLeaderboardUnsupportedError();

        assert.equal(error.httpStatus, 501);
        assert.equal(error.code, 0);
        assert.equal(error.message, GUILD_LEADERBOARD_UNSUPPORTED_MESSAGE);
        await assert.rejects(() => getGuildLeaderboard(guildId, leaderboardId, viewerId, createDependencies(t)), {
            code: 0,
            httpStatus: 501,
            message: GUILD_LEADERBOARD_UNSUPPORTED_MESSAGE,
        });
    });

    test("declares source-backed route metadata in source and generated artifacts", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "guilds", "#guild_id", "leaderboards", "#param.ts"), "utf8");
        const openapi = readJson<OpenApiDocument>(join("assets", "openapi.json"));
        const manifest = readJson<TestingManifest>(join("assets", "testing-manifest.json"));
        const sourceCatalog = readJson<SourceRouteCatalogEntry[]>(join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<MissingRoutesReport>(join("packages", "missing-routes", "missing.json"));
        const contracts = readJson<HttpContractCatalog>(join("test", "generated", "http-contracts.json"));
        const suiteCoverage = readJson<unknown>(join("test", "generated", "suite-coverage.json"));

        assert.match(routeSource, /summary:\s*"Get Guild Leaderboard"/);
        assert.match(routeSource, /linked-game leaderboard submissions or rankings/);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /403:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /501:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /200:\s*\{/);
        assert.doesNotMatch(routeSource, /leaderboards\/.*\/settings/);

        const route = openapi.paths?.["/guilds/{guild_id}/leaderboards/{param}/"]?.get;
        assert.equal(route?.summary, "Get Guild Leaderboard");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["501"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/guilds/#guild_id/leaderboards/#param.ts");
        assert.equal(manifestEntry?.routeMetadata?.permission, undefined);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [401, 403, 404, 501],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/guilds/{guild_id}/leaderboards/{param}");
        assert.equal(catalogEntry?.route_name, "GET_GUILDS_GUILD_ID_LEADERBOARDS_PARAM");
        assert.equal(catalogEntry?.source, "src/api/routes/guilds/#guild_id/leaderboards/#param.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs, ["APIErrorResponse"]);

        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "GET" && entry.route === "/guilds/{param}/leaderboards/{param}"),
            false,
        );
        assert.equal(missingRoutes.routes.includes("/guilds/{param}/leaderboards/{param}"), false);

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestId);
        assert.equal(contract?.authMode, "bearer");
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse"]);
        assert.deepEqual(
            contract?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [401, 403, 404, 501],
        );

        assert.equal(JSON.stringify(suiteCoverage).includes(coveredManifestId), true);
    });
});

function createApp(dependencies: GuildLeaderboardDependencies) {
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = viewerId;
        next();
    });
    app.use("/guilds/:guild_id/leaderboards/:param", createGuildLeaderboardRouter(dependencies));
    app.use(ErrorHandler);
    return app;
}

function createAuthenticatedApp(dependencies: GuildLeaderboardDependencies) {
    const app = express();
    app.use(Authentication);
    app.use("/guilds/:guild_id/leaderboards/:param", createGuildLeaderboardRouter(dependencies));
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
    });
}

function createDependencies(t: TestContext, overrides: Partial<GuildLeaderboardDependencies> = {}): GuildLeaderboardDependencies {
    return {
        findGuild: t.mock.fn(async () => ({ id: guildId })),
        isGuildMember: t.mock.fn(async () => true),
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

type OpenApiDocument = {
    paths?: Record<string, { get?: OpenApiOperation }>;
};

type OpenApiOperation = {
    summary?: string;
    responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
    security?: unknown;
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

type MissingRoutesReport = {
    routes: string[];
    missing_entries: Array<{ method: string; route: string }>;
};

type HttpContractCatalog = {
    contracts?: {
        manifestId?: string;
        authMode?: string;
        routeMetadata?: {
            responses?: string[];
            responseStatuses?: number[];
        };
    }[];
};
