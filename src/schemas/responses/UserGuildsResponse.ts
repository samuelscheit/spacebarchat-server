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

import { GuildWelcomeScreen } from "../api/guilds/GuildWelcomeScreen";

export interface UserGuildResponse {
    id: string;
    name: string;
    afk_channel_id?: string | null;
    afk_timeout?: number;
    banner?: string | null;
    default_message_notifications?: number;
    description?: string | null;
    discovery_splash?: string | null;
    explicit_content_filter?: number;
    features?: string[];
    icon?: string | null;
    large?: boolean;
    max_members?: number;
    max_presences?: number;
    max_video_channel_users?: number;
    member_count?: number;
    mfa_level?: number;
    owner_id?: string;
    preferred_locale?: string;
    premium_progress_bar_enabled?: boolean;
    premium_subscription_count?: number;
    premium_tier?: number;
    public_updates_channel_id?: string | null;
    region?: string | null;
    rules_channel_id?: string | null;
    splash?: string | null;
    system_channel_flags?: number;
    system_channel_id?: string | null;
    unavailable?: boolean;
    verification_level?: number;
    welcome_screen?: GuildWelcomeScreen;
    widget_channel_id?: string | null;
    widget_enabled?: boolean;
    nsfw_level?: number;
    nsfw?: boolean;
    approximate_member_count?: number;
    approximate_presence_count?: number;
    permissions?: string;
}

export type UserGuildsResponse = UserGuildResponse[];
