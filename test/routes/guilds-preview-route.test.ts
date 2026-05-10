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
import guildPreviewRouter, {
    createGuildPreviewRouter,
    toGuildPreviewResponse,
    type GuildPreviewDependencies,
    type GuildPreviewGuildSource,
} from "../../src/api/routes/guilds/#guild_id/preview";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const util = require("@spacebar/util") as typeof import("../../src/util");

type JsonResponse = {
    status: number;
    body: Record<string, unknown>;
};

describe("GET /guilds/:guild_id/preview helpers", () => {
    test("serializes only source-backed guild preview fields", () => {
        const guild = { ...createGuild(), banner: "banner-hash", home_header: "home-header", member_count: 99 } as GuildPreviewGuildSource & Record<string, unknown>;
        const response = toGuildPreviewResponse(guild, { approximateMemberCount: 42, approximatePresenceCount: 7 });

        assert.deepEqual(response, {
            id: "guild-id",
            name: "Spacebar Guild",
            icon: "icon-hash",
            description: "A discoverable place",
            splash: "splash-hash",
            discovery_splash: "discovery-hash",
            features: ["COMMUNITY", "DISCOVERABLE"],
            emojis: [
                {
                    id: "emoji-id",
                    name: "wave",
                    roles: [],
                    require_colons: true,
                    managed: false,
                    animated: false,
                    available: true,
                },
            ],
            stickers: [
                {
                    id: "sticker-id",
                    name: "hello",
                    description: null,
                    tags: "hello,wave",
                    type: 2,
                    format_type: 1,
                    available: true,
                    guild_id: "guild-id",
                },
            ],
            approximate_member_count: 42,
            approximate_presence_count: 7,
        });
        assert.equal("banner" in response, false);
        assert.equal("home_header" in response, false);
        assert.equal("member_count" in response, false);
    });
});

describe("GET /guilds/:guild_id/preview route", () => {
    test("stays behind bearer auth", async () => {
        assert.equal(isNoAuthorizationRoute("GET", "/guilds/123/preview"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/guilds/123/preview"), false);

        const app = express();
        app.use(Authentication);
        app.use("/guilds/:guild_id/preview", guildPreviewRouter);
        app.use(ErrorHandler);

        const { server, baseUrl } = await listen(app);
        try {
            const response = await fetch(`${baseUrl}/guilds/123/preview`);
            const body = (await response.json()) as { message?: string };

            assert.equal(response.status, 401);
            assert.match(body.message ?? "", /Missing Authorization Header/);
        } finally {
            await close(server);
        }
    });

    test("returns a preview for an existing member", async (t) => {
        const harness = setupRoute(t, { member: { id: "viewer" }, approximateMemberCount: 42, approximatePresenceCount: 7 });
        const response = await requestJson(harness.app, "/guilds/guild-id/preview");

        assert.equal(response.status, 200);
        assert.equal(response.body.id, "guild-id");
        assert.equal(response.body.approximate_member_count, 42);
        assert.equal(response.body.approximate_presence_count, 7);
        assert.deepEqual(response.body.emojis, [
            {
                id: "emoji-id",
                name: "wave",
                roles: [],
                require_colons: true,
                managed: false,
                animated: false,
                available: true,
            },
        ]);
        assert.deepEqual(response.body.stickers, [
            {
                id: "sticker-id",
                name: "hello",
                description: null,
                tags: "hello,wave",
                type: 2,
                format_type: 1,
                available: true,
                guild_id: "guild-id",
            },
        ]);
        assert.deepEqual(harness.guildFindOptions[0]?.where, { id: "guild-id" });
        assert.deepEqual(harness.guildFindOptions[0]?.relations, { emojis: true, stickers: true });
        assert.deepEqual(Object.keys(harness.guildFindOptions[0]?.select ?? {}).sort(), [
            "description",
            "discovery_excluded",
            "discovery_splash",
            "emojis",
            "features",
            "icon",
            "id",
            "name",
            "splash",
            "stickers",
        ]);
        assert.deepEqual(harness.memberFindOptions, [
            {
                where: { guild_id: "guild-id", id: "viewer" },
                select: { id: true },
            },
        ]);
        assert.deepEqual(harness.memberCountWhere, [{ guild_id: "guild-id" }]);
        assert.deepEqual(harness.onlineCountWhere, [
            {
                guild_id: "guild-id",
                user: {
                    sessions: {
                        status: "online",
                    },
                },
            },
        ]);
    });

    test("returns a discoverable guild to an authenticated non-member", async (t) => {
        const harness = setupRoute(t, { member: null });
        const response = await requestJson(harness.app, "/guilds/guild-id/preview");

        assert.equal(response.status, 200);
        assert.equal(response.body.id, "guild-id");
        assert.deepEqual(response.body.features, ["COMMUNITY", "DISCOVERABLE"]);
    });

    test("returns unknown guild for a missing guild", async (t) => {
        const harness = setupRoute(t, { guild: null });
        const response = await requestJson(harness.app, "/guilds/missing/preview");

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: util.DiscordApiErrors.UNKNOWN_GUILD.code,
            message: util.DiscordApiErrors.UNKNOWN_GUILD.message,
        });
        assert.deepEqual(harness.memberFindOptions, []);
        assert.deepEqual(harness.memberCountWhere, []);
        assert.deepEqual(harness.onlineCountWhere, []);
    });

    test("returns unknown guild for a non-member requesting a non-discoverable guild", async (t) => {
        const harness = setupRoute(t, {
            guild: createGuild({ features: ["COMMUNITY"], discovery_excluded: false }),
            member: null,
        });
        const response = await requestJson(harness.app, "/guilds/hidden/preview");

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: util.DiscordApiErrors.UNKNOWN_GUILD.code,
            message: util.DiscordApiErrors.UNKNOWN_GUILD.message,
        });
        assert.deepEqual(harness.memberCountWhere, []);
        assert.deepEqual(harness.onlineCountWhere, []);
    });

    test("returns unknown guild for a non-member requesting a discovery-excluded guild", async (t) => {
        const harness = setupRoute(t, {
            guild: createGuild({ discovery_excluded: true }),
            member: null,
        });
        const response = await requestJson(harness.app, "/guilds/excluded/preview");

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: util.DiscordApiErrors.UNKNOWN_GUILD.code,
            message: util.DiscordApiErrors.UNKNOWN_GUILD.message,
        });
        assert.deepEqual(harness.memberCountWhere, []);
        assert.deepEqual(harness.onlineCountWhere, []);
    });

    test("declares metadata and generated artifacts for the exact source-backed route", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "guilds", "#guild_id", "preview.ts"), "utf8");
        const schemas = readJson<Record<string, { properties?: Record<string, { type?: unknown; items?: { $ref?: string } }> }>>(path.join("assets", "schemas.json"));
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

        assert.match(routeSource, /summary:\s*"Get Guild Preview"/);
        assert.match(routeSource, /200:\s*{\s*body:\s*"GuildPreviewResponse"/s);
        assert.match(routeSource, /401:\s*{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*{\s*body:\s*"APIErrorResponse"/s);

        assert.equal(schemas.GuildPreviewResponse?.properties?.id?.type, "string");
        assert.deepEqual(schemas.GuildPreviewResponse?.properties?.icon?.type, ["null", "string"]);
        assert.deepEqual(schemas.GuildPreviewResponse?.properties?.description?.type, ["null", "string"]);
        assert.equal(schemas.GuildPreviewResponse?.properties?.emojis?.type, "array");
        assert.equal(schemas.GuildPreviewResponse?.properties?.stickers?.type, "array");
        assert.equal(schemas.GuildPreviewResponse?.properties?.approximate_member_count?.type, "integer");
        assert.equal(schemas.GuildPreviewResponse?.properties?.approximate_presence_count?.type, "integer");
        assert.equal(schemas.GuildPreviewResponse?.properties?.banner, undefined);
        assert.equal(schemas.GuildPreviewResponse?.properties?.home_header, undefined);
        assert.equal(schemas.GuildPreviewResponse?.properties?.member_count, undefined);

        const openapiRoute = openapi.paths?.["/guilds/{guild_id}/preview/"]?.get;
        assert.equal(openapiRoute?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/GuildPreviewResponse");
        assert.equal(openapiRoute?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapiRoute?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(openapiRoute?.security, [{ bearer: [] }]);

        const sourceRoute = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/guilds/{guild_id}/preview");
        assert.equal(sourceRoute?.source, "src/api/routes/guilds/#guild_id/preview.ts");
        assert.equal(sourceRoute?.response_schema_refs?.includes("GuildPreviewResponse"), true);
        assert.equal(sourceRoute?.response_schema_refs?.includes("APIErrorResponse"), true);
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/guilds/{param}/preview"),
            false,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === "api:http:GET:/guilds/:guild_id/preview/");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.permission, undefined);
        assert.equal(manifestEntry?.routeMetadata?.right, undefined);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("GuildPreviewResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(200), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(401), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(404), true);
    });
});

function setupRoute(
    t: TestContext,
    setupOptions: {
        guild?: GuildPreviewGuildSource | null;
        member?: { id: string } | null;
        userId?: string;
        approximateMemberCount?: number;
        approximatePresenceCount?: number;
    } = {},
) {
    const app = express();
    const guildFindOptions: Array<Record<string, unknown>> = [];
    const memberFindOptions: Array<Record<string, unknown>> = [];
    const memberCountWhere: unknown[] = [];
    const onlineCountWhere: unknown[] = [];
    const userId = setupOptions.userId ?? "viewer";
    const dependencies: GuildPreviewDependencies = {
        async findGuild(findOptions) {
            guildFindOptions.push(findOptions as Record<string, unknown>);
            return setupOptions.guild !== undefined ? setupOptions.guild : createGuild();
        },
        async findMember(findOptions) {
            memberFindOptions.push(findOptions as Record<string, unknown>);
            return setupOptions.member !== undefined ? setupOptions.member : { id: userId };
        },
        async countMembers(where) {
            memberCountWhere.push(where);
            return setupOptions.approximateMemberCount ?? 12;
        },
        async countOnlineMembers(where) {
            onlineCountWhere.push(where);
            return setupOptions.approximatePresenceCount ?? 3;
        },
    };

    app.use((req, _res, next) => {
        (req as express.Request & { user_id: string }).user_id = userId;
        next();
    });
    app.use("/guilds/:guild_id/preview", createGuildPreviewRouter(dependencies));
    app.use((error: Error & { httpStatus?: number; status?: number; code?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(error.httpStatus ?? error.status ?? 500).json({
            code: error.code,
            message: error.message,
        });
    });

    return { app, guildFindOptions, memberFindOptions, memberCountWhere, onlineCountWhere };
}

function createGuild(overrides: Partial<GuildPreviewGuildSource> = {}): GuildPreviewGuildSource {
    return {
        id: "guild-id",
        name: "Spacebar Guild",
        icon: "icon-hash",
        description: "A discoverable place",
        splash: "splash-hash",
        discovery_splash: "discovery-hash",
        features: ["COMMUNITY", "DISCOVERABLE"],
        discovery_excluded: false,
        emojis: [
            {
                id: "emoji-id",
                name: "wave",
                roles: [],
                require_colons: true,
                managed: false,
                animated: false,
                available: true,
            },
        ],
        stickers: [
            {
                id: "sticker-id",
                name: "hello",
                description: null,
                tags: "hello,wave",
                type: 2,
                format_type: 1,
                available: true,
                guild_id: "guild-id",
            },
        ],
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
