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

// TODO: clean up util imports
import type { GeneralConfiguration, LimitsConfiguration } from "../../util/config/types";
import type { DmChannelDTO } from "../../util/dtos";
import type { APIWebhook, ChannelPermissionOverwrite, ChannelType } from "../api/channels";
import type { ApplicationInstallParams } from "../api/developers/ApplicationModifySchema";
import type { RoleColors } from "../api/guilds/Role";
import type { PublicMember, PublicUser } from "../api/users";
import type { Snowflake } from "../Identifiers";
import type { GuildVoiceRegion } from "./GuildVoiceRegionsResponse";
import type { GuildCreateResponse, PrivateUser, PublicMessage } from "@spacebar/schemas";

export interface APIGuild extends GuildCreateResponse {
    owner_id: Snowflake;
    joined_at?: string;
    permissions?: string;
}
export type APIPublicUser = PublicUser;
export type APIPrivateUser = PrivateUser;
export type APIGuildArray = APIGuild[];
export type APIDMChannelArray = DmChannelDTO[];

export interface APIBackupCode {
    id: Snowflake;
    code: string;
    consumed: boolean;
}
export type APIBackupCodeArray = APIBackupCode[];

export interface UserUpdateResponse extends APIPrivateUser {
    newToken?: string;
}

export type ApplicationDetectableResponse = unknown[];
export type ApplicationEntitlementsResponse = unknown[];
export type ApplicationSkusResponse = unknown[];

export interface APIApplication {
    id: Snowflake;
    name: string;
    icon?: string | null;
    description: string;
    summary?: string;
    type?: object;
    hook?: boolean;
    bot_public?: boolean;
    bot_require_code_grant?: boolean;
    verify_key?: string;
    owner?: PublicUser;
    flags: number;
    redirect_uris?: string[];
    rpc_application_state?: number;
    store_application_state?: number;
    verification_state?: number;
    interactions_endpoint_url?: string | null;
    integration_public?: boolean;
    integration_require_code_grant?: boolean;
    discoverability_state?: number;
    discovery_eligibility_flags?: number;
    bot?: PublicUser;
    tags?: string[];
    cover_image?: string | null;
    install_params?: ApplicationInstallParams | null;
    terms_of_service_url?: string;
    privacy_policy_url?: string;
    guild_id?: Snowflake;
    custom_install_url?: string;
}
export type APIApplicationArray = APIApplication[];

export interface APIInviteGuild {
    id: Snowflake;
    name: string;
    icon?: string | null;
    splash?: string | null;
    banner?: string | null;
    description?: string | null;
    features?: string[];
    verification_level?: number;
    vanity_url_code?: string | null;
    nsfw_level?: number;
    nsfw?: boolean;
    premium_subscription_count?: number;
}

export interface APIInviteChannel {
    id: Snowflake;
    name?: string | null;
    type: ChannelType;
}

export interface APIInvite {
    code: string;
    guild?: APIInviteGuild | null;
    channel?: APIInviteChannel | null;
    inviter?: PublicUser | null;
    target_user?: PublicUser | null;
    target_type?: number;
    approximate_presence_count?: number;
    approximate_member_count?: number;
    expires_at?: string | null;
    stage_instance?: unknown;
    guild_scheduled_event?: unknown;
    created_at?: string;
    max_age?: number;
    uses?: number;
    max_uses?: number;
    temporary?: boolean;
    flags?: number;
}
export type APIInviteArray = APIInvite[];
export type APIPublicMessage = PublicMessage;
export type APIMessageArray = APIPublicMessage[];
export type MessageListResponse = APIPublicMessage[];
export type APIWebhookArray = APIWebhook[];

export interface CategoryLocalizations {
    [locale: string]: string;
}

export interface APIDiscoveryCategory {
    id: number;
    name: string;
    localizations: CategoryLocalizations;
    is_primary: boolean;
    icon?: string;
}
export type APIDiscoveryCategoryArray = APIDiscoveryCategory[];
export type APIGeneralConfiguration = GeneralConfiguration;

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

export interface APIGuildWithJoinedAt extends GuildCreateResponse {
    joined_at: string;
}

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
export type APIGuildVoiceRegion = GuildVoiceRegion[];
export type APILimitsConfiguration = LimitsConfiguration;

export type APIConnectionsConfiguration = Record<
    string,
    {
        enabled: boolean;
    }
>;
