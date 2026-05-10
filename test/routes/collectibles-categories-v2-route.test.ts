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
import type { CollectiblesCategory } from "@spacebar/schemas";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../src/api/middlewares";
import {
    createCollectiblesCategoriesV2Router,
    getCollectiblesCategoriesV2Catalog,
    parseCollectiblesCategoriesV2Query,
    type CollectiblesCategoriesV2CatalogProvider,
    type CollectiblesCategoriesV2QueryOptions,
} from "../../src/api/routes/collectibles-categories/v2";

const coveredManifestIds = ["api:http:GET:/collectibles-categories/v2/"];

function category(): CollectiblesCategory {
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
    };
}

function createApp(catalogProvider?: CollectiblesCategoriesV2CatalogProvider) {
    const app = express();
    app.use("/collectibles-categories/v2", createCollectiblesCategoriesV2Router(catalogProvider));
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp() {
    const app = express();
    app.use(Authentication);
    app.use("/collectibles-categories/v2", createCollectiblesCategoriesV2Router());
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

describe("GET /collectibles-categories/v2", () => {
    test("documents the assigned manifest id and stays behind bearer auth", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/collectibles-categories/v2/"]);
        assert.equal(isNoAuthorizationRoute("GET", "/collectibles-categories/v2?country_code=US"), false);

        const response = await requestJson(createAuthenticatedApp(), "/collectibles-categories/v2");

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("parses documented query fields and returns provided categories in the V2 wrapper", async () => {
        const categories = [category()];
        let receivedOptions: CollectiblesCategoriesV2QueryOptions | undefined;
        const app = createApp((options) => {
            receivedOptions = options;
            return categories;
        });

        const response = await requestJson(
            app,
            "/collectibles-categories/v2?country_code=US&include_bundles=true&include_nameplates_on_mobile=false&include_unpublished=true&no_cache=false&payment_gateway=6&skip_num_categories=2&variants_return_style=1",
        );

        assert.equal(response.status, 200);
        assert.deepEqual(receivedOptions, {
            country_code: "US",
            include_bundles: true,
            include_nameplates_on_mobile: false,
            include_unpublished: true,
            no_cache: false,
            payment_gateway: 6,
            skip_num_categories: 2,
            variants_return_style: 1,
        });
        assert.deepEqual(response.body, { categories });
    });

    test("returns an empty source-compatible catalog without fabricating discounts or products", async () => {
        assert.deepEqual(getCollectiblesCategoriesV2Catalog(), []);
        assert.deepEqual(
            parseCollectiblesCategoriesV2Query({
                include_bundles: "invalid",
                payment_gateway: "1.5",
            } as never),
            {
                country_code: undefined,
                include_bundles: undefined,
                include_nameplates_on_mobile: undefined,
                include_unpublished: undefined,
                no_cache: undefined,
                payment_gateway: undefined,
                skip_num_categories: undefined,
                variants_return_style: undefined,
            },
        );

        const response = await requestJson(createApp(), "/collectibles-categories/v2?include_bundles=true");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, { categories: [] });
        assert.equal(Object.hasOwn(response.body as Record<string, unknown>, "user_discounts"), false);
    });
});
