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

import type { IntegrationApplication, PublicMessage } from "../api/messages/Message";
import type { PartialUser } from "../api/users/User";
import type { Snowflake } from "../Identifiers";

export type NotificationCenterItemType =
    | "go_live_push"
    | "friend_request_accepted"
    | "friend_request_pending"
    | "friend_suggestion_created"
    | "friend_request_reminder"
    | "dm_friend_nudge"
    | "recent_mention"
    | "reply_mention"
    | "scheduled_guild_event_started"
    | "system_demo"
    | "missed_messages"
    | "top_messages"
    | "lifecycle_item"
    | "trending_content"
    | "poll_ended"
    | "game_friend_request_accepted"
    | "reaction_sent"
    | string;

export enum NotificationCenterItemEnum {
    UPDATE_PROFILE = 0,
    FIND_FRIENDS = 1,
    ADD_FRIEND = 2,
    FIRST_MESSAGE = 3,
}

export interface NotificationCenterItemResponse {
    id: Snowflake;
    bundle_id: string;
    type: NotificationCenterItemType;
    item_enum: NotificationCenterItemEnum | null;
    body: string;
    acked: boolean;
    deeplink: string;
    icon_url?: string | null;
    icon_name?: string | null;
    other_user: PartialUser | null;
    message: PublicMessage | null;
    completed: boolean;
    guild_id: Snowflake | null;
    message_id: Snowflake | null;
    message_channel_id: Snowflake | null;
    guild_scheduled_event_id: Snowflake | null;
    disable_action: boolean;
    callout: string | null;
    application: IntegrationApplication | null;
    emoji_id?: Snowflake | null;
    emoji_name?: string | null;
    message_content?: string | null;
    message_embed_count?: number;
    message_attachment_count?: number;
    message_sticker_count?: number;
    is_voice_message: boolean;
}

export interface NotificationCenterItemsResponse {
    limit: number;
    items: NotificationCenterItemResponse[];
    cursor: Snowflake | null;
    has_more: boolean;
}
