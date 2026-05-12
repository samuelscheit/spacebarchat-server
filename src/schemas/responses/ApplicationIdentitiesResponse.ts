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

import type { UnfurledMediaItem } from "../api/messages/Components";
import type { Snowflake } from "../Identifiers";

export interface PartialApplicationIdentityResponse {
    user_id: Snowflake;
    external_user_id: string;
}

export type ApplicationIdentitiesResponse = PartialApplicationIdentityResponse[];

/**
 * Discord documents application profile playtime as a float.
 *
 * @TJS-type number
 */
export type UserApplicationIdentityFloat = number & {};

export interface UserApplicationIdentityProfilePrimaryDataResponse {
    season?: string;
    rank_name?: string;
    highest_rank?: string;
    featured_played_character?: string;
    featured_played_character_image?: UnfurledMediaItem;
    playtime_hours?: UserApplicationIdentityFloat;
    total_wins?: number;
    current_period_wins?: number;
    total_games?: number;
    current_period_games?: number;
    total_kills?: number;
    current_period_kills?: number;
    total_assists?: number;
    current_period_assists?: number;
    total_deaths?: number;
    current_period_deaths?: number;
    server_name?: string;
    user_id?: string;
    union_level?: string;
    total_resonators?: number;
    total_achievements?: number;
    total_echoes?: number;
    login_days?: number;
    data_bank_level?: string;
}

export interface UserApplicationIdentityProfileDataResponse {
    primary?: UserApplicationIdentityProfilePrimaryDataResponse;
}

export interface PartialUserApplicationProfileResponse {
    username: string | null;
    metadata: string | null;
    data?: UserApplicationIdentityProfileDataResponse;
    data_trusted?: boolean;
    connection_visible: boolean;
}

export interface UserApplicationProfileExternalIdResponse {
    provider_type: string;
    provider_issued_user_id: string;
    provider_id?: string | null;
    preferred_global_name?: string | null;
}

export interface UserApplicationProfileResponse {
    username: string | null;
    metadata: string | null;
    data?: UserApplicationIdentityProfileDataResponse | null;
    data_trusted?: boolean | null;
    external_id: UserApplicationProfileExternalIdResponse;
    avatar_hash: string | null;
}

export interface UserApplicationIdentityResponse {
    application_id: Snowflake;
    provider_issued_user_id: string;
    profile?: PartialUserApplicationProfileResponse;
    profiles?: PartialUserApplicationProfileResponse[];
}

export interface UserApplicationIdentitiesResponse {
    identities: UserApplicationIdentityResponse[];
}
