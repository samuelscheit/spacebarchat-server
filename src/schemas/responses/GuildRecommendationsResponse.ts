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

export interface RecommendedGuildWelcomeScreen {
    enabled: boolean;
    description: string;
    welcome_channels: {
        description: string;
        emoji_id?: string;
        emoji_name?: string;
        channel_id: string;
    }[];
}

export interface RecommendedGuild {
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
    max_stage_video_channel_users?: number;
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
    welcome_screen: RecommendedGuildWelcomeScreen;
    nsfw_level?: number;
    premium_progress_bar_enabled?: boolean;
    unavailable?: boolean;
}

export interface GuildRecommendationsResponse {
    recommended_guilds: RecommendedGuild[];
    load_id: string;
}
