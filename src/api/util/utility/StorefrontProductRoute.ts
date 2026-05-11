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

import type {
    StorefrontGameServerPowerupProductMetadata,
    StorefrontProductOption,
    StorefrontProductResponse,
    StorefrontProductSku,
    StorefrontProductSkuOption,
    StorefrontProductSkuPlanFeature,
    StorefrontProductSkuTenantMetadata,
    StorefrontProductTenantMetadata,
} from "@spacebar/schemas";
import { ApiError } from "@spacebar/util";

const routeSnowflakePattern = /^[1-9]\d{16,19}$/;

export interface StorefrontProductProviderOptions {
    product_id: string;
}

export type StorefrontProductSource = StorefrontProductResponse;
export type StorefrontProductProvider = (options: StorefrontProductProviderOptions) => StorefrontProductSource | undefined | Promise<StorefrontProductSource | undefined>;

export const UNKNOWN_STOREFRONT_PRODUCT_ERROR = new ApiError("Unknown Product", 10987, 404);

export function isStorefrontProductId(value: string) {
    return routeSnowflakePattern.test(value);
}

export function getConfiguredStorefrontProduct(_options: StorefrontProductProviderOptions): StorefrontProductResponse | undefined {
    // Spacebar does not currently persist Discord storefront product catalogs.
    return undefined;
}

export function storefrontProductIncludesSku(product: StorefrontProductSource, skuId: string) {
    return product.sku_ids.includes(skuId) || product.skus.some((sku) => sku.id === skuId);
}

function cloneProductOption(option: StorefrontProductOption): StorefrontProductOption {
    return {
        name: option.name,
        option_values: [...option.option_values],
    };
}

function cloneProductSkuOption(option: StorefrontProductSkuOption): StorefrontProductSkuOption {
    return {
        option_name: option.option_name,
        option_value: option.option_value,
    };
}

function cloneProductSkuPlanFeature(feature: StorefrontProductSkuPlanFeature): StorefrontProductSkuPlanFeature {
    return {
        title: feature.title,
        description: feature.description,
    };
}

function cloneProductSkuTenantMetadata(metadata: StorefrontProductSkuTenantMetadata): StorefrontProductSkuTenantMetadata {
    return {
        boost_price: metadata.boost_price,
        purchase_limit: metadata.purchase_limit,
        category_type: metadata.category_type,
        plan_features: metadata.plan_features.map(cloneProductSkuPlanFeature),
    };
}

function cloneProductSku(sku: StorefrontProductSku): StorefrontProductSku {
    const cloned: StorefrontProductSku = {
        id: sku.id,
        type: sku.type,
        product_line: sku.product_line,
        application_id: sku.application_id,
        name: sku.name,
        slug: sku.slug,
        premium: sku.premium,
        selected_options: sku.selected_options.map(cloneProductSkuOption),
        product_id: sku.product_id,
        position: sku.position,
        tenant_metadata: cloneProductSkuTenantMetadata(sku.tenant_metadata),
    };

    if (sku.thumbnail_asset_id !== undefined) cloned.thumbnail_asset_id = sku.thumbnail_asset_id;

    return cloned;
}

function cloneGameServerMetadata(metadata: StorefrontGameServerPowerupProductMetadata): StorefrontGameServerPowerupProductMetadata {
    return {
        instructions: {
            pc: [...metadata.instructions.pc],
        },
        deactivation_cooldown_period_days: metadata.deactivation_cooldown_period_days,
        game_application_id: metadata.game_application_id,
        provider: metadata.provider,
        disabled: metadata.disabled,
        early_access: metadata.early_access,
        can_market: metadata.can_market,
    };
}

function cloneTenantMetadata(metadata: StorefrontProductTenantMetadata): StorefrontProductTenantMetadata {
    const cloned: StorefrontProductTenantMetadata = {};

    if (metadata.guild_monetization !== undefined) {
        cloned.guild_monetization = {};

        if (metadata.guild_monetization.game_server !== undefined) {
            cloned.guild_monetization.game_server = cloneGameServerMetadata(metadata.guild_monetization.game_server);
        }
    }

    return cloned;
}

export function toStorefrontProductResponse(product: StorefrontProductSource): StorefrontProductResponse {
    return {
        id: product.id,
        application_id: product.application_id,
        sku_ids: [...product.sku_ids],
        skus: product.skus.map(cloneProductSku),
        name: product.name,
        options: product.options.map(cloneProductOption),
        created_at: product.created_at,
        updated_at: product.updated_at,
        tenant_metadata: cloneTenantMetadata(product.tenant_metadata),
    };
}

export async function getStorefrontProduct(productId: string, productProvider: StorefrontProductProvider = getConfiguredStorefrontProduct): Promise<StorefrontProductResponse> {
    if (!isStorefrontProductId(productId)) throw UNKNOWN_STOREFRONT_PRODUCT_ERROR;

    const product = await productProvider({ product_id: productId });
    if (!product) throw UNKNOWN_STOREFRONT_PRODUCT_ERROR;

    return toStorefrontProductResponse(product);
}
