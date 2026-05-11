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
    createGuildSoundboardSoundsRouter,
    getGuildSoundboardSoundsResponse,
    type GuildSoundboardSoundsDependencies,
} from "../../src/api/routes/guilds/#guild_id/soundboard-sounds";
import { requestJson } from "../../src/api/tests/helpers/UserRouteTestHelpers";
import type { SoundboardSoundResponse } from "../../src/schemas";
import { DiscordApiErrors } from "../../src/util";

const guildId = "200000000000000002";
const viewerId = "100000000000000001";
const coveredManifestId = "api:http:GET:/guilds/:guild_id/soundboard-sounds/";

describe("GET /guilds/:guild_id/soundboard-sounds", () => {
    test("stays behind bearer authentication", async (t) => {
        const dependencies = createThrowingDependencies(t);

        assert.equal(isNoAuthorizationRoute("GET", `/api/v9/guilds/${guildId}/soundboard-sounds`), false);

        const response = await requestJson(createAuthenticatedApp(dependencies), `/guilds/${guildId}/soundboard-sounds`);

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
        assert.equal(mockOf(dependencies.findGuild).mock.callCount(), 0);
        assert.equal(mockOf(dependencies.isGuildMember).mock.callCount(), 0);
        assert.equal(mockOf(dependencies.canIncludeSoundboardSoundCreator).mock.callCount(), 0);
        assert.equal(mockOf(dependencies.findGuildSoundboardSounds).mock.callCount(), 0);
    });

    test("returns an empty soundboard list for authenticated guild members until storage exists", async (t) => {
        const dependencies = createDependencies(t);

        const response = await requestJson(createApp(dependencies), `/guilds/${guildId}/soundboard-sounds`);

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, { items: [] });
        assert.deepEqual(mockOf(dependencies.findGuild).mock.calls[0].arguments[0], {
            where: { id: guildId },
            select: { id: true },
        });
        assert.deepEqual(mockOf(dependencies.isGuildMember).mock.calls[0].arguments, [viewerId, guildId]);
        assert.deepEqual(mockOf(dependencies.canIncludeSoundboardSoundCreator).mock.calls[0].arguments, [viewerId, guildId]);
        assert.deepEqual(mockOf(dependencies.findGuildSoundboardSounds).mock.calls[0].arguments, [guildId, { includeUser: false }]);
    });

    test("returns source-backed sounds and strips creator details without expression permissions", async (t) => {
        const sound = createSoundboardSound();
        const dependencies = createDependencies(t, {
            findGuildSoundboardSounds: t.mock.fn(async () => [sound]),
        });

        assert.deepEqual(await getGuildSoundboardSoundsResponse(guildId, viewerId, dependencies), {
            items: [
                {
                    sound_id: "300000000000000003",
                    name: "Air horn",
                    volume: 0.8,
                    emoji_id: null,
                    emoji_name: "horn",
                    guild_id: guildId,
                    available: true,
                },
            ],
        });
        assert.equal(sound.user?.id, "400000000000000004");
    });

    test("includes creator details when the requester can manage or create expressions", async (t) => {
        const dependencies = createDependencies(t, {
            canIncludeSoundboardSoundCreator: t.mock.fn(async () => true),
            findGuildSoundboardSounds: t.mock.fn(async () => [createSoundboardSound()]),
        });

        const response = await getGuildSoundboardSoundsResponse(guildId, viewerId, dependencies);

        assert.equal(response.items[0].user?.id, "400000000000000004");
        assert.deepEqual(mockOf(dependencies.findGuildSoundboardSounds).mock.calls[0].arguments, [guildId, { includeUser: true }]);
    });

    test("returns unknown guild before membership and sound lookups", async (t) => {
        const dependencies = createDependencies(t, {
            findGuild: t.mock.fn(async () => null),
        });

        const response = await requestJson(createApp(dependencies), `/guilds/${guildId}/soundboard-sounds`);

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.UNKNOWN_GUILD.code,
            message: DiscordApiErrors.UNKNOWN_GUILD.message,
        });
        assert.equal(mockOf(dependencies.isGuildMember).mock.callCount(), 0);
        assert.equal(mockOf(dependencies.canIncludeSoundboardSoundCreator).mock.callCount(), 0);
        assert.equal(mockOf(dependencies.findGuildSoundboardSounds).mock.callCount(), 0);
    });

    test("returns forbidden for authenticated users outside the guild", async (t) => {
        const dependencies = createDependencies(t, {
            isGuildMember: t.mock.fn(async () => false),
        });

        const response = await requestJson(createApp(dependencies), `/guilds/${guildId}/soundboard-sounds`);

        assert.equal(response.status, 403);
        assert.equal((response.body as { code?: unknown }).code, 403);
        assert.equal(mockOf(dependencies.canIncludeSoundboardSoundCreator).mock.callCount(), 0);
        assert.equal(mockOf(dependencies.findGuildSoundboardSounds).mock.callCount(), 0);
    });

    test("declares response schemas and generated route artifacts", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "guilds", "#guild_id", "soundboard-sounds.ts"), "utf8");
        const schemas = readJson<Record<string, JsonSchema>>(join("assets", "schemas.json"));
        const openapi = readJson<OpenApiDocument>(join("assets", "openapi.json"));
        const manifest = readJson<TestingManifest>(join("assets", "testing-manifest.json"));
        const sourceCatalog = readJson<SourceRouteCatalogEntry[]>(join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<MissingRoutesReport>(join("packages", "missing-routes", "missing.json"));

        assert.match(routeSource, /summary:\s*"Get Guild Soundboard Sounds"/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"GuildSoundboardSoundsResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /403:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);

        assert.equal(schemas.GuildSoundboardSoundsResponse?.type, "object");
        assert.equal(schemas.GuildSoundboardSoundsResponse?.properties?.items?.type, "array");
        assert.equal(schemas.GuildSoundboardSoundsResponse?.properties?.items?.items?.$ref, "#/definitions/SoundboardSoundResponse");
        assert.deepEqual(schemas.GuildSoundboardSoundsResponse?.required, ["items"]);
        assert.equal(schemas.SoundboardSoundResponse?.properties?.sound_id?.type, "string");
        assert.equal(schemas.SoundboardSoundResponse?.properties?.name?.type, "string");
        assert.equal(schemas.SoundboardSoundResponse?.properties?.volume?.$ref, "#/definitions/SoundboardVolume");
        assert.equal(schemas.SoundboardSoundResponse?.properties?.available?.type, "boolean");

        const route = openapi.paths?.["/guilds/{guild_id}/soundboard-sounds/"]?.get ?? openapi.paths?.["/guilds/{guild_id}/soundboard-sounds"]?.get;
        assert.equal(route?.summary, "Get Guild Soundboard Sounds");
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/GuildSoundboardSoundsResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId || entry.id === coveredManifestId.slice(0, -1));
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("GuildSoundboardSoundsResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [200, 401, 403, 404],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/guilds/{guild_id}/soundboard-sounds");
        assert.equal(catalogEntry?.route_name, "GET_GUILDS_GUILD_ID_SOUNDBOARD_SOUNDS");
        assert.equal(catalogEntry?.source, "src/api/routes/guilds/#guild_id/soundboard-sounds.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "GuildSoundboardSoundsResponse"]);

        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "GET" && entry.route === "/guilds/{param}/soundboard-sounds"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "POST" && entry.route === "/guilds/{param}/soundboard-sounds"),
            true,
        );
    });
});

function createApp(dependencies: GuildSoundboardSoundsDependencies) {
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = viewerId;
        next();
    });
    app.use("/guilds/:guild_id/soundboard-sounds", createGuildSoundboardSoundsRouter(dependencies));
    app.use(ErrorHandler);
    return app;
}

function createAuthenticatedApp(dependencies: GuildSoundboardSoundsDependencies) {
    const app = express();
    app.use(Authentication);
    app.use("/guilds/:guild_id/soundboard-sounds", createGuildSoundboardSoundsRouter(dependencies));
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
        canIncludeSoundboardSoundCreator: t.mock.fn(async () => {
            throw new Error("permission lookup should not run");
        }),
        findGuildSoundboardSounds: t.mock.fn(async () => {
            throw new Error("sound lookup should not run");
        }),
    });
}

function createDependencies(t: TestContext, overrides: Partial<GuildSoundboardSoundsDependencies> = {}): GuildSoundboardSoundsDependencies {
    return {
        findGuild: t.mock.fn(async () => ({ id: guildId })),
        isGuildMember: t.mock.fn(async () => true),
        canIncludeSoundboardSoundCreator: t.mock.fn(async () => false),
        findGuildSoundboardSounds: t.mock.fn(async () => []),
        ...overrides,
    };
}

function createSoundboardSound(): SoundboardSoundResponse {
    return {
        sound_id: "300000000000000003",
        name: "Air horn",
        volume: 0.8,
        emoji_id: null,
        emoji_name: "horn",
        guild_id: guildId,
        available: true,
        user: {
            id: "400000000000000004",
            username: "creator",
            discriminator: "0001",
            avatar: null,
            public_flags: 0,
        },
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

type MissingRoutesReport = {
    missing_entries: {
        method?: string;
        route?: string;
    }[];
};
