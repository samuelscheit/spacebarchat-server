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
import { Config, Guild, Member } from "@spacebar/util";
import express from "express";
import { HTTPError } from "lambert-server";
import gameServerRegionsRouter, { getConfiguredGameServerRegions } from "../../src/api/routes/guilds/#guild_id/game-server-regions";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestId = "api:http:GET:/guilds/:guild_id/game-server-regions/";

describe("GET /guilds/:guild_id/game-server-regions", () => {
    test("declares the assigned manifest route id", () => {
        assert.equal(coveredManifestId, "api:http:GET:/guilds/:guild_id/game-server-regions/");
    });

    test("serializes only complete configured game-server regions", () => {
        assert.deepEqual(
            getConfiguredGameServerRegions([
                {
                    id: "iad",
                    name: "US East",
                    country_code: "US",
                    ping_url: "wss://iad.example.invalid/ping",
                    capacity: 100,
                },
                {
                    id: "missing-ping-url",
                    name: "Missing Ping URL",
                    country_code: "US",
                },
                null,
            ]),
            [
                {
                    id: "iad",
                    name: "US East",
                    country_code: "US",
                    ping_url: "wss://iad.example.invalid/ping",
                },
            ],
        );
    });

    test("returns configured local regions for authenticated guild members", async (t) => {
        const harness = setupRoute(t, {
            regions: [
                {
                    id: "fra",
                    name: "Frankfurt",
                    country_code: "DE",
                    ping_url: "wss://fra.example.invalid/ping",
                },
            ],
        });

        const response = await requestJson(harness.app, "/guilds/guild-id/game-server-regions");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, [
            {
                id: "fra",
                name: "Frankfurt",
                country_code: "DE",
                ping_url: "wss://fra.example.invalid/ping",
            },
        ]);
        assert.deepEqual(harness.guildLookups, [
            {
                where: { id: "guild-id" },
                select: { id: true },
            },
        ]);
        assert.deepEqual(harness.memberLookups, [
            {
                where: { id: "viewer", guild_id: "guild-id" },
            },
        ]);
    });

    test("returns 404 for unknown guilds before checking membership", async (t) => {
        const harness = setupRoute(t, { guildError: new HTTPError("Unknown Guild", 404) });

        const response = await requestJson(harness.app, "/guilds/unknown-guild/game-server-regions");

        assert.equal(response.status, 404);
        assert.equal((response.body as { code?: unknown }).code, 404);
        assert.deepEqual(harness.memberLookups, []);
    });

    test("returns 403 when the authenticated user is not a guild member", async (t) => {
        const harness = setupRoute(t, { memberExists: false });

        const response = await requestJson(harness.app, "/guilds/guild-id/game-server-regions");

        assert.equal(response.status, 403);
        assert.equal((response.body as { code?: unknown }).code, 403);
    });

    test("stays behind bearer authentication", async () => {
        const app = express();
        app.use(Authentication);
        app.use("/guilds/:guild_id/game-server-regions", gameServerRegionsRouter);
        app.use(ErrorHandler);

        const response = await requestJson(app, "/guilds/guild-id/game-server-regions");

        assert.equal(response.status, 401);
        assert.equal((response.body as { code?: unknown }).code, 401);
        assert.equal(isNoAuthorizationRoute("GET", "/guilds/123456789012345678/game-server-regions"), false);
    });

    test("declares response schemas and generated route artifacts", () => {
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonSchema>;
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            paths?: Record<string, { get?: { responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>; security?: unknown } }>;
        };
        const manifest = JSON.parse(readFileSync(join(process.cwd(), "assets", "testing-manifest.json"), "utf8")) as {
            entries?: {
                id?: string;
                authMode?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
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

        const responseSchema = schemas.GameServerRegionsResponse;
        assert.equal(responseSchema.type, "array");
        assert.equal(responseSchema.items?.$ref, "#/definitions/GameServerRegionResponse");
        assert.equal(schemas.GameServerRegionResponse.properties?.id?.type, "string");
        assert.equal(schemas.GameServerRegionResponse.properties?.name?.type, "string");
        assert.equal(schemas.GameServerRegionResponse.properties?.country_code?.type, "string");
        assert.equal(schemas.GameServerRegionResponse.properties?.ping_url?.type, "string");
        assert.deepEqual(schemas.GameServerRegionResponse.required?.sort(), ["country_code", "id", "name", "ping_url"]);

        const route = openapi.paths?.["/guilds/{guild_id}/game-server-regions/"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/GameServerRegionsResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("GameServerRegionsResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [200, 401, 403, 404],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/guilds/{guild_id}/game-server-regions");
        assert.equal(catalogEntry?.route_name, "GET_GUILDS_GUILD_ID_GAME_SERVER_REGIONS");
        assert.equal(catalogEntry?.source, "src/api/routes/guilds/#guild_id/game-server-regions.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "GameServerRegionsResponse"]);
    });
});

function setupRoute(t: TestContext, options: SetupOptions = {}) {
    const app = express();
    const guildLookups: unknown[] = [];
    const memberLookups: unknown[] = [];

    t.mock.method(Guild, "findOneOrFail", async (lookup: unknown) => {
        guildLookups.push(lookup);
        if (options.guildError) throw options.guildError;
        return { id: "guild-id" };
    });
    t.mock.method(Member, "exists", async (lookup: unknown) => {
        memberLookups.push(lookup);
        return options.memberExists ?? true;
    });
    t.mock.method(Config, "get", () => ({ guild: { gameServerRegions: options.regions ?? [] } }) as unknown as ReturnType<typeof Config.get>);

    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/guilds/:guild_id/game-server-regions", gameServerRegionsRouter);
    app.use(ErrorHandler);

    return { app, guildLookups, memberLookups };
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

type SetupOptions = {
    guildError?: Error;
    memberExists?: boolean;
    regions?: unknown[];
};

type JsonSchema = {
    type?: string;
    items?: { $ref?: string };
    properties?: Record<string, JsonSchema>;
    required?: string[];
};
