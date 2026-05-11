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
import type { StorefrontProductsBySkuResponse } from "@spacebar/schemas";
import { DiscordApiErrors } from "@spacebar/util";
import { Router as createRouter, type Request, type Response, type Router } from "express";
import { isStorefrontProductId, storefrontProductIncludesSku, toStorefrontProductResponse, type StorefrontProductSource } from "../../../util/utility/StorefrontProductRoute";

export { toStorefrontProductResponse, type StorefrontProductSource } from "../../../util/utility/StorefrontProductRoute";

const maxStorefrontProductSkuIds = 100;
const emptyStorefrontProducts: readonly StorefrontProductSource[] = [];

export interface StorefrontProductsBySkuQueryOptions {
    sku_ids: string[];
}

export type StorefrontProductsBySkuProvider = (options: StorefrontProductsBySkuQueryOptions) => readonly StorefrontProductSource[] | Promise<readonly StorefrontProductSource[]>;

function queryValues(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap(queryValues);
    if (typeof value !== "string") return [];

    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

function requiredStorefrontProductSkuIds(values: string[]): string[] {
    if (values.length === 0 || values.length > maxStorefrontProductSkuIds) throw DiscordApiErrors.INVALID_FORM_BODY;

    for (const value of values) {
        if (!isStorefrontProductId(value)) throw DiscordApiErrors.INVALID_FORM_BODY;
    }

    return [...new Set(values)];
}

export function parseStorefrontProductsBySkuQuery(query: Request["query"]): StorefrontProductsBySkuQueryOptions {
    return {
        sku_ids: requiredStorefrontProductSkuIds([...queryValues(query.sku_ids), ...queryValues(query["sku_ids[]"])]),
    };
}

export function getConfiguredStorefrontProductsBySku(_options: StorefrontProductsBySkuQueryOptions): readonly StorefrontProductSource[] {
    // Spacebar does not currently persist Discord storefront product or SKU catalogs.
    return emptyStorefrontProducts;
}

export function toStorefrontProductsBySkuResponse(products: readonly StorefrontProductSource[], skuIds: readonly string[]): StorefrontProductsBySkuResponse {
    const requestedSkuIds = [...new Set(skuIds)];
    const seenProductIds = new Set<string>();

    return {
        products: products.flatMap((product) => {
            if (seenProductIds.has(product.id)) return [];
            if (!requestedSkuIds.some((skuId) => storefrontProductIncludesSku(product, skuId))) return [];

            seenProductIds.add(product.id);
            return [toStorefrontProductResponse(product)];
        }),
    };
}

export async function getStorefrontProductsBySku(
    options: StorefrontProductsBySkuQueryOptions,
    productProvider: StorefrontProductsBySkuProvider = getConfiguredStorefrontProductsBySku,
): Promise<StorefrontProductsBySkuResponse> {
    const products = await productProvider(options);

    return toStorefrontProductsBySkuResponse(products, options.sku_ids);
}

export function createStorefrontProductsBySkuRouter(productProvider: StorefrontProductsBySkuProvider = getConfiguredStorefrontProductsBySku) {
    const router: Router = createRouter({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Storefront Products By SKU ID",
            description: "Returns locally backed storefront product objects associated with the requested SKU IDs.",
            query: {
                sku_ids: {
                    type: "array",
                    required: true,
                    description: "SKU IDs to retrieve storefront products for (1-100).",
                },
            },
            responses: {
                200: {
                    body: "StorefrontProductsBySkuResponse",
                },
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const options = parseStorefrontProductsBySkuQuery(req.query);
            const products = await getStorefrontProductsBySku(options, productProvider);

            return res.status(200).json(products);
        },
    );

    return router;
}

export default createStorefrontProductsBySkuRouter();
