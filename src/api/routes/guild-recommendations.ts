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

import { Config, Guild } from "@spacebar/util";

import { route } from "@spacebar/api";
import { Request, Response, Router } from "express";
import { ArrayContains } from "typeorm";
import { type GuildRecommendationsResponse, type RecommendedGuild } from "@spacebar/schemas";

const router = Router({ mergeParams: true });

function toRecommendedGuild(guild: Guild): RecommendedGuild {
    return {
        id: guild.id,
        name: guild.name,
        icon: guild.icon ?? null,
        banner: guild.banner ?? null,
        splash: guild.splash ?? null,
        description: guild.description ?? null,
        features: guild.features,
        preferred_locale: guild.preferred_locale,
        premium_subscription_count: guild.premium_subscription_count,
        member_count: guild.member_count,
        verification_level: guild.verification_level,
        default_message_notifications: guild.default_message_notifications,
        explicit_content_filter: guild.explicit_content_filter,
        mfa_level: guild.mfa_level,
        large: guild.large,
        max_members: guild.max_members,
        max_presences: guild.max_presences,
        max_video_channel_users: guild.max_video_channel_users,
        owner_id: guild.owner_id,
        premium_tier: guild.premium_tier,
        region: guild.region,
        system_channel_id: guild.system_channel_id,
        rules_channel_id: guild.rules_channel_id,
        public_updates_channel_id: guild.public_updates_channel_id,
        afk_channel_id: guild.afk_channel_id,
        afk_timeout: guild.afk_timeout,
        system_channel_flags: guild.system_channel_flags,
        widget_channel_id: guild.widget_channel_id,
        widget_enabled: guild.widget_enabled,
        welcome_screen: guild.welcome_screen,
        nsfw_level: guild.nsfw_level,
        premium_progress_bar_enabled: guild.premium_progress_bar_enabled,
        unavailable: guild.unavailable || undefined,
    };
}

router.get(
    "/",
    route({
        responses: {
            200: {
                body: "GuildRecommendationsResponse",
            },
        },
        spacebarOnly: false, // Not part of public openapi schema
    }),
    async (req: Request, res: Response) => {
        // const { limit, personalization_disabled } = req.query;
        const { limit } = req.query;
        const showAllGuilds = Config.get().guild.discovery.showAllGuilds;

        const genLoadId = (size: number) => [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join("");

        const guilds = showAllGuilds
            ? await Guild.find({ take: Math.abs(Number(limit || 24)) })
            : await Guild.find({
                  where: { features: ArrayContains(["DISCOVERABLE"]) },
                  take: Math.abs(Number(limit || 24)),
              });
        const response = {
            recommended_guilds: guilds.map(toRecommendedGuild),
            load_id: `server_recs/${genLoadId(32)}`,
        } satisfies GuildRecommendationsResponse;

        return res.status(200).send(response);
    },
);

export default router;
