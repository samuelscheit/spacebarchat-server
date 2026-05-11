/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2025 Spacebar and Spacebar Contributors

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

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { ajv } from "../Validator";

const assetsPath = path.join(process.cwd(), "assets");

interface JsonShape {
    $ref?: string;
    additionalProperties?: boolean | JsonShape;
    items?: JsonShape;
    properties?: Record<string, JsonShape>;
    required?: string[];
    type?: string | string[];
}

function readAssetJson<T>(name: string): T {
    return JSON.parse(fs.readFileSync(path.join(assetsPath, name), "utf8")) as T;
}

function assertCollectiblesDefinitionsUseScopedNames(schemas: Record<string, JsonShape>, refPrefix: string) {
    assert.equal(schemas.CollectiblesCategoriesResponse.items?.$ref, `${refPrefix}CollectiblesCategory`);
    assert.equal(schemas.CollectiblesCategoriesV2Response.properties?.categories?.items?.$ref, `${refPrefix}CollectiblesCategory`);
    assert.equal(schemas.CollectiblesCategoriesV2Response.properties?.user_discounts?.items?.$ref, `${refPrefix}CollectiblesUserDiscount`);
    assert.equal(schemas.CollectiblesShopResponse.properties?.categories?.items?.$ref, `${refPrefix}CollectiblesCategory`);
    assert.equal(schemas.CollectiblesSearchResponse.properties?.pagination?.$ref, `${refPrefix}CollectiblesSearchPagination`);
    assert.equal(schemas.CollectiblesGiftRecipientEligibilityResponse.properties?.valid?.type, "boolean");
    assert.equal(schemas.CollectiblesCategory.properties?.banner_asset?.$ref, `${refPrefix}CollectiblesStaticAnimatedAsset`);
    assert.equal(schemas.CollectiblesCategoryProduct.properties?.items?.items?.$ref, `${refPrefix}CollectiblesProductItem`);
    assert.equal(schemas.CollectiblesCategoryProduct.properties?.variants?.items?.$ref, `${refPrefix}CollectiblesProductVariant`);
    assert.equal(
        schemas.CollectiblesCategoryProduct.properties?.prices?.additionalProperties &&
            typeof schemas.CollectiblesCategoryProduct.properties.prices.additionalProperties !== "boolean"
            ? schemas.CollectiblesCategoryProduct.properties.prices.additionalProperties.properties?.country_prices?.$ref
            : undefined,
        `${refPrefix}CollectiblesCountryPrice`,
    );
    assert.equal(schemas.CollectiblesCountryPrice.properties?.prices?.items?.$ref, `${refPrefix}CollectiblesPriceEntry`);

    assert.ok(schemas.CollectiblesCategory);
    assert.ok(schemas.CollectiblesCategoryProduct);
    assert.ok(schemas.CollectiblesProductItem);
    assert.ok(schemas.CollectiblesProductVariant);
    assert.ok(schemas.CollectiblesUserDiscount);
    assert.ok(schemas.CollectiblesSearchResponse);
    assert.ok(schemas.CollectiblesSearchPagination);
    assert.ok(schemas.CollectiblesGiftRecipientEligibilityResponse);
    assert.ok(schemas.CollectiblesStaticAnimatedAsset);
    assert.ok(schemas.CollectiblesCountryPrice);
    assert.ok(schemas.CollectiblesPriceEntry);
    assert.deepEqual(schemas.CollectiblesCategoryProduct.properties?.google_sku_ids, {
        type: "object",
        additionalProperties: { type: "string" },
    });

    assert.equal(schemas.ProductItem, undefined);
    assert.equal(schemas.ProductItemVariant, undefined);
    assert.equal(schemas.StaticAnimatedAsset, undefined);
    assert.equal(schemas.CountryPrice, undefined);
    assert.equal(schemas.PriceEntry, undefined);
}

test("CollectiblesCategoriesResponse uses collectibles-scoped schema definitions", () => {
    const schemas = readAssetJson<Record<string, JsonShape>>("schemas.json");

    assertCollectiblesDefinitionsUseScopedNames(schemas, "#/definitions/");
});

test("CollectiblesCategoriesResponse uses collectibles-scoped OpenAPI definitions", () => {
    const openapi = readAssetJson<{
        components: { schemas: Record<string, JsonShape> };
    }>("openapi.json");

    assertCollectiblesDefinitionsUseScopedNames(openapi.components.schemas, "#/components/schemas/");
});

test("CollectiblesCategoriesResponse validates collectible categories", () => {
    const response = [
        {
            sku_id: "category-sku",
            name: "Spring drops",
            summary: "Seasonal profile collectibles",
            store_listing_id: "category-listing",
            banner: "banner-asset",
            unpublished_at: null,
            styles: {
                background_colors: [16777215],
                button_colors: [0],
                confetti_colors: [255],
            },
            logo: "logo-asset",
            hero_ranking: ["product-sku"],
            mobile_bg: null,
            pdp_bg: null,
            success_modal_bg: null,
            mobile_banner: null,
            featured_block: null,
            hero_banner: null,
            wide_banner: null,
            hero_logo: null,
            products: [
                {
                    sku_id: "product-sku",
                    name: "Profile effect",
                    summary: "A profile effect",
                    store_listing_id: "product-listing",
                    banner: "product-banner",
                    unpublished_at: null,
                    styles: {
                        background_colors: [16777215],
                        button_colors: [0],
                        confetti_colors: [255],
                    },
                    prices: {
                        usd: {
                            country_prices: {
                                country_code: "US",
                                prices: [{ amount: 499, currency: "USD", exponent: 2 }],
                            },
                        },
                    },
                    items: [{ type: 0, id: "asset-id", sku_id: "product-sku" }],
                    type: 0,
                    premium_type: 0,
                    category_sku_id: "category-sku",
                    google_sku_ids: {
                        us: "google-sku",
                    },
                },
            ],
        },
    ];

    assert.equal(ajv.validate("CollectiblesCategoriesResponse", response), true);
    assert.equal(ajv.validate("CollectiblesCategoriesResponse", [{ ...response[0], internal_field: true }]), false);
});

test("CollectiblesCategoriesV2Response validates category wrappers and optional user discounts", () => {
    const response = {
        categories: [
            {
                sku_id: "category-sku",
                name: "Spring drops",
                summary: "Seasonal profile collectibles",
                store_listing_id: "category-listing",
                banner: "banner-asset",
                unpublished_at: null,
                styles: {
                    background_colors: [16777215],
                    button_colors: [0],
                    confetti_colors: [255],
                },
                logo: "logo-asset",
                hero_ranking: [],
                mobile_bg: null,
                pdp_bg: null,
                success_modal_bg: null,
                mobile_banner: null,
                featured_block: null,
                hero_banner: null,
                wide_banner: null,
                hero_logo: null,
                products: [],
            },
        ],
        user_discounts: [
            {
                amount: 10,
                discount_id: "123456789012345678",
                expires_at: null,
            },
        ],
    };

    assert.equal(ajv.validate("CollectiblesCategoriesV2Response", response), true);
    assert.equal(ajv.validate("CollectiblesCategoriesV2Response", { ...response, user_discounts: [{ ...response.user_discounts[0], internal_field: true }] }), false);
});

test("CollectiblesSearchResponse validates SKU search pagination wrappers", () => {
    const response = {
        pagination: {
            offset: 0,
            limit: 20,
            total: 1,
            has_more: false,
        },
        skus: ["123456789012345678"],
    };

    assert.equal(ajv.validate("CollectiblesSearchResponse", response), true);
    assert.equal(ajv.validate("CollectiblesSearchResponse", { ...response, internal_field: true }), false);
});

test("CollectiblesGiftRecipientEligibilityResponse validates gift eligibility wrappers", () => {
    assert.equal(ajv.validate("CollectiblesGiftRecipientEligibilityResponse", { valid: false }), true);
    assert.equal(ajv.validate("CollectiblesGiftRecipientEligibilityResponse", { valid: false, internal_field: true }), false);
    assert.equal(ajv.validate("CollectiblesGiftRecipientEligibilityResponse", {}), false);
});
