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
import path from "node:path";
import { describe, test, type TestContext } from "node:test";
import express from "express";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../src/api/middlewares";
import guildBasicRouter, { toGuildBasicResponse, type GuildBasicSource } from "../../src/api/routes/guilds/#guild_id/basic";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const util = require("@spacebar/util") as typeof import("../../src/util");

type MutableUtil = typeof util & {
    Guild: typeof import("../../src/util").Guild;
    Member: typeof import("../../src/util").Member;
};

type GuildFindOptions = {
    where?: { id?: string };
    select?: Record<string, boolean>;
};

type MemberFindOptions = {
    where?: { guild_id?: string; id?: string };
    select?: Record<string, boolean>;
};

type JsonResponse = {
    status: number;
    body: Record<string, unknown>;
};

const mutableUtil = util as MutableUtil;

describe("GET /guilds/:guild_id/basic helpers", () => {
    test("serializes only source-backed partial guild fields", () => {
        const guild = { ...createGuild(), member_count: 42, banner: "banner-hash" } as GuildBasicSource & Record<string, unknown>;
        const response = toGuildBasicResponse(guild);

        assert.deepEqual(response, {
            id: "guild-id",
            name: "Spacebar Guild",
            icon: "icon-hash",
            description: "A discoverable place",
            splash: "splash-hash",
            discovery_splash: "discovery-hash",
            features: ["COMMUNITY", "DISCOVERABLE"],
        });
        assert.equal("member_count" in response, false);
        assert.equal("banner" in response, false);
        assert.equal("home_header" in response, false);
        assert.equal("approximate_member_count" in response, false);
        assert.equal("approximate_presence_count" in response, false);
    });
});

describe("GET /guilds/:guild_id/basic route", () => {
    test("stays behind bearer auth", async () => {
        assert.equal(isNoAuthorizationRoute("GET", "/guilds/123/basic"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/guilds/123/basic"), false);

        const app = express();
        app.use(Authentication);
        app.use("/guilds/:guild_id/basic", guildBasicRouter);
        app.use(ErrorHandler);

        const { server, baseUrl } = await listen(app);
        try {
            const response = await fetch(`${baseUrl}/guilds/123/basic`);
            const body = (await response.json()) as { message?: string };

            assert.equal(response.status, 401);
            assert.match(body.message ?? "", /Missing Authorization Header/);
        } finally {
            await close(server);
        }
    });

    test("returns a partial guild for an existing member", async (t) => {
        const harness = setupRoute(t, { member: { id: "viewer" } });
        const response = await requestJson(harness.app, "/guilds/guild-id/basic");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            id: "guild-id",
            name: "Spacebar Guild",
            icon: "icon-hash",
            description: "A discoverable place",
            splash: "splash-hash",
            discovery_splash: "discovery-hash",
            features: ["COMMUNITY", "DISCOVERABLE"],
        });
        assert.deepEqual(harness.guildFindOptions[0]?.where, { id: "guild-id" });
        assert.deepEqual(Object.keys(harness.guildFindOptions[0]?.select ?? {}).sort(), [
            "description",
            "discovery_excluded",
            "discovery_splash",
            "features",
            "icon",
            "id",
            "name",
            "splash",
        ]);
        assert.deepEqual(harness.memberFindOptions, [
            {
                where: { guild_id: "guild-id", id: "viewer" },
                select: { id: true },
            },
        ]);
    });

    test("returns a discoverable guild to an authenticated non-member without guild permissions", async (t) => {
        const harness = setupRoute(t, { member: null });
        const response = await requestJson(harness.app, "/guilds/guild-id/basic");

        assert.equal(response.status, 200);
        assert.equal(response.body.id, "guild-id");
        assert.deepEqual(response.body.features, ["COMMUNITY", "DISCOVERABLE"]);
    });

    test("returns unknown guild for a missing guild", async (t) => {
        const harness = setupRoute(t, { guild: null });
        const response = await requestJson(harness.app, "/guilds/missing/basic");

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: util.DiscordApiErrors.UNKNOWN_GUILD.code,
            message: util.DiscordApiErrors.UNKNOWN_GUILD.message,
        });
    });

    test("returns unknown guild for a non-member requesting a non-discoverable guild", async (t) => {
        const harness = setupRoute(t, {
            guild: createGuild({ features: ["COMMUNITY"], discovery_excluded: false }),
            member: null,
        });
        const response = await requestJson(harness.app, "/guilds/hidden/basic");

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: util.DiscordApiErrors.UNKNOWN_GUILD.code,
            message: util.DiscordApiErrors.UNKNOWN_GUILD.message,
        });
    });

    test("returns unknown guild for a non-member requesting a discovery-excluded guild", async (t) => {
        const harness = setupRoute(t, {
            guild: createGuild({ discovery_excluded: true }),
            member: null,
        });
        const response = await requestJson(harness.app, "/guilds/excluded/basic");

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: util.DiscordApiErrors.UNKNOWN_GUILD.code,
            message: util.DiscordApiErrors.UNKNOWN_GUILD.message,
        });
    });

    test("declares metadata and generated artifacts for the exact source-backed route", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "guilds", "#guild_id", "basic.ts"), "utf8");
        const schemas = readJson<Record<string, { properties?: Record<string, { type?: unknown }> }>>(path.join("assets", "schemas.json"));
        const openapi = readJson<{
            paths?: Record<string, { get?: { responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>; security?: unknown } }>;
        }>(path.join("assets", "openapi.json"));
        const sourceCatalog = readJson<
            {
                method?: string;
                route?: string;
                source?: string;
                response_schema_refs?: string[];
            }[]
        >(path.join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<{ missing_entries?: { method?: string; route?: string }[] }>(path.join("packages", "missing-routes", "missing.json"));
        const manifest = readJson<{
            entries?: {
                id?: string;
                authMode?: string;
                routeMetadata?: {
                    permission?: unknown;
                    right?: unknown;
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>(path.join("assets", "testing-manifest.json"));

        assert.match(routeSource, /200:\s*{\s*body:\s*"GuildBasicResponse"/s);
        assert.match(routeSource, /401:\s*{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*{\s*body:\s*"APIErrorResponse"/s);

        assert.equal(schemas.GuildBasicResponse?.properties?.id?.type, "string");
        assert.deepEqual(schemas.GuildBasicResponse?.properties?.icon?.type, ["null", "string"]);
        assert.deepEqual(schemas.GuildBasicResponse?.properties?.description?.type, ["null", "string"]);
        assert.equal(schemas.GuildBasicResponse?.properties?.features?.type, "array");
        assert.equal(schemas.GuildBasicResponse?.properties?.member_count, undefined);
        assert.equal(schemas.GuildBasicResponse?.properties?.approximate_member_count, undefined);

        const openapiRoute = openapi.paths?.["/guilds/{guild_id}/basic/"]?.get;
        assert.equal(openapiRoute?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/GuildBasicResponse");
        assert.equal(openapiRoute?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapiRoute?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(openapiRoute?.security, [{ bearer: [] }]);

        const sourceRoute = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/guilds/{guild_id}/basic");
        assert.equal(sourceRoute?.source, "src/api/routes/guilds/#guild_id/basic.ts");
        assert.equal(sourceRoute?.response_schema_refs?.includes("GuildBasicResponse"), true);
        assert.equal(sourceRoute?.response_schema_refs?.includes("APIErrorResponse"), true);
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/guilds/{param}/basic"),
            false,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === "api:http:GET:/guilds/:guild_id/basic/");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.permission, undefined);
        assert.equal(manifestEntry?.routeMetadata?.right, undefined);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("GuildBasicResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(200), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(401), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(404), true);
    });
});

function setupRoute(
    t: TestContext,
    setupOptions: {
        guild?: (GuildBasicSource & { discovery_excluded: boolean }) | null;
        member?: { id: string } | null;
        userId?: string;
    } = {},
) {
    const app = express();
    const guildFindOptions: GuildFindOptions[] = [];
    const memberFindOptions: MemberFindOptions[] = [];
    const userId = setupOptions.userId ?? "viewer";

    t.mock.method(mutableUtil.Guild, "findOne", async (findOptions: GuildFindOptions) => {
        guildFindOptions.push(findOptions);
        return "guild" in setupOptions ? setupOptions.guild : createGuild();
    });
    t.mock.method(mutableUtil.Member, "findOne", async (findOptions: MemberFindOptions) => {
        memberFindOptions.push(findOptions);
        return "member" in setupOptions ? setupOptions.member : { id: userId };
    });

    app.use((req, _res, next) => {
        (req as express.Request & { user_id: string }).user_id = userId;
        next();
    });
    app.use("/guilds/:guild_id/basic", guildBasicRouter);
    app.use((error: Error & { httpStatus?: number; status?: number; code?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(error.httpStatus ?? error.status ?? 500).json({
            code: error.code,
            message: error.message,
        });
    });

    return { app, guildFindOptions, memberFindOptions };
}

function createGuild(overrides: Partial<GuildBasicSource & { discovery_excluded: boolean }> = {}): GuildBasicSource & { discovery_excluded: boolean } {
    return {
        id: "guild-id",
        name: "Spacebar Guild",
        icon: "icon-hash",
        description: "A discoverable place",
        splash: "splash-hash",
        discovery_splash: "discovery-hash",
        features: ["COMMUNITY", "DISCOVERABLE"],
        discovery_excluded: false,
        ...overrides,
    };
}

function readJson<T>(relativePath: string): T {
    return JSON.parse(readFileSync(path.join(process.cwd(), relativePath), "utf8")) as T;
}

async function requestJson(app: express.Express, routePath: string): Promise<JsonResponse> {
    const { server, baseUrl } = await listen(app);
    try {
        const response = await fetch(`${baseUrl}${routePath}`);

        return {
            status: response.status,
            body: (await response.json()) as Record<string, unknown>,
        };
    } finally {
        await close(server);
    }
}

async function listen(app: express.Express) {
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.once("listening", () => resolve());
    });

    const address = server.address();
    assert(address && typeof address === "object");

    return {
        server,
        baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}`,
    };
}

async function close(server: Server) {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}
