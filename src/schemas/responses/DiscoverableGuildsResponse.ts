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

import type { Categories } from "@spacebar/util";

export interface DiscoverableGuildWelcomeScreen {
    enabled: boolean;
    description: string;
    welcome_channels: {
        description: string;
        emoji_id?: string;
        emoji_name?: string;
        channel_id: string;
    }[];
}

export interface DiscoverableGuild {
    id: string;
    name: string;
    icon?: string | null;
    banner?: string | null;
    splash?: string | null;
    description?: string | null;
    features: string[];
    preferred_locale?: string;
    premium_subscription_count?: number;
    member_count?: number;
    verification_level?: number;
    default_message_notifications?: number;
    explicit_content_filter?: number;
    mfa_level?: number;
    large?: boolean;
    max_members?: number;
    max_presences?: number;
    max_video_channel_users?: number;
    owner_id?: string;
    premium_tier?: number;
    region?: string;
    system_channel_id?: string | null;
    rules_channel_id?: string | null;
    public_updates_channel_id?: string | null;
    afk_channel_id?: string | null;
    afk_timeout?: number;
    system_channel_flags?: number;
    widget_channel_id?: string | null;
    widget_enabled: boolean;
    welcome_screen: DiscoverableGuildWelcomeScreen;
    nsfw_level?: number;
    premium_progress_bar_enabled?: boolean;
    unavailable?: boolean;
}

export interface DiscoverableGuildSource extends Omit<DiscoverableGuild, "icon" | "banner" | "splash" | "description" | "unavailable" | "welcome_screen"> {
    icon?: string | null;
    banner?: string | null;
    splash?: string | null;
    description?: string | null;
    unavailable?: boolean | null;
    welcome_screen: DiscoverableGuildWelcomeScreen;
}

function omitUndefined<T extends object>(value: T): T {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

export function toDiscoverableGuild(guild: DiscoverableGuildSource): DiscoverableGuild {
    return omitUndefined({
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
        welcome_screen: {
            enabled: guild.welcome_screen.enabled,
            description: guild.welcome_screen.description,
            welcome_channels: guild.welcome_screen.welcome_channels.map((channel) =>
                omitUndefined({
                    description: channel.description,
                    emoji_id: channel.emoji_id,
                    emoji_name: channel.emoji_name,
                    channel_id: channel.channel_id,
                }),
            ),
        },
        nsfw_level: guild.nsfw_level,
        premium_progress_bar_enabled: guild.premium_progress_bar_enabled,
        unavailable: guild.unavailable ? true : undefined,
    });
}

export interface DiscoverableGuildsResponse {
    total: number;
    guilds: DiscoverableGuild[];
    offset: number;
    limit: number;
}

export type APIDiscoveryCategoryArray = Categories[];
