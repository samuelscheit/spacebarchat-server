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
import type { StoreListingResponse } from "./StoreListingResponse";

export interface PartnerSdkApplicationStorefrontResponse {
    application_id: Snowflake;
    application?: object;
    title: string;
    logo_asset_id?: Snowflake | null;
    light_theme_logo_asset_id?: Snowflake | null;
    pages: PartnerSdkApplicationStorefrontPage[];
    store_listings: StoreListingResponse[];
    assets: PartnerSdkApplicationStorefrontAsset[];
}

export interface PartnerSdkApplicationStorefrontPage {
    title?: string;
    leaderboard?: PartnerSdkApplicationStorefrontLeaderboard;
    sku_ids: Snowflake[];
    sections?: PartnerSdkApplicationStorefrontPageSection[];
}

export interface PartnerSdkApplicationStorefrontLeaderboard {
    title?: string;
    description?: string;
    background_image_asset_id?: Snowflake;
}

export interface PartnerSdkApplicationStorefrontPageSection {
    title?: string;
    sku_ids: Snowflake[];
}

export interface PartnerSdkApplicationStorefrontAsset {
    id: Snowflake;
    application_id?: Snowflake;
    size: number;
    mime_type: string;
    filename?: string;
    width: number;
    height: number;
}
