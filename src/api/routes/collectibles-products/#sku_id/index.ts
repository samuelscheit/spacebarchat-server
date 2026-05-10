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

import { route } from "@spacebar/api";
import type { CollectiblesCategory, CollectiblesCategoryProduct, CollectiblesProductResponse } from "@spacebar/schemas";
import { ApiError } from "@spacebar/util";
import { Request, Response, Router } from "express";

const emptyCollectiblesCatalog: readonly CollectiblesCategory[] = [];

export type CollectiblesProductCatalogProvider = () => readonly CollectiblesCategory[];

export const UNKNOWN_COLLECTIBLES_PRODUCT_ERROR = new ApiError("Unknown SKU", 10027, 404);

export function getCollectiblesProductCatalog(): readonly CollectiblesCategory[] {
    // Spacebar currently has no persisted collectible product backing.
    return emptyCollectiblesCatalog;
}

function findProductInProducts(skuId: string, products: readonly CollectiblesCategoryProduct[]): CollectiblesProductResponse | undefined {
    for (const product of products) {
        if (product.sku_id === skuId) return product;

        const variant = product.variants?.find((entry) => entry.sku_id === skuId);
        if (variant) return variant;
    }

    return undefined;
}

export function findCollectiblesProductBySku(skuId: string, categories: readonly CollectiblesCategory[]): CollectiblesProductResponse | undefined {
    for (const category of categories) {
        const product = findProductInProducts(skuId, category.products);
        if (product) return product;
    }

    return undefined;
}

export function createCollectiblesProductRouter(catalogProvider: CollectiblesProductCatalogProvider = getCollectiblesProductCatalog) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Collectibles Product",
            query: {
                country_code: {
                    type: "string",
                    description: "ISO 3166-1 alpha-2 country code used for localized pricing.",
                },
                include_bundles: {
                    type: "boolean",
                    description: "Whether to include bundle products.",
                },
                variants_return_style: {
                    type: "integer",
                    description: "Variant return style requested by the client.",
                },
            },
            responses: {
                200: {
                    body: "CollectiblesProductResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
                404: {
                    body: "APIErrorResponse",
                },
            },
        }),
        (req: Request, res: Response) => {
            const { sku_id } = req.params as { sku_id: string };
            const product = findCollectiblesProductBySku(sku_id, catalogProvider());

            if (!product) throw UNKNOWN_COLLECTIBLES_PRODUCT_ERROR;

            res.status(200).json(product);
        },
    );

    return router;
}

export default createCollectiblesProductRouter();
