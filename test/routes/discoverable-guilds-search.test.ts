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
import { join } from "node:path";
import { describe, test } from "node:test";
import express from "express";
import { Config, Guild, GuildFeature } from "@spacebar/util";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../src/api/middlewares";
import discoverableGuildsRouter, { parseDiscoverableGuildSearchQuery } from "../../src/api/routes/discoverable-guilds";

type MutableConfig = {
    get: typeof Config.get;
};

type MutableGuild = {
    findAndCount: typeof Guild.findAndCount;
};

const mutableConfig = Config as unknown as MutableConfig;
const mutableGuild = Guild as unknown as MutableGuild;

describe("GET /discoverable-guilds/search", () => {
    test("parses documented query parameters and enforces search bounds", () => {
        assert.deepEqual(
            parseDiscoverableGuildSearchQuery({
                query: "  Spacebar  ",
                limit: "99",
                offset: "4000",
                category_id: "1",
            }),
            {
                query: "Spacebar",
                limit: 48,
                offset: 2999,
                categoryId: 1,
            },
        );

        assert.deepEqual(parseDiscoverableGuildSearchQuery({ query: "Spacebar" }), {
            query: "Spacebar",
            limit: 24,
            offset: 0,
        });
    });

    test("rejects missing, repeated, and overlong search queries", () => {
        assertFieldError(() => parseDiscoverableGuildSearchQuery({}), "query");
        assertFieldError(() => parseDiscoverableGuildSearchQuery({ query: ["spacebar"] }), "query");
        assertFieldError(() => parseDiscoverableGuildSearchQuery({ query: "a".repeat(101) }), "query");
    });

    test("stays behind bearer authentication", async () => {
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/discoverable-guilds/search?query=spacebar"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v9/discoverable-guilds/search?query=spacebar"), false);

        const response = await requestJson(createRouteApp({ authenticate: true }), "/discoverable-guilds/search?query=spacebar");

        assert.equal(response.status, 401);
        assert.equal((response.body as { code?: number }).code, 401);
    });

    test("searches local discoverable guilds with documented filters and public response shape", async () => {
        const restoreConfig = installDiscoveryConfig({ showAllGuilds: false, hideJoinedGuilds: false });
        const originalFindAndCount = mutableGuild.findAndCount;
        let receivedFindOptions: unknown;

        mutableGuild.findAndCount = (async (options?: unknown) => {
            receivedFindOptions = options;
            return [[discoverableGuildFixture()], 1] as [Guild[], number];
        }) as typeof Guild.findAndCount;

        try {
            const response = await requestJson(createRouteApp({ authenticate: false }), "/discoverable-guilds/search?query=Space%20Guild&limit=99&offset=4000&category_id=1");

            assert.equal(response.status, 200);
            assert.deepEqual(response.body, {
                total: 1,
                offset: 2999,
                limit: 48,
                guilds: [
                    {
                        id: "100000000000002001",
                        name: "Space Guild",
                        icon: null,
                        banner: null,
                        splash: null,
                        description: "A public Spacebar discovery guild",
                        features: [GuildFeature.Discoverable],
                        preferred_locale: "en-US",
                        premium_subscription_count: 0,
                        member_count: 250,
                        verification_level: 0,
                        default_message_notifications: 0,
                        explicit_content_filter: 0,
                        mfa_level: 0,
                        large: false,
                        max_members: 500000,
                        max_video_channel_users: 25,
                        max_stage_video_channel_users: 50,
                        owner_id: "100000000000000001",
                        premium_tier: 0,
                        region: "deprecated",
                        system_channel_id: null,
                        rules_channel_id: null,
                        public_updates_channel_id: null,
                        afk_channel_id: null,
                        afk_timeout: 300,
                        system_channel_flags: 0,
                        widget_channel_id: null,
                        widget_enabled: false,
                        welcome_screen: {
                            enabled: false,
                            description: "",
                            welcome_channels: [],
                        },
                        nsfw_level: 0,
                        premium_progress_bar_enabled: false,
                    },
                ],
            });

            const options = receivedFindOptions as {
                order?: Record<string, string>;
                skip?: number;
                take?: number;
                where?: Record<string, unknown>[];
            };
            assert.deepEqual(options.order, { discovery_weight: "DESC", member_count: "DESC" });
            assert.equal(options.skip, 2999);
            assert.equal(options.take, 48);
            assert.equal(options.where?.length, 2);
            assert.equal(options.where?.[0]?.discovery_excluded, false);
            assert.equal(options.where?.[0]?.primary_category_id, 1);
            assert.equal((options.where?.[0]?.features as { type?: string }).type, "arrayContains");
            assert.equal((options.where?.[0]?.member_count as { type?: string }).type, "moreThan");
            assert.equal((options.where?.[0]?.presence_count as { type?: string }).type, "moreThan");
            assert.equal((options.where?.[0]?.name as { type?: string; value?: string }).type, "ilike");
            assert.equal((options.where?.[0]?.name as { type?: string; value?: string }).value, "%Space Guild%");
            assert.equal((options.where?.[1]?.description as { type?: string; value?: string }).type, "ilike");
        } finally {
            mutableGuild.findAndCount = originalFindAndCount;
            restoreConfig();
        }
    });

    test("returns form-body errors before querying guild storage", async () => {
        const originalFindAndCount = mutableGuild.findAndCount;
        mutableGuild.findAndCount = (async () => {
            throw new Error("guild storage should not be queried for invalid search input");
        }) as typeof Guild.findAndCount;

        try {
            const response = await requestJson(createRouteApp({ authenticate: false }), "/discoverable-guilds/search");
            const body = response.body as { code?: number; message?: string; errors?: Record<string, unknown> };

            assert.equal(response.status, 400);
            assert.equal(body.code, 50035);
            assert.equal(body.message, "Invalid Form Body");
            assert.ok(body.errors?.query);
        } finally {
            mutableGuild.findAndCount = originalFindAndCount;
        }
    });

    test("declares authenticated search metadata in generated route artifacts", () => {
        const openapi = readJson<{
            paths?: Record<string, { get?: { parameters?: { name?: string; in?: string; required?: boolean }[]; responses?: Record<string, unknown>; security?: unknown } }>;
        }>("assets/openapi.json");
        const manifest = readJson<{
            entries?: {
                id?: string;
                authMode?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>("assets/testing-manifest.json");
        const sourceCatalog = readJson<
            {
                method?: string;
                route?: string;
                route_name?: string;
                response_schema_refs?: string[];
            }[]
        >("packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json");

        const route = openapi.paths?.["/discoverable-guilds/search"]?.get;
        assert.equal(
            route?.parameters?.some((parameter) => parameter.in === "query" && parameter.name === "query" && parameter.required === true),
            true,
        );
        assert.equal(
            route?.parameters?.some((parameter) => parameter.in === "query" && parameter.name === "limit"),
            true,
        );
        assert.equal(
            route?.parameters?.some((parameter) => parameter.in === "query" && parameter.name === "offset"),
            true,
        );
        assert.equal(
            route?.parameters?.some((parameter) => parameter.in === "query" && parameter.name === "category_id"),
            true,
        );
        assert.ok(route?.responses?.["200"]);
        assert.ok(route?.responses?.["400"]);
        assert.ok(route?.responses?.["401"]);
        assert.ok(route?.security);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === "api:http:GET:/discoverable-guilds/search");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("DiscoverableGuildsResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(200), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(400), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(401), true);

        const sourceCatalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/discoverable-guilds/search");
        assert.equal(sourceCatalogEntry?.route_name, "GET_DISCOVERABLE_GUILDS_SEARCH");
        assert.equal(sourceCatalogEntry?.response_schema_refs?.includes("DiscoverableGuildsResponse"), true);
        assert.equal(sourceCatalogEntry?.response_schema_refs?.includes("APIErrorResponse"), true);
    });
});

function assertFieldError(callback: () => unknown, field: string) {
    assert.throws(callback, (error) => {
        assert.equal((error as { code?: unknown }).code, 50035);
        assert.equal((error as { message?: unknown }).message, "Invalid Form Body");
        assert.ok((error as { errors?: Record<string, unknown> }).errors?.[field]);
        return true;
    });
}

function createRouteApp({ authenticate }: { authenticate: boolean }) {
    const app = express();
    if (authenticate) app.use(Authentication);
    app.use("/discoverable-guilds", discoverableGuildsRouter);
    app.use(ErrorHandler);
    return app;
}

async function requestJson(app: express.Express, path: string) {
    const server = await new Promise<ReturnType<express.Express["listen"]>>((resolve) => {
        const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });

    try {
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
        const response = await fetch(`http://127.0.0.1:${(address as AddressInfo).port}${path}`);
        const text = await response.text();

        return {
            status: response.status,
            body: text ? (JSON.parse(text) as unknown) : null,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

function installDiscoveryConfig(discovery: { showAllGuilds: boolean; hideJoinedGuilds: boolean }) {
    const originalGet = mutableConfig.get;
    mutableConfig.get = (() => {
        const config = originalGet();
        return {
            ...config,
            guild: {
                ...config.guild,
                discovery: {
                    ...config.guild.discovery,
                    ...discovery,
                },
            },
        };
    }) as typeof Config.get;

    return () => {
        mutableConfig.get = originalGet;
    };
}

function discoverableGuildFixture(): Guild {
    return {
        id: "100000000000002001",
        name: "Space Guild",
        icon: null,
        banner: null,
        splash: null,
        description: "A public Spacebar discovery guild",
        features: [GuildFeature.Discoverable],
        preferred_locale: "en-US",
        premium_subscription_count: 0,
        member_count: 250,
        verification_level: 0,
        default_message_notifications: 0,
        explicit_content_filter: 0,
        mfa_level: 0,
        large: false,
        max_members: 500000,
        max_presences: undefined,
        max_video_channel_users: 25,
        max_stage_video_channel_users: 50,
        owner_id: "100000000000000001",
        premium_tier: 0,
        region: "deprecated",
        system_channel_id: null,
        rules_channel_id: null,
        public_updates_channel_id: null,
        afk_channel_id: null,
        afk_timeout: 300,
        system_channel_flags: 0,
        widget_channel_id: null,
        widget_enabled: false,
        welcome_screen: {
            enabled: false,
            description: "",
            welcome_channels: [],
        },
        nsfw_level: 0,
        premium_progress_bar_enabled: false,
        unavailable: false,
    } as unknown as Guild;
}

function readJson<T>(relativePath: string): T {
    return JSON.parse(readFileSync(join(process.cwd(), relativePath), "utf8")) as T;
}
