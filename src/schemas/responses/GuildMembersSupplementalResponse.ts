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

export enum GuildMemberJoinSourceType {
    Unspecified = 0,
    Bot = 1,
    Integration = 2,
    Discovery = 3,
    Hub = 4,
    Invite = 5,
    VanityUrl = 6,
    ManualMemberVerification = 7,
    SocialLayerIntegrationLinkedChannel = 8,
}

export interface GuildMemberSupplemental {
    user_id: Snowflake;
    join_source_type: GuildMemberJoinSourceType;
    source_invite_code?: string | null;
    inviter_id?: Snowflake | null;
    integration_type?: string | null;
}

export type GuildMembersSupplementalResponse = GuildMemberSupplemental[];
