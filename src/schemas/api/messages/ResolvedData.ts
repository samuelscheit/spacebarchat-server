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

import type { Snowflake } from "../../Identifiers";
import type { ChannelType, PublicChannel, ThreadMetadata } from "../channels/Channel";
import type { PublicRole } from "../guilds/Role";
import type { PublicMember } from "../users/Member";
import type { PartialUser } from "../users/User";
import type { PublicAttachment } from "./Attachments";
import type { PartialMessage } from "./Message";

export interface ResolvedGuildMember {
    id?: PublicMember["id"];
    guild_id?: PublicMember["guild_id"];
    nick?: PublicMember["nick"];
    roles?: PublicMember["roles"];
    joined_at?: PublicMember["joined_at"];
    pending?: PublicMember["pending"];
    premium_since?: PublicMember["premium_since"];
    avatar?: PublicMember["avatar"];
    banner?: PublicMember["banner"];
    bio?: PublicMember["bio"];
    theme_colors?: PublicMember["theme_colors"];
    pronouns?: PublicMember["pronouns"];
    communication_disabled_until?: PublicMember["communication_disabled_until"];
    avatar_decoration_data?: PublicMember["avatar_decoration_data"];
    display_name_styles?: PublicMember["display_name_styles"];
    collectibles?: PublicMember["collectibles"];
    flags?: PublicMember["flags"];
    permissions?: string;
}

export interface ResolvedChannel {
    id: Snowflake;
    type: ChannelType;
    name?: PublicChannel["name"];
    permissions?: PublicChannel["permissions"];
    last_message_id?: PublicChannel["last_message_id"];
    last_pin_timestamp?: PublicChannel["last_pin_timestamp"];
    nsfw?: PublicChannel["nsfw"];
    parent_id?: PublicChannel["parent_id"];
    guild_id?: PublicChannel["guild_id"];
    flags?: PublicChannel["flags"];
    rate_limit_per_user?: PublicChannel["rate_limit_per_user"];
    topic?: PublicChannel["topic"];
    position?: PublicChannel["position"];
    thread_metadata?: ThreadMetadata;
}

export interface ResolvedData {
    users?: { [id: string]: PartialUser };
    members?: { [id: string]: ResolvedGuildMember };
    roles?: { [id: string]: PublicRole };
    channels?: { [id: string]: ResolvedChannel };
    messages?: { [id: string]: PartialMessage };
    attachments?: { [id: string]: PublicAttachment };
}
