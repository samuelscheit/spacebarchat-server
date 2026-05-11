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
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { describe, test, type TestContext } from "node:test";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "@spacebar/api";
import express from "express";
import topGamesRouter, { buildGuildTopGamesResponse } from "../../src/api/routes/guilds/#guild_id/top-games";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const requireModule = require;
const coveredManifestId = "api:http:GET:/guilds/:guild_id/top-games/";

describe("GET /guilds/:guild_id/top-games", () => {
    test("declares the assigned manifest route id", () => {
        assert.equal(coveredManifestId, "api:http:GET:/guilds/:guild_id/top-games/");
    });

    test("builds a source-compatible empty top games response without shared mutable state", () => {
        const first = buildGuildTopGamesResponse();
        first.top_games.push({
            game_application_id: "100000000000000001",
            activity_level: 1,
            activity_score: 1,
        });

        assert.deepEqual(buildGuildTopGamesResponse(), { top_games: [] });
    });

    test("returns the conservative response after MANAGE_GUILD authorization", async (t) => {
        const permissionLookups: unknown[][] = [];
        mockPermissions(t, true, permissionLookups);
        const app = createAuthenticatedRouteApp();

        const response = await requestJson(app, "/guilds/100000000000000001/top-games");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, { top_games: [] });
        assert.deepEqual(permissionLookups, [["viewer", "100000000000000001", undefined]]);
    });

    test("returns 403 when the authenticated user lacks MANAGE_GUILD", async (t) => {
        mockPermissions(t, false);
        const app = createAuthenticatedRouteApp();

        const response = await requestJson(app, "/guilds/100000000000000001/top-games");

        assert.equal(response.status, 403);
        assert.equal((response.body as { code?: unknown }).code, 50013);
    });

    test("stays behind bearer authentication", async () => {
        const app = express();
        app.use(Authentication);
        app.use("/guilds/:guild_id/top-games", topGamesRouter);
        app.use(ErrorHandler);

        const response = await requestJson(app, "/guilds/100000000000000001/top-games");

        assert.equal(response.status, 401);
        assert.equal((response.body as { code?: unknown }).code, 401);
        assert.equal(isNoAuthorizationRoute("GET", "/guilds/100000000000000001/top-games"), false);
    });

    test("declares route ownership, permission, and response metadata", () => {
        const source = readFileSync(join(process.cwd(), "src", "api", "routes", "guilds", "#guild_id", "top-games.ts"), "utf8");

        assert.match(source, /router\.get\(\s*["']\/["']/);
        assert.match(source, /summary:\s*"Get Guild Top Games"/);
        assert.match(source, /permission:\s*"MANAGE_GUILD"/);
        assert.match(source, /200:\s*\{\s*body:\s*"GuildTopGamesResponse"/);
        assert.match(source, /401:\s*\{\s*body:\s*"APIErrorResponse"/);
        assert.match(source, /403:\s*\{\s*body:\s*"APIErrorResponse"/);
    });

    test("declares response schemas and generated route artifacts", () => {
        const schemas = readJsonAsset<SchemaMap>("schemas.json");
        const openapi = readJsonAsset<OpenApi>("openapi.json");
        const manifest = readJsonAsset<TestingManifest>("testing-manifest.json");
        const sourceCatalog = readJson<SourceCatalogEntry[]>(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missing = readJson<MissingRoutesReport>(join(process.cwd(), "packages", "missing-routes", "missing.json"));

        assert.equal(schemas.GuildTopGamesResponse.type, "object");
        assert.equal(schemas.GuildTopGamesResponse.properties?.top_games?.type, "array");
        assert.equal(schemas.GuildTopGamesResponse.properties?.top_games?.items?.$ref, "#/definitions/GuildTopGameActivity");
        assert.deepEqual(schemas.GuildTopGamesResponse.required, ["top_games"]);
        assert.equal(schemas.GuildTopGameActivity.properties?.game_application_id?.type, "string");
        assert.equal(schemas.GuildTopGameActivity.properties?.activity_level?.type, "integer");
        assert.equal(schemas.GuildTopGameActivity.properties?.activity_score?.type, "integer");
        assert.deepEqual(schemas.GuildTopGameActivity.required?.sort(), ["activity_level", "activity_score", "game_application_id"]);

        const route = openapi.paths?.["/guilds/{guild_id}/top-games/"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/GuildTopGamesResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/guilds/#guild_id/top-games.ts");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "GuildTopGamesResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [200, 401, 403],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/guilds/{guild_id}/top-games");
        assert.equal(catalogEntry?.route_name, "GET_GUILDS_GUILD_ID_TOP_GAMES");
        assert.equal(catalogEntry?.source, "src/api/routes/guilds/#guild_id/top-games.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "GuildTopGamesResponse"]);

        assert.equal(missing.routes.includes("/guilds/{param}/top-games"), false);
        assert.equal(
            missing.missing_entries.some((entry) => entry.method === "GET" && entry.route === "/guilds/{param}/top-games"),
            false,
        );
    });
});

function mockPermissions(t: TestContext, hasManageGuild: boolean, permissionLookups: unknown[][] = []) {
    const permissionsModule = requireModule(join(process.cwd(), "dist", "util", "util", "Permissions.js")) as typeof import("../../src/util/util/Permissions");

    t.mock.method(permissionsModule, "getPermission", async (...args: unknown[]) => {
        permissionLookups.push(args);
        return {
            has: () => hasManageGuild,
        } as never;
    });
}

function createAuthenticatedRouteApp() {
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/guilds/:guild_id/top-games", topGamesRouter);
    app.use(ErrorHandler);
    return app;
}

async function requestJson(app: express.Express, requestPath: string) {
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.once("listening", () => resolve());
    });

    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`);

        return {
            status: response.status,
            body: (await response.json()) as unknown,
        };
    } finally {
        await closeServer(server);
    }
}

async function closeServer(server: Server) {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}

function readJsonAsset<T>(filename: string): T {
    return readJson<T>(join(process.cwd(), "assets", filename));
}

function readJson<T>(filename: string): T {
    return JSON.parse(readFileSync(filename, "utf8")) as T;
}

type JsonSchema = {
    type?: string;
    items?: { $ref?: string };
    properties?: Record<string, JsonSchema>;
    required?: string[];
};

type SchemaMap = Record<string, JsonSchema>;

type OpenApi = {
    paths?: Record<string, { get?: { responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>; security?: unknown } }>;
};

type TestingManifest = {
    entries?: {
        id?: string;
        authMode?: string;
        sourceFile?: string;
        routeMetadata?: {
            responseBodies?: string[];
            responseStatuses?: number[];
        };
    }[];
};

type SourceCatalogEntry = {
    method?: string;
    route?: string;
    route_name?: string;
    source?: string;
    response_schema_refs?: string[];
};

type MissingRoutesReport = {
    routes: string[];
    missing_entries: {
        method?: string;
        route?: string;
    }[];
};
