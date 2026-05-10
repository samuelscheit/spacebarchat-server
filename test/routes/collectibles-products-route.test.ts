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

import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { describe, test } from "node:test";
import express from "express";
import type { CollectiblesCategory, CollectiblesCategoryProduct } from "@spacebar/schemas";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../src/api/middlewares";
import {
    createCollectiblesProductRouter,
    findCollectiblesProductBySku,
    getCollectiblesProductCatalog,
    UNKNOWN_COLLECTIBLES_PRODUCT_ERROR,
} from "../../src/api/routes/collectibles-products/#sku_id";

const coveredManifestIds = ["api:http:GET:/collectibles-products/:sku_id/"];

function product(overrides: Partial<CollectiblesCategoryProduct> = {}): CollectiblesCategoryProduct {
    return {
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
        items: [{ type: 1, id: "item-id", sku_id: "product-sku" }],
        type: 1,
        premium_type: 0,
        category_sku_id: "category-sku",
        google_sku_ids: {
            "1": "google-sku",
        },
        ...overrides,
    };
}

function category(products: CollectiblesCategoryProduct[]): CollectiblesCategory {
    return {
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
        products,
    };
}

function createApp(categories: readonly CollectiblesCategory[]) {
    const app = express();
    app.use(
        "/:sku_id",
        createCollectiblesProductRouter(() => categories),
    );
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp() {
    const app = express();
    app.use(Authentication);
    app.use("/:sku_id", createCollectiblesProductRouter());
    app.use(ErrorHandler);

    return app;
}

async function requestJson(app: express.Express, path: string) {
    const server = app.listen(0);

    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${path}`);

        return {
            status: response.status,
            body: (await response.json()) as unknown,
        };
    } finally {
        server.close();
    }
}

describe("GET /collectibles-products/:sku_id", () => {
    test("documents the assigned manifest id and stays behind bearer auth", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/collectibles-products/:sku_id/"]);
        assert.equal(isNoAuthorizationRoute("GET", "/collectibles-products/product-sku"), false);

        const response = await requestJson(createAuthenticatedApp(), "/product-sku");

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("resolves collectible products and variants by SKU from the provided catalog", async () => {
        const baseProduct = product({
            variants: [
                {
                    sku_id: "variant-sku",
                    name: "Variant",
                    name_localizations: null,
                    summary: "A color variant",
                    summary_localizations: null,
                    store_listing_id: "variant-listing",
                    prices: {},
                    items: [{ type: 1, id: "variant-item-id", sku_id: "variant-sku" }],
                    type: 1,
                    premium_type: 0,
                    category_sku_id: "category-sku",
                    base_variant_sku_id: "product-sku",
                    base_variant_name: "Profile effect",
                    variant_label: "Color",
                    variant_value: "#ffffff",
                },
            ],
        });
        const categories = [category([baseProduct])];

        assert.equal(findCollectiblesProductBySku("product-sku", categories), baseProduct);
        assert.equal(findCollectiblesProductBySku("variant-sku", categories), baseProduct.variants?.[0]);

        const response = await requestJson(createApp(categories), "/variant-sku");

        assert.equal(response.status, 200);
        assert.equal((response.body as { sku_id?: string }).sku_id, "variant-sku");
    });

    test("returns source-compatible unknown SKU errors without fabricating product data", async () => {
        assert.deepEqual(getCollectiblesProductCatalog(), []);
        assert.equal(UNKNOWN_COLLECTIBLES_PRODUCT_ERROR.httpStatus, 404);
        assert.equal(UNKNOWN_COLLECTIBLES_PRODUCT_ERROR.code, 10027);

        const response = await requestJson(createApp([]), "/missing-sku");

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: 10027,
            message: "Unknown SKU",
        });
    });
});
