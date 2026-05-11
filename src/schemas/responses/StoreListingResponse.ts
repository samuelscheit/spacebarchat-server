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
import type { StoreSkuLocalizedString, StoreSkuResponse } from "./StoreSkuResponse";

export interface StoreListingResponse {
    id: Snowflake;
    sku: StoreSkuResponse;
    child_skus?: StoreSkuResponse[];
    alternative_skus?: StoreSkuResponse[];
    summary: StoreSkuLocalizedString;
    description?: StoreSkuLocalizedString;
    tagline?: StoreSkuLocalizedString | null;
    flavor_text?: string | null;
    benefits?: object[] | null;
    published?: boolean;
    carousel_items?: object[] | null;
    staff_notes?: object;
    guild?: object | null;
    assets?: object[];
    thumbnail?: object;
    preview_video?: object;
    header_background?: object;
    header_logo_dark_theme?: object;
    header_logo_light_theme?: object;
    box_art?: object;
    hero_background?: object;
    hero_video?: object;
    entitlement_branch_id?: Snowflake | null;
    published_at?: string | null;
    unpublished_at?: string | null;
    powerup_metadata?: object;
}
