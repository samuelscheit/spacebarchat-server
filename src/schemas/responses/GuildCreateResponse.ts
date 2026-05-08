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

import { GuildWelcomeScreen } from "../api/guilds/GuildWelcomeScreen";

export interface GuildCreateResponse {
    id: string;
    name: string;
    large?: boolean;
    max_members?: number;
    max_presences?: number;
    max_video_channel_users?: number;
    max_stage_video_channel_users?: number;
    member_count?: number;
    presence_count?: number;
    mfa_level?: number;
    owner_id?: string;
    premium_subscription_count?: number;
    premium_tier?: number;
    welcome_screen: GuildWelcomeScreen;
    widget_channel_id?: string;
    widget_enabled: boolean;
    nsfw_level?: number;
    nsfw: boolean;
    parent?: string;
    region?: string;
    icon?: string | null;
    system_channel_id?: string;
    rules_channel_id?: string;
    guild_template_code?: string;
    staff_only?: boolean;
    banner?: string | null;
    splash?: string | null;
    description?: string;
    features?: string[];
    verification_level?: number;
    default_message_notifications?: number;
    system_channel_flags?: number;
    explicit_content_filter?: number;
    public_updates_channel_id?: string;
    afk_timeout?: number;
    afk_channel_id?: string;
    preferred_locale?: string;
    premium_progress_bar_enabled?: boolean;
    discovery_splash?: string;
    safety_alerts_channel_id?: string | null;
}
