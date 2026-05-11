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
import type { StorefrontProductResponse } from "@spacebar/schemas";
import { Router as createRouter, type Request, type Response, type Router } from "express";
import {
    isStorefrontProductId,
    toStorefrontProductResponse,
    UNKNOWN_STOREFRONT_PRODUCT_ERROR,
    type StorefrontProductSource,
} from "../../../../util/utility/StorefrontProductRoute";

export { toStorefrontProductResponse, UNKNOWN_STOREFRONT_PRODUCT_ERROR, type StorefrontProductSource } from "../../../../util/utility/StorefrontProductRoute";

export interface StorefrontProductBySkuProviderOptions {
    sku_id: string;
}

export type StorefrontProductBySkuProvider = (options: StorefrontProductBySkuProviderOptions) => StorefrontProductSource | undefined | Promise<StorefrontProductSource | undefined>;

export function isStorefrontProductSkuId(value: string) {
    return isStorefrontProductId(value);
}

export function getConfiguredStorefrontProductBySku(_options: StorefrontProductBySkuProviderOptions): StorefrontProductResponse | undefined {
    // Spacebar does not currently persist Discord storefront product or SKU catalogs.
    return undefined;
}

function storefrontProductIncludesSku(product: StorefrontProductSource, skuId: string) {
    return product.sku_ids.includes(skuId) || product.skus.some((sku) => sku.id === skuId);
}

export async function getStorefrontProductBySku(
    skuId: string,
    productProvider: StorefrontProductBySkuProvider = getConfiguredStorefrontProductBySku,
): Promise<StorefrontProductResponse> {
    if (!isStorefrontProductSkuId(skuId)) throw UNKNOWN_STOREFRONT_PRODUCT_ERROR;

    const product = await productProvider({ sku_id: skuId });
    if (!product || !storefrontProductIncludesSku(product, skuId)) throw UNKNOWN_STOREFRONT_PRODUCT_ERROR;

    return toStorefrontProductResponse(product);
}

export function createStorefrontProductBySkuRouter(productProvider: StorefrontProductBySkuProvider = getConfiguredStorefrontProductBySku) {
    const router: Router = createRouter({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Storefront Product By SKU ID",
            description: "Returns the locally backed storefront product object associated with the given SKU ID.",
            responses: {
                200: {
                    body: "StorefrontProductResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
                404: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const product = await getStorefrontProductBySku(req.params.sku_id as string, productProvider);

            return res.status(200).json(product);
        },
    );

    return router;
}

export default createStorefrontProductBySkuRouter();
