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

import { ChannelType } from "@spacebar/schemas";
import { ChannelBaseModifySchema } from "./ChannelModifySchema";

type GuildChannelCreateType =
    | ChannelType.GUILD_TEXT
    | ChannelType.GUILD_VOICE
    | ChannelType.GUILD_CATEGORY
    | ChannelType.GUILD_NEWS
    | ChannelType.GUILD_STORE
    | ChannelType.GUILD_LFG
    | ChannelType.LFG_GROUP_DM
    | ChannelType.THREAD_ALPHA
    | ChannelType.GUILD_STAGE_VOICE
    | ChannelType.GUILD_DIRECTORY
    | ChannelType.GUILD_FORUM
    | ChannelType.GUILD_MEDIA
    | ChannelType.LOBBY
    | ChannelType.EPHEMERAL_DM
    | ChannelType.UNHANDLED;

export interface ChannelCreateSchema extends Omit<ChannelBaseModifySchema, "available_tags" | "status"> {
    type?: GuildChannelCreateType;
}
