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

import type { ConfigValue } from "../../util/config/Config";

export interface PublicInstanceConfigResponse {
    limits_user_maxGuilds: number;
    limits_user_maxBio: number;
    limits_guild_maxEmojis: number;
    limits_guild_maxRoles: number;
    limits_message_maxCharacters: number;
    limits_message_maxAttachmentSize: number;
    limits_message_maxEmbedDownloadSize: number;
    limits_channel_maxWebhooks: number;
    register_dateOfBirth_requiredc: boolean;
    register_password_required: boolean;
    register_disabled: boolean;
    register_requireInvite: boolean;
    register_allowNewRegistration: boolean;
    register_allowMultipleAccounts: boolean;
    guild_autoJoin_canLeave: boolean;
    guild_autoJoin_guilds_x: string[];
    register_email_required: boolean;
    can_recover_account: boolean;
}

export type FullInstanceConfigResponse = ConfigValue;

export type InstanceConfigResponse = PublicInstanceConfigResponse | FullInstanceConfigResponse;
