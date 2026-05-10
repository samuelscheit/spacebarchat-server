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
import { createEmojiGuildRouter, type EmojiGuildDependencies, type EmojiGuildRecord } from "../../src/api/routes/emojis/#emoji_id/guild";
import { requestJson } from "../../src/api/tests/helpers/UserRouteTestHelpers";
import { DiscordApiErrors, GuildFeature } from "../../src/util";

const emojiId = "100000000000000001";
const guildId = "200000000000000002";
const coveredManifestId = "api:http:GET:/emojis/:emoji_id/guild";

describe("GET /emojis/:emoji_id/guild", () => {
    test("stays behind bearer authentication", async (t) => {
        const dependencies = createThrowingDependencies(t);

        assert.equal(isNoAuthorizationRoute("GET", `/api/v9/emojis/${emojiId}/guild`), false);

        const response = await requestJson(createAuthenticatedApp(dependencies), `/emojis/${emojiId}/guild`);

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
        assert.equal(mockOf(dependencies.findEmojiGuildId).mock.callCount(), 0);
    });

    test("returns unknown emoji when the emoji row is absent", async (t) => {
        const dependencies = createDependencies(t, {
            findEmojiGuildId: t.mock.fn(async () => null),
            findGuild: t.mock.fn(async () => {
                throw new Error("guild lookup should not run for unknown emojis");
            }),
        });

        const response = await requestJson(createApp(dependencies), `/emojis/${emojiId}/guild`);

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.UNKNOWN_EMOJI.code,
            message: DiscordApiErrors.UNKNOWN_EMOJI.message,
        });
        assert.equal(mockOf(dependencies.findGuild).mock.callCount(), 0);
    });

    test("hides non-discoverable and auto-removed owner guilds", async (t) => {
        for (const guild of [
            { ...createGuildRecord(), features: [] },
            { ...createGuildRecord(), discovery_excluded: true },
        ]) {
            const dependencies = createDependencies(t, {
                findGuild: t.mock.fn(async () => guild),
            });

            const response = await requestJson(createApp(dependencies), `/emojis/${emojiId}/guild`);

            assert.equal(response.status, 404);
            assert.deepEqual(response.body, {
                code: DiscordApiErrors.UNKNOWN_EMOJI.code,
                message: DiscordApiErrors.UNKNOWN_EMOJI.message,
            });
            assert.equal(mockOf(dependencies.countMembers).mock.callCount(), 0);
            assert.equal(mockOf(dependencies.findVanityInvites).mock.callCount(), 0);
        }
    });

    test("returns the backed discoverable guild payload for the emoji owner", async (t) => {
        const guild = createGuildRecord();
        const dependencies = createDependencies(t, {
            findGuild: t.mock.fn(async () => guild),
            findVanityInvites: t.mock.fn(async () => [
                { code: "expired", isExpired: () => true },
                { code: "spacebar", isExpired: () => false },
            ]),
            countMembers: t.mock.fn(async () => 1234),
            countOnlineMembers: t.mock.fn(async () => 321),
        });

        const response = await requestJson(createApp(dependencies), `/emojis/${emojiId}/guild`);

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            id: guildId,
            name: "Discoverable Emoji Guild",
            icon: "icon-hash",
            banner: "banner-hash",
            splash: "splash-hash",
            discovery_splash: "discovery-splash-hash",
            description: "A public guild with custom emoji.",
            features: [GuildFeature.Discoverable, GuildFeature.Community],
            vanity_url_code: "spacebar",
            preferred_locale: "en-US",
            premium_subscription_count: 7,
            approximate_member_count: 1234,
            approximate_presence_count: 321,
            emojis: guild.emojis?.slice(0, 30).map((emoji) => ({
                id: emoji.id,
                animated: emoji.animated,
                available: emoji.available,
                managed: emoji.managed,
                name: emoji.name,
                require_colons: emoji.require_colons,
                roles: emoji.roles,
            })),
            emoji_count: 31,
            auto_removed: false,
            primary_category_id: 5,
            is_published: true,
        });
        assert.equal((response.body as { emojis?: unknown[] }).emojis?.length, 30);
        assert.equal(mockOf(dependencies.findEmojiGuildId).mock.calls[0].arguments[0], emojiId);
        assert.equal(mockOf(dependencies.countMembers).mock.calls[0].arguments[0], guildId);
        assert.equal(mockOf(dependencies.countOnlineMembers).mock.calls[0].arguments[0], guildId);
        assert.equal(mockOf(dependencies.findVanityInvites).mock.calls[0].arguments[0], guildId);
    });

    test("declares generated schema, OpenAPI, manifest, source catalog, and missing-route artifacts", () => {
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonSchema>;
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as OpenApiDocument;
        const manifest = JSON.parse(readFileSync(join(process.cwd(), "assets", "testing-manifest.json"), "utf8")) as TestingManifest;
        const sourceCatalog = JSON.parse(
            readFileSync(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"), "utf8"),
        ) as SourceRouteCatalogEntry[];
        const missingRoutes = JSON.parse(readFileSync(join(process.cwd(), "packages", "missing-routes", "missing.json"), "utf8")) as MissingRoutesReport;

        const responseSchema = schemas.EmojiGuildResponse;
        assert.equal(responseSchema.properties?.approximate_member_count?.type, "integer");
        assert.equal(responseSchema.properties?.approximate_presence_count?.type, "integer");
        assert.equal(responseSchema.properties?.emojis?.type, "array");
        assert.equal(responseSchema.properties?.emojis?.items?.$ref, "#/definitions/EmojiResponse");
        assert.equal(responseSchema.properties?.emoji_count?.type, "integer");
        assert.equal(responseSchema.properties?.auto_removed?.type, "boolean");

        const route = openapi.paths["/emojis/{emoji_id}/guild/"]?.get ?? openapi.paths["/emojis/{emoji_id}/guild"]?.get;
        assert.equal(route?.summary, "Get Emoji Guild");
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/EmojiGuildResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId || entry.id === `${coveredManifestId}/`);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("EmojiGuildResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(200), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(401), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(404), true);

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/emojis/{emoji_id}/guild");
        assert.equal(catalogEntry?.source, "src/api/routes/emojis/#emoji_id/guild.ts");
        assert.equal(catalogEntry?.route_name, "GET_EMOJIS_EMOJI_ID_GUILD");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "EmojiGuildResponse"]);

        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "GET" && entry.route === "/emojis/{param}/guild"),
            false,
        );
    });
});

function createApp(dependencies: EmojiGuildDependencies) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/emojis/:emoji_id/guild", createEmojiGuildRouter(dependencies));
    app.use(ErrorHandler);
    return app;
}

function createAuthenticatedApp(dependencies: EmojiGuildDependencies) {
    const app = express();
    app.use(Authentication);
    app.use("/emojis/:emoji_id/guild", createEmojiGuildRouter(dependencies));
    app.use(ErrorHandler);
    return app;
}

function createThrowingDependencies(t: TestContext) {
    return createDependencies(t, {
        findEmojiGuildId: t.mock.fn(async () => {
            throw new Error("emoji lookup should not run");
        }),
    });
}

function createDependencies(t: TestContext, overrides: Partial<EmojiGuildDependencies> = {}) {
    return {
        findEmojiGuildId: t.mock.fn(async () => guildId),
        findGuild: t.mock.fn(async () => createGuildRecord()),
        findVanityInvites: t.mock.fn(async () => []),
        countMembers: t.mock.fn(async () => 0),
        countOnlineMembers: t.mock.fn(async () => 0),
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

function createGuildRecord(): EmojiGuildRecord {
    return {
        id: guildId,
        name: "Discoverable Emoji Guild",
        icon: "icon-hash",
        banner: "banner-hash",
        splash: "splash-hash",
        discovery_splash: "discovery-splash-hash",
        description: "A public guild with custom emoji.",
        features: [GuildFeature.Discoverable, GuildFeature.Community],
        preferred_locale: "en-US",
        premium_subscription_count: 7,
        discovery_excluded: false,
        primary_category_id: 5,
        emojis: Array.from({ length: 31 }, (_, index) => ({
            id: `${300000000000000000n + BigInt(index)}`,
            animated: index % 2 === 0,
            available: true,
            managed: false,
            name: `emoji_${index}`,
            require_colons: true,
            roles: index === 0 ? ["400000000000000004"] : [],
        })),
    };
}

type JsonSchema = {
    type?: string;
    $ref?: string;
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
};

type OpenApiDocument = {
    paths: Record<
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
