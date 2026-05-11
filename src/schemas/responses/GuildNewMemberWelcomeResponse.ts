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

import type { Snowflake } from "../Identifiers";

export interface GuildNewMemberWelcomeResponse {
    guild_id: Snowflake;
    enabled: boolean;
    welcome_message: GuildNewMemberWelcomeMessage;
    new_member_actions: GuildNewMemberAction[];
    resource_channels: GuildNewMemberResourceChannel[];
}

export interface GuildNewMemberWelcomeMessage {
    author_ids: Snowflake[];
    message: string;
}

export interface GuildNewMemberAction {
    channel_id: Snowflake;
    action_type: 0 | 1;
    title: string;
    description: string;
    emoji?: GuildNewMemberWelcomeEmoji;
    icon?: string;
}

export interface GuildNewMemberResourceChannel {
    channel_id: Snowflake;
    title: string;
    description: string;
    emoji?: GuildNewMemberWelcomeEmoji;
    icon?: string;
}

export interface GuildNewMemberWelcomeEmoji {
    id?: Snowflake | null;
    name?: string | null;
    animated?: boolean;
}
