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
    createSoundboardSoundGuildRouter,
    UNKNOWN_SOUNDBOARD_SOUND,
    type SoundboardSoundGuildDependencies,
    type SoundboardSoundGuildRecord,
} from "../../src/api/routes/soundboard-sounds/#sound_id/guild/#guild_id";
import { requestJson } from "../../src/api/tests/helpers/UserRouteTestHelpers";
import { GuildFeature } from "../../src/util";

const soundId = "100000000000000001";
const guildId = "200000000000000002";
const coveredManifestId = "api:http:GET:/soundboard-sounds/:sound_id/guild/:guild_id/";

describe("GET /soundboard-sounds/:sound_id/guild/:guild_id", () => {
    test("stays behind bearer authentication", async (t) => {
        const dependencies = createThrowingDependencies(t);

        assert.equal(isNoAuthorizationRoute("GET", `/api/v9/soundboard-sounds/${soundId}/guild/${guildId}`), false);

        const response = await requestJson(createAuthenticatedApp(dependencies), `/soundboard-sounds/${soundId}/guild/${guildId}`);

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
        assert.equal(mockOf(dependencies.soundExistsInGuild).mock.callCount(), 0);
    });

    test("returns unknown sound when the sound is not backed for the requested guild", async (t) => {
        const dependencies = createDependencies(t, {
            soundExistsInGuild: t.mock.fn(async () => false),
            findGuild: t.mock.fn(async () => {
                throw new Error("guild lookup should not run for unknown sounds");
            }),
        });

        const response = await requestJson(createApp(dependencies), `/soundboard-sounds/${soundId}/guild/${guildId}`);

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: UNKNOWN_SOUNDBOARD_SOUND.code,
            message: UNKNOWN_SOUNDBOARD_SOUND.message,
        });
        assert.equal(mockOf(dependencies.findGuild).mock.callCount(), 0);
    });

    test("hides guilds that cannot expose expression-discoverable sounds", async (t) => {
        for (const options of [
            { guild: { ...createGuildRecord(), features: [GuildFeature.Community] } },
            { guild: { ...createGuildRecord(), discovery_excluded: true } },
            { expressionDiscoverabilityEnabled: false },
        ]) {
            const dependencies = createDependencies(t, {
                findGuild: t.mock.fn(async () => options.guild ?? createGuildRecord()),
                isGuildExpressionDiscoverabilityEnabled: t.mock.fn(async () => options.expressionDiscoverabilityEnabled ?? true),
            });

            const response = await requestJson(createApp(dependencies), `/soundboard-sounds/${soundId}/guild/${guildId}`);

            assert.equal(response.status, 404);
            assert.deepEqual(response.body, {
                code: UNKNOWN_SOUNDBOARD_SOUND.code,
                message: UNKNOWN_SOUNDBOARD_SOUND.message,
            });
        }
    });

    test("returns the discoverable guild payload for a backed sound owner", async (t) => {
        const guild = createGuildRecord();
        const dependencies = createDependencies(t, {
            findGuild: t.mock.fn(async () => guild),
        });

        const response = await requestJson(createApp(dependencies), `/soundboard-sounds/${soundId}/guild/${guildId}`);

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            id: guildId,
            name: "Discoverable Sound Guild",
            icon: "icon-hash",
            banner: "banner-hash",
            splash: "splash-hash",
            description: "A public guild with discoverable soundboard sounds.",
            features: [GuildFeature.Discoverable, GuildFeature.Community],
            preferred_locale: "en-US",
            premium_subscription_count: 7,
            member_count: 1234,
            verification_level: 1,
            default_message_notifications: 1,
            explicit_content_filter: 2,
            mfa_level: 1,
            large: true,
            max_members: 500000,
            max_presences: 10000,
            max_video_channel_users: 25,
            max_stage_video_channel_users: 150,
            owner_id: "300000000000000003",
            premium_tier: 2,
            region: "deprecated",
            system_channel_id: "400000000000000004",
            rules_channel_id: "500000000000000005",
            public_updates_channel_id: "600000000000000006",
            afk_channel_id: null,
            afk_timeout: 300,
            system_channel_flags: 4,
            widget_channel_id: null,
            widget_enabled: true,
            welcome_screen: {
                enabled: true,
                description: "Welcome",
                welcome_channels: [
                    {
                        description: "Start here",
                        emoji_name: "wave",
                        channel_id: "700000000000000007",
                    },
                ],
            },
            nsfw_level: 0,
            premium_progress_bar_enabled: true,
        });
        assert.deepEqual(mockOf(dependencies.soundExistsInGuild).mock.calls[0].arguments, [soundId, guildId]);
        assert.equal(mockOf(dependencies.findGuild).mock.calls[0].arguments[0], guildId);
        assert.equal(mockOf(dependencies.isGuildExpressionDiscoverabilityEnabled).mock.calls[0].arguments[0], guild);
    });

    test("declares generated schema, OpenAPI, manifest, source catalog, and missing-route artifacts", () => {
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonSchema>;
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as OpenApiDocument;
        const manifest = JSON.parse(readFileSync(join(process.cwd(), "assets", "testing-manifest.json"), "utf8")) as TestingManifest;
        const sourceCatalog = JSON.parse(
            readFileSync(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"), "utf8"),
        ) as SourceRouteCatalogEntry[];
        const missingRoutes = JSON.parse(readFileSync(join(process.cwd(), "packages", "missing-routes", "missing.json"), "utf8")) as MissingRoutesReport;

        const responseSchema = schemas.DiscoverableGuild;
        assert.equal(responseSchema.properties?.welcome_screen?.$ref, "#/definitions/DiscoverableGuildWelcomeScreen");
        assert.equal(responseSchema.properties?.features?.type, "array");
        assert.equal(responseSchema.properties?.discovery_excluded, undefined);

        const route = openapi.paths["/soundboard-sounds/{sound_id}/guild/{guild_id}/"]?.get ?? openapi.paths["/soundboard-sounds/{sound_id}/guild/{guild_id}"]?.get;
        assert.equal(route?.summary, "Get Soundboard Sound Guild");
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/DiscoverableGuild");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("DiscoverableGuild"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(200), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(401), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(404), true);

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/soundboard-sounds/{sound_id}/guild/{guild_id}");
        assert.equal(catalogEntry?.source, "src/api/routes/soundboard-sounds/#sound_id/guild/#guild_id.ts");
        assert.equal(catalogEntry?.route_name, "GET_SOUNDBOARD_SOUNDS_SOUND_ID_GUILD_GUILD_ID");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "DiscoverableGuild"]);

        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "GET" && entry.route === "/soundboard-sounds/{param}/guild/{param}"),
            false,
        );
    });
});

function createApp(dependencies: SoundboardSoundGuildDependencies) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/soundboard-sounds/:sound_id/guild/:guild_id", createSoundboardSoundGuildRouter(dependencies));
    app.use(ErrorHandler);
    return app;
}

function createAuthenticatedApp(dependencies: SoundboardSoundGuildDependencies) {
    const app = express();
    app.use(Authentication);
    app.use("/soundboard-sounds/:sound_id/guild/:guild_id", createSoundboardSoundGuildRouter(dependencies));
    app.use(ErrorHandler);
    return app;
}

function createThrowingDependencies(t: TestContext) {
    return createDependencies(t, {
        soundExistsInGuild: t.mock.fn(async () => {
            throw new Error("sound lookup should not run");
        }),
    });
}

function createDependencies(t: TestContext, overrides: Partial<SoundboardSoundGuildDependencies> = {}): SoundboardSoundGuildDependencies {
    return {
        soundExistsInGuild: t.mock.fn(async () => true),
        findGuild: t.mock.fn(async () => createGuildRecord()),
        isGuildExpressionDiscoverabilityEnabled: t.mock.fn(async () => true),
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

function createGuildRecord(): SoundboardSoundGuildRecord {
    return {
        id: guildId,
        name: "Discoverable Sound Guild",
        icon: "icon-hash",
        banner: "banner-hash",
        splash: "splash-hash",
        description: "A public guild with discoverable soundboard sounds.",
        features: [GuildFeature.Discoverable, GuildFeature.Community],
        preferred_locale: "en-US",
        premium_subscription_count: 7,
        member_count: 1234,
        verification_level: 1,
        default_message_notifications: 1,
        explicit_content_filter: 2,
        mfa_level: 1,
        large: true,
        max_members: 500000,
        max_presences: 10000,
        max_video_channel_users: 25,
        max_stage_video_channel_users: 150,
        owner_id: "300000000000000003",
        premium_tier: 2,
        region: "deprecated",
        system_channel_id: "400000000000000004",
        rules_channel_id: "500000000000000005",
        public_updates_channel_id: "600000000000000006",
        afk_channel_id: null,
        afk_timeout: 300,
        system_channel_flags: 4,
        widget_channel_id: null,
        widget_enabled: true,
        welcome_screen: {
            enabled: true,
            description: "Welcome",
            welcome_channels: [
                {
                    description: "Start here",
                    emoji_name: "wave",
                    channel_id: "700000000000000007",
                },
            ],
        },
        nsfw_level: 0,
        premium_progress_bar_enabled: true,
        unavailable: null,
        discovery_excluded: false,
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
                security?: unknown;
                responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
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
        route_name?: string;
    }[];
};
