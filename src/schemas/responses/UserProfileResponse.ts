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

import { PartialConnectedAccountResponse, PublicMember, PublicUser } from "@spacebar/schemas";

export type MutualGuild = {
    id: string;
    nick?: string | null;
};

export interface PublicMemberProfile {
    accent_color: number | null;
    banner: string | null;
    bio: string;
    guild_id: string;
}

export interface UserProfile {
    bio: string | null;
    accent_color?: number | null;
    banner?: string | null;
    pronouns?: string | null;
    theme_colors?: number[] | null;
}

export interface ProfileBadge {
    id: string;
    description: string;
    icon: string;
    link?: string;
}

export interface UserProfileResponse {
    user: PublicUser;
    connected_accounts: PartialConnectedAccountResponse[];
    premium_guild_since?: number | null;
    premium_since?: Date | null;
    mutual_guilds?: MutualGuild[];
    mutual_friends?: PublicUser[];
    mutual_friends_count?: number;
    premium_type: number;
    profile_themes_experiment_bucket: number;
    user_profile: UserProfile;
    guild_member?: PublicMember;
    guild_member_profile?: PublicMemberProfile;
    badges: ProfileBadge[];
    guild_badges: ProfileBadge[];
}
