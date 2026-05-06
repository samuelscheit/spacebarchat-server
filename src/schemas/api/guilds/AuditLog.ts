/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2025 Spacebar and Spacebar Contributors

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

import { ChannelPermissionOverwrite, PublicUser, Snowflake, StringStringDictionary } from "@spacebar/schemas";

export enum AuditLogEvents {
    // guild level
    GUILD_UPDATE = 1,
    GUILD_IMPORT = 2,
    GUILD_EXPORTED = 3,
    GUILD_ARCHIVE = 4,
    GUILD_UNARCHIVE = 5,
    // join-leave
    USER_JOIN = 6,
    USER_LEAVE = 7,
    // channels
    CHANNEL_CREATE = 10,
    CHANNEL_UPDATE = 11,
    CHANNEL_DELETE = 12,
    // permission overrides
    CHANNEL_OVERWRITE_CREATE = 13,
    CHANNEL_OVERWRITE_UPDATE = 14,
    CHANNEL_OVERWRITE_DELETE = 15,
    // kick and ban
    MEMBER_KICK = 20,
    MEMBER_PRUNE = 21,
    MEMBER_BAN_ADD = 22,
    MEMBER_BAN_REMOVE = 23,
    // member updates
    MEMBER_UPDATE = 24,
    MEMBER_ROLE_UPDATE = 25,
    MEMBER_MOVE = 26,
    MEMBER_DISCONNECT = 27,
    BOT_ADD = 28,
    // roles
    ROLE_CREATE = 30,
    ROLE_UPDATE = 31,
    ROLE_DELETE = 32,
    ROLE_SWAP = 33,
    // invites
    INVITE_CREATE = 40,
    INVITE_UPDATE = 41,
    INVITE_DELETE = 42,
    // webhooks
    WEBHOOK_CREATE = 50,
    WEBHOOK_UPDATE = 51,
    WEBHOOK_DELETE = 52,
    WEBHOOK_SWAP = 53,
    // custom emojis
    EMOJI_CREATE = 60,
    EMOJI_UPDATE = 61,
    EMOJI_DELETE = 62,
    EMOJI_SWAP = 63,
    // deletion
    MESSAGE_CREATE = 70, // messages sent using non-primary seat of the user only
    MESSAGE_EDIT = 71, // non-self edits only
    MESSAGE_DELETE = 72,
    MESSAGE_BULK_DELETE = 73,
    // pinning
    MESSAGE_PIN = 74,
    MESSAGE_UNPIN = 75,
    // integrations
    INTEGRATION_CREATE = 80,
    INTEGRATION_UPDATE = 81,
    INTEGRATION_DELETE = 82,
    // stage actions
    STAGE_INSTANCE_CREATE = 83,
    STAGE_INSTANCE_UPDATE = 84,
    STAGE_INSTANCE_DELETE = 85,
    // stickers
    STICKER_CREATE = 90,
    STICKER_UPDATE = 91,
    STICKER_DELETE = 92,
    STICKER_SWAP = 93,
    // guild scheduled events
    GUILD_SCHEDULED_EVENT_CREATE = 100,
    GUILD_SCHEDULED_EVENT_UPDATE = 101,
    GUILD_SCHEDULED_EVENT_DELETE = 102,
    // threads
    THREAD_CREATE = 110,
    THREAD_UPDATE = 111,
    THREAD_DELETE = 112,
    // application commands
    APPLICATION_COMMAND_PERMISSION_UPDATE = 121,
    // soundboard
    SOUNDBOARD_SOUND_CREATE = 130,
    SOUNDBOARD_SOUND_UPDATE = 131,
    SOUNDBOARD_SOUND_DELETE = 132,
    // automod; Spacebar policy names mirror Discord auto moderation rule/block events
    POLICY_CREATE = 140,
    POLICY_UPDATE = 141,
    POLICY_DELETE = 142,
    MESSAGE_BLOCKED_BY_POLICIES = 143, // in spacebar, blocked messages are stealth-dropped
    AUTO_MODERATION_FLAG_TO_CHANNEL = 144,
    AUTO_MODERATION_USER_COMMUNICATION_DISABLED = 145,
    AUTO_MODERATION_QUARANTINE_USER = 146,
    // creator monetization
    CREATOR_MONETIZATION_REQUEST_CREATED = 150,
    CREATOR_MONETIZATION_TERMS_ACCEPTED = 151,
    // onboarding
    ONBOARDING_PROMPT_CREATE = 163,
    ONBOARDING_PROMPT_UPDATE = 164,
    ONBOARDING_PROMPT_DELETE = 165,
    ONBOARDING_CREATE = 166,
    ONBOARDING_UPDATE = 167,
    // server guide
    HOME_SETTINGS_CREATE = 190,
    HOME_SETTINGS_UPDATE = 191,
    // voice channel status
    VOICE_CHANNEL_STATUS_UPDATE = 192,
    VOICE_CHANNEL_STATUS_DELETE = 193,
    // instance policies affecting the guild
    GUILD_AFFECTED_BY_POLICIES = 216,
    // message moves
    IN_GUILD_MESSAGE_MOVE = 223,
    CROSS_GUILD_MESSAGE_MOVE = 224,
    // message routing
    ROUTE_CREATE = 225,
    ROUTE_UPDATE = 226,
}

export interface AuditLogResponse {
    application_commands: object[];
    audit_log_entries: AuditLogEntry[];
    auto_moderation_rules: object[];
    guild_scheduled_events: object[];
    integrations: object[];
    threads: object[];
    users: PublicUser[];
    webhooks: object[];
}

export interface AuditLogEntry {
    target_id?: string | null;
    changes?: AuditLogChange[];
    user_id?: Snowflake | null;
    id: Snowflake;
    action_type: AuditLogEvents;
    options?: StringStringDictionary;
    reason?: string;
}

export type AuditLogChange = AuditLogGenericChange | AuditLogPartialRoleChange | AuditLogApplicationCommandPermissionChange;

/**
 * Discord reserves "$add" and "$remove" for role changes, and numeric keys for
 * application command permission changes. Keep those out of the generic branch
 * so they validate against their stricter value shapes.
 *
 * @TJS-pattern ^(?!(?:\$add|\$remove|\d+)$).+$
 */
export type AuditLogGenericChangeKey = string;

/**
 * @TJS-pattern ^\d+$
 */
export type AuditLogApplicationCommandPermissionKey = string;

export interface AuditLogGenericChange {
    new_value?: AuditLogGenericChangeValue;
    old_value?: AuditLogGenericChangeValue;
    key: AuditLogGenericChangeKey;
}

export interface AuditLogPartialRoleChange {
    key: "$add" | "$remove";
    new_value?: AuditLogPartialRole[];
    old_value?: AuditLogPartialRole[];
}

export interface AuditLogApplicationCommandPermissionChange {
    key: AuditLogApplicationCommandPermissionKey;
    new_value?: AuditLogApplicationCommandPermissionValue;
    old_value?: AuditLogApplicationCommandPermissionValue;
}

export type AuditLogGenericChangeValue = string | number | boolean | null | Snowflake[] | ChannelPermissionOverwrite[] | AuditLogJsonValue;

export type AuditLogJsonValue = string | number | boolean | null | AuditLogJsonValue[] | { [key: string]: AuditLogJsonValue };

export interface AuditLogPartialRole {
    id: Snowflake;
    name: string;
}

export interface AuditLogApplicationCommandPermissionValue {
    id: Snowflake;
    type: number;
    permission: boolean;
}
