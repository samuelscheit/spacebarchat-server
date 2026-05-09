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
import { GuildFeature } from "../../../util/util/GuildFeatures";
import test from "node:test";
import { HTTPError } from "lambert-server";
import { ajv } from "../../../schemas/Validator";
import { DiscoveryConfiguration } from "../../../util/config/types/subconfigurations/guild/Discovery";
import { assertGuildRecommendationsEnabled, toRecommendedGuild } from "./GuildRecommendations";

const internalGuildFields = ["discovery_weight", "discovery_excluded", "channel_ordering", "template_id", "parent", "primary_category_id", "nsfw", "presence_count"] as const;
type GuildShape = Parameters<typeof toRecommendedGuild>[0];

test("guild recommendations are disabled by default until explicitly enabled", () => {
    const discoveryConfig = new DiscoveryConfiguration();

    assert.equal(discoveryConfig.useRecommendation, false);
    assert.throws(
        () => assertGuildRecommendationsEnabled(discoveryConfig.useRecommendation),
        (error: unknown) => error instanceof HTTPError && error.code === 404 && error.message === "Guild recommendations are disabled",
    );
});

test("guild recommendations policy allows explicitly enabled configuration", () => {
    assert.doesNotThrow(() => assertGuildRecommendationsEnabled(true));
});

test("toRecommendedGuild serializes a Guild entity into the recommendation response contract", () => {
    const guild = {
        id: "100",
        name: "Discoverable guild",
        icon: undefined,
        banner: "banner_hash",
        splash: undefined,
        description: undefined,
        features: [GuildFeature.Discoverable],
        preferred_locale: "en-US",
        premium_subscription_count: 7,
        member_count: 42,
        verification_level: 2,
        default_message_notifications: 1,
        explicit_content_filter: 2,
        mfa_level: 1,
        large: true,
        max_members: 500000,
        max_presences: 1000,
        max_video_channel_users: 25,
        max_stage_video_channel_users: 50,
        owner_id: "10",
        premium_tier: 2,
        region: "deprecated",
        system_channel_id: null,
        rules_channel_id: "20",
        public_updates_channel_id: null,
        afk_channel_id: "30",
        afk_timeout: 300,
        system_channel_flags: 1,
        widget_channel_id: null,
        widget_enabled: true,
        welcome_screen: {
            enabled: true,
            description: "Welcome!",
            welcome_channels: [
                {
                    channel_id: "40",
                    description: "Read the rules",
                    emoji_name: "👋",
                },
            ],
        },
        nsfw_level: 1,
        premium_progress_bar_enabled: true,
        unavailable: false,
        discovery_weight: 5,
        discovery_excluded: false,
        channel_ordering: ["40"],
        template_id: "50",
        parent: "60",
        primary_category_id: 70,
        nsfw: false,
        presence_count: 3,
    } as unknown as GuildShape;

    const recommendedGuild = JSON.parse(JSON.stringify(toRecommendedGuild(guild))) as Record<string, unknown>;

    for (const field of internalGuildFields) {
        assert.equal(Object.hasOwn(recommendedGuild, field), false, `${field} should not be serialized`);
    }

    assert.equal(recommendedGuild.icon, null);
    assert.equal(recommendedGuild.splash, null);
    assert.equal(recommendedGuild.description, null);
    assert.equal(Object.hasOwn(recommendedGuild, "unavailable"), false);
    assert.equal(recommendedGuild.max_stage_video_channel_users, 50);
    assert.equal(
        ajv.validate("GuildRecommendationsResponse", {
            recommended_guilds: [recommendedGuild],
            load_id: "server_recs/0123456789abcdef0123456789abcdef",
        }),
        true,
        JSON.stringify(ajv.errors),
    );
});

test("toRecommendedGuild preserves an unavailable guild marker when it is true", () => {
    const guild = {
        id: "100",
        name: "Unavailable guild",
        features: [GuildFeature.Discoverable],
        widget_enabled: true,
        welcome_screen: {
            enabled: false,
            description: "",
            welcome_channels: [],
        },
        unavailable: true,
    } as unknown as GuildShape;

    assert.equal(toRecommendedGuild(guild).unavailable, true);
});
