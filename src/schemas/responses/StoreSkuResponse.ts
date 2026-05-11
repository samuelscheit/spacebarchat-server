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

export type StoreSkuLocalizedString = string | object;

export interface StoreSkuResponse {
    id: Snowflake;
    type: number;
    application_id: Snowflake;
    application?: object;
    product_line: number | null;
    product_id?: Snowflake;
    flags: number;
    name: StoreSkuLocalizedString;
    summary?: StoreSkuLocalizedString;
    description?: StoreSkuLocalizedString;
    legal_notice?: StoreSkuLocalizedString;
    slug: string;
    thumbnail_asset_id?: Snowflake;
    dependent_sku_id?: Snowflake | null;
    bundled_skus?: StoreSkuResponse[];
    bundled_sku_ids?: Snowflake[];
    access_type: number;
    manifest_labels?: Snowflake[] | null;
    features: number[];
    locales?: string[];
    genres?: number[];
    available_regions?: string[];
    content_rating?: object;
    content_rating_agency?: number;
    content_ratings?: object;
    system_requirements?: object;
    price?: object;
    price_tier?: number;
    sale_price_tier?: number;
    sale_price?: object;
    created_at?: string;
    updated_at?: string;
    release_date?: string | null;
    preorder_approximate_release_date?: string;
    preorder_released_at?: string;
    external_purchase_url?: string;
    external_sku_strategies?: object;
    eligible_payment_gateways?: number[];
    premium: boolean;
    show_age_gate: boolean;
    restricted?: boolean;
    exclusive?: boolean;
    deleted?: boolean;
    tenant_metadata?: object;
    powerup_metadata?: object;
    orbs_reward?: number;
}
