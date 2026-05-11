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

export interface StorefrontProductResponse {
    id: Snowflake;
    application_id: Snowflake;
    sku_ids: Snowflake[];
    skus: StorefrontProductSku[];
    name: string;
    options: StorefrontProductOption[];
    created_at: string;
    updated_at: string;
    tenant_metadata: StorefrontProductTenantMetadata;
}

export interface StorefrontProductSku {
    id: Snowflake;
    type: number;
    product_line: number;
    application_id: Snowflake;
    name: string;
    thumbnail_asset_id?: Snowflake | null;
    slug: string;
    premium: boolean;
    selected_options: StorefrontProductSkuOption[];
    product_id: Snowflake;
    position: number;
    tenant_metadata: StorefrontProductSkuTenantMetadata;
}

export interface StorefrontProductSkuOption {
    option_name: string;
    option_value: string;
}

export interface StorefrontProductSkuTenantMetadata {
    boost_price: number;
    purchase_limit: number;
    category_type: string;
    plan_features: StorefrontProductSkuPlanFeature[];
}

export interface StorefrontProductSkuPlanFeature {
    title: string;
    description: string;
}

export interface StorefrontProductOption {
    name: string;
    option_values: string[];
}

export interface StorefrontProductTenantMetadata {
    guild_monetization?: StorefrontGuildMonetizationProductMetadata;
}

export interface StorefrontGuildMonetizationProductMetadata {
    game_server?: StorefrontGameServerPowerupProductMetadata;
}

export interface StorefrontGameServerPowerupProductMetadata {
    instructions: StorefrontGameServerInstructions;
    deactivation_cooldown_period_days: number;
    game_application_id: Snowflake;
    provider: string;
    disabled: boolean;
    early_access: boolean;
    can_market: boolean;
}

export interface StorefrontGameServerInstructions {
    pc: string[];
}
