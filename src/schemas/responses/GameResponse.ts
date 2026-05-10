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

export interface GameExecutable {
    os: string;
    name: string;
    is_launcher: boolean;
}

export interface GameLinkedApplication {
    id: Snowflake;
    type: number;
}

export interface GameWebsite {
    url: string;
    category: number;
}

export interface GameCompany {
    name: string;
    roles: number[];
}

export interface GameStoreAsset {
    id?: Snowflake;
    type?: number;
    mime_type?: string;
    width?: number;
    height?: number;
    size?: number;
    url?: string;
    proxy_url?: string;
}

export interface GameDataSteamReviews {
    rating?: number;
    rating_count?: number;
    recent_rating?: number;
    recent_rating_count?: number;
    localized_rating?: number;
    localized_rating_count?: number;
}

export interface GameDataOpenCriticReviews {
    top_critic_rating?: number | null;
    top_critic_rating_count?: number | null;
    tier?: number | null;
}

export interface GameDataReviews {
    steam?: GameDataSteamReviews;
    opencritic?: GameDataOpenCriticReviews;
}

export interface GameSupplementalData {
    application_id: Snowflake;
    igdb_game_id?: string | null;
    name: string;
    summary?: string | null;
    summary_localized?: string | null;
    websites?: GameWebsite[];
    themes?: number[];
    genres?: number[];
    platforms?: number[];
    artwork_urls?: string[];
    screenshot_urls?: string[];
    icon_hash?: string | null;
    cover_image_url?: string | null;
    first_release_date?: string | null;
    publisher_names?: string[];
    developer_names?: string[];
    trailers?: GameStoreAsset[];
    shop_collection_ids?: Snowflake[];
    steam_release_status?: number;
    reviews?: GameDataReviews;
    opencritic_url?: string;
    steam_id?: string;
    announcements_channel_id?: Snowflake;
    l30_rank?: number;
    game_flags?: number;
}

export interface GameResponse {
    id: Snowflake;
    name: string;
    icon_hash?: string | null;
    cover_image_hash?: string | null;
    aliases: string[];
    executables: GameExecutable[];
    themes: string[];
    hook: boolean;
    overlay: boolean;
    overlay_methods: number | null;
    overlay_warn: boolean;
    overlay_compatibility_hook: boolean;
    linked_applications?: GameLinkedApplication[];
    supplemental_game_data?: GameSupplementalData;
    genres?: number[];
    platforms?: number[];
    websites?: GameWebsite[];
    companies: GameCompany[];
    screenshot_hashes?: string[];
    screenshot_urls?: string[];
    trailers?: GameStoreAsset[];
    l30_rank?: number;
}
