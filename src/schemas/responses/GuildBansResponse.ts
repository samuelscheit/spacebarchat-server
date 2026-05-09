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

import type { ChannelPermissionOverwrite, ChannelType, GuildCreateResponse, PublicMember, PublicUser, RoleColors, Snowflake } from "@spacebar/schemas";

export type GuildBansResponse = GuildBanResponse[];

export interface GuildBanResponse {
    reason: string | null;
    user: {
        username: string;
        discriminator: string;
        id: string;
        avatar: string | null;
        public_flags: number;
    };
}

export interface APIChannelTag {
    id: Snowflake;
    name: string;
    moderated: boolean;
    emoji_id?: Snowflake;
    emoji_name?: string;
}

export interface APIThreadMetadata {
    archived: boolean;
    auto_archive_duration: number;
    archive_timestamp: string;
    locked: boolean;
    invitable?: boolean;
    create_timestamp: string;
}

export interface APIThreadMember {
    id?: Snowflake;
    user_id?: Snowflake;
    join_timestamp: string;
    flags: number;
    member?: PublicMember;
}

export interface APIChannel {
    id: Snowflake;
    created_at?: string;
    name?: string | null;
    icon?: string | null;
    type: ChannelType;
    recipients?: PublicUser[];
    last_message_id?: Snowflake | null;
    guild_id?: Snowflake;
    parent_id?: Snowflake | null;
    owner_id?: Snowflake;
    last_pin_timestamp?: string | null;
    default_auto_archive_duration?: number;
    permission_overwrites?: ChannelPermissionOverwrite[];
    video_quality_mode?: number;
    bitrate?: number;
    user_limit?: number;
    nsfw?: boolean;
    rate_limit_per_user?: number;
    topic?: string | null;
    retention_policy_id?: Snowflake;
    flags?: number;
    default_thread_rate_limit_per_user?: number;
    thread_metadata?: APIThreadMetadata;
    member_count?: number;
    message_count?: number;
    total_message_sent?: number;
    available_tags?: APIChannelTag[];
    applied_tags?: Snowflake[];
    status?: string | null;
    position?: number;
}

export type APIChannelArray = APIChannel[];
export type APIMemberArray = PublicMember[];
export type APIPublicMember = PublicMember;

export interface APIRole {
    id: Snowflake;
    guild_id: Snowflake;
    color: number;
    hoist: boolean;
    managed: boolean;
    mentionable: boolean;
    name: string;
    permissions: string;
    position: number;
    icon?: string | null;
    unicode_emoji?: string | null;
    tags?: {
        bot_id?: Snowflake;
        integration_id?: Snowflake;
        premium_subscriber?: boolean;
    };
    flags: number;
    colors: RoleColors;
}

export type APIRoleArray = APIRole[];

export interface APITemplateGuild extends GuildCreateResponse {
    roles?: APIRole[];
    channels?: APIChannel[];
}

export interface APITemplate {
    code: string;
    name: string;
    description?: string | null;
    usage_count?: number;
    creator_id: Snowflake;
    creator?: PublicUser;
    created_at: string;
    updated_at: string;
    source_guild_id: Snowflake;
    serialized_source_guild: APITemplateGuild;
    id: Snowflake;
}

export type APITemplateArray = APITemplate[];
