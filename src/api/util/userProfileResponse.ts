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

import type { PartialConnectedAccountResponse, UserProfileResponse } from "@spacebar/schemas";
import { profilePronouns } from "@spacebar/util";

type ProfileBadgeResponse = UserProfileResponse["badges"][number];

type UserProfileResponseProfile = UserProfileResponse["user_profile"];
type GuildMemberProfileResponse = NonNullable<UserProfileResponse["guild_member_profile"]>;

export interface UserProfileSource {
    bio: string | null;
    accent_color?: number | null;
    banner?: string | null;
    pronouns?: string | null;
    theme_colors?: (number | string)[] | null;
}

export interface UserProfileResponseOptions {
    hideBio?: boolean;
}

export interface GuildMemberProfileSource {
    banner?: string | null;
    bio?: string | null;
    guild_id: string;
}

export interface VisibleConnectedAccountSource {
    id: string;
    type: string;
    name: string;
    verified?: boolean | null;
    metadata_?: object | null;
    metadata_visibility?: number | null;
}

export interface ProfileBadgeSource {
    id: string;
    description: string;
    icon: string;
    link?: string | null;
}

export function toUserProfileResponse(source: UserProfileSource, options: UserProfileResponseOptions = {}): UserProfileResponseProfile {
    const response: UserProfileResponseProfile = {
        bio: options.hideBio ? null : source.bio,
        accent_color: source.accent_color,
        banner: source.banner,
        pronouns: profilePronouns(source.pronouns),
        theme_colors: source.theme_colors?.map((themeColor) => Number(themeColor)),
    };

    return response;
}

export function toGuildMemberProfileResponse(source: GuildMemberProfileSource): GuildMemberProfileResponse {
    return {
        accent_color: null,
        banner: source.banner || null,
        bio: source.bio || "",
        guild_id: source.guild_id,
    };
}

export function toPartialConnectedAccountResponse(source: VisibleConnectedAccountSource): PartialConnectedAccountResponse {
    const response: PartialConnectedAccountResponse = {
        id: source.id,
        type: source.type,
        name: source.name,
        verified: source.verified ?? false,
    };

    if ((source.metadata_visibility ?? 0) !== 0 && source.metadata_ != null) {
        response.metadata = source.metadata_;
    }

    return response;
}

export function toProfileBadgeResponse(source: ProfileBadgeSource): ProfileBadgeResponse {
    const response: ProfileBadgeResponse = {
        id: source.id,
        description: source.description,
        icon: source.icon,
    };

    if (source.link != null) {
        response.link = source.link;
    }

    return response;
}
