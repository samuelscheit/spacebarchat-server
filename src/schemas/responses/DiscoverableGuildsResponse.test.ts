/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors

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
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { GuildFeature } from "../../util/util/GuildFeatures";
import { ajv } from "../Validator";
import { toDiscoverableGuild } from "./DiscoverableGuildsResponse";

const assetsPath = path.join(process.cwd(), "assets");

interface JsonShape {
    $ref?: string;
    items?: JsonShape;
    properties?: Record<string, JsonShape>;
    required?: string[];
    type?: string | string[];
}

function readAssetJson<T>(name: string): T {
    return JSON.parse(fs.readFileSync(path.join(assetsPath, name), "utf8")) as T;
}

test("toDiscoverableGuild maps entity-shaped guilds to public DTOs", () => {
    const guild = {
        id: "100",
        name: "Discoverable guild",
        icon: undefined,
        banner: "banner-hash",
        splash: null,
        description: undefined,
        features: [GuildFeature.Discoverable],
        preferred_locale: "en-US",
        premium_subscription_count: 2,
        member_count: 42,
        verification_level: 1,
        default_message_notifications: 1,
        explicit_content_filter: 2,
        mfa_level: 1,
        large: false,
        max_members: 5000,
        max_presences: 1000,
        max_video_channel_users: 25,
        max_stage_video_channel_users: 50,
        owner_id: "200",
        premium_tier: 1,
        region: "deprecated",
        system_channel_id: null,
        rules_channel_id: "300",
        public_updates_channel_id: null,
        afk_channel_id: "400",
        afk_timeout: 300,
        system_channel_flags: 4,
        widget_channel_id: null,
        widget_enabled: true,
        welcome_screen: {
            enabled: true,
            description: "Welcome!",
            welcome_channels: [
                {
                    description: "Read the rules",
                    emoji_name: "👋",
                    channel_id: "300",
                    internal_note: "not public",
                },
            ],
            internal_flag: true,
        },
        nsfw_level: 0,
        premium_progress_bar_enabled: false,
        unavailable: false,
        discovery_weight: 999,
        discovery_excluded: false,
        discovery_splash: "internal-splash",
        channel_ordering: ["300"],
        primary_category_id: 1,
        nsfw: false,
        presence_count: 5,
    } as unknown as Parameters<typeof toDiscoverableGuild>[0] & Record<string, unknown>;

    assert.deepEqual(toDiscoverableGuild(guild), {
        id: "100",
        name: "Discoverable guild",
        icon: null,
        banner: "banner-hash",
        splash: null,
        description: null,
        features: [GuildFeature.Discoverable],
        preferred_locale: "en-US",
        premium_subscription_count: 2,
        member_count: 42,
        verification_level: 1,
        default_message_notifications: 1,
        explicit_content_filter: 2,
        mfa_level: 1,
        large: false,
        max_members: 5000,
        max_presences: 1000,
        max_video_channel_users: 25,
        max_stage_video_channel_users: 50,
        owner_id: "200",
        premium_tier: 1,
        region: "deprecated",
        system_channel_id: null,
        rules_channel_id: "300",
        public_updates_channel_id: null,
        afk_channel_id: "400",
        afk_timeout: 300,
        system_channel_flags: 4,
        widget_channel_id: null,
        widget_enabled: true,
        welcome_screen: {
            enabled: true,
            description: "Welcome!",
            welcome_channels: [
                {
                    description: "Read the rules",
                    emoji_name: "👋",
                    channel_id: "300",
                },
            ],
        },
        nsfw_level: 0,
        premium_progress_bar_enabled: false,
    });
});

test("DiscoverableGuildsResponse uses discoverable DTOs instead of Guild entities", () => {
    const schemas = readAssetJson<Record<string, JsonShape>>("schemas.json");
    const response = schemas.DiscoverableGuildsResponse;
    const guild = schemas.DiscoverableGuild;

    assert.equal(response.properties?.guilds?.type, "array");
    assert.equal(response.properties?.guilds?.items?.$ref, "#/definitions/DiscoverableGuild");
    assert.notEqual(response.properties?.guilds?.items?.$ref, "#/definitions/Guild");
    assert.ok(guild.properties);
    assert.equal(guild.properties.discovery_weight, undefined);
    assert.equal(guild.properties.discovery_excluded, undefined);
    assert.equal(guild.properties.discovery_splash, undefined);
    assert.equal(guild.properties.channel_ordering, undefined);
    assert.equal(guild.properties.primary_category_id, undefined);
});

test("DiscoverableGuildsResponse validates public guilds and rejects entity internals", () => {
    const response = {
        total: 1,
        guilds: [
            {
                id: "100",
                name: "Discoverable guild",
                icon: null,
                banner: null,
                splash: null,
                description: null,
                features: [GuildFeature.Discoverable],
                widget_enabled: true,
                welcome_screen: {
                    enabled: false,
                    description: "",
                    welcome_channels: [],
                },
            },
        ],
        offset: 0,
        limit: 24,
    };

    assert.equal(ajv.validate("DiscoverableGuildsResponse", response), true);
    assert.equal(
        ajv.validate("DiscoverableGuildsResponse", {
            ...response,
            guilds: [{ ...response.guilds[0], discovery_splash: "hidden" }],
        }),
        false,
    );
});
