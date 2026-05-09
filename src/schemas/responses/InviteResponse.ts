/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTIBILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import type { ChannelType, PublicUser, Snowflake } from "@spacebar/schemas";
import type { UserInviteResponse } from "./UserInviteResponse";

export type InviteResponse = APIInvite | UserInviteResponse;

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
