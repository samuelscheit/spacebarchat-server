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
import type { StoreConsumableSkuPricingResponse, StoreSkuPriceResponse } from "@spacebar/schemas";
import { Router as createRouter, type Request, type Response, type Router } from "express";
import { isStoreSkuRouteSnowflake, UNKNOWN_STORE_SKU_ERROR } from "../../../../util/utility/StoreSkuRoute";

export { UNKNOWN_STORE_SKU_ERROR } from "../../../../util/utility/StoreSkuRoute";

export interface StoreConsumableSkuPricingProviderOptions {
    sku_id: string;
}

export type StoreConsumableSkuPricingSource = StoreConsumableSkuPricingResponse;
export type StoreConsumableSkuPricingProvider = (
    options: StoreConsumableSkuPricingProviderOptions,
) => StoreConsumableSkuPricingSource | undefined | Promise<StoreConsumableSkuPricingSource | undefined>;

export function getConfiguredStoreConsumableSkuPricing(_options: StoreConsumableSkuPricingProviderOptions): StoreConsumableSkuPricingResponse | undefined {
    // Spacebar does not currently persist Discord consumable SKU pricing.
    return undefined;
}

export function toStoreSkuPriceResponse(price: StoreSkuPriceResponse): StoreSkuPriceResponse {
    const response: StoreSkuPriceResponse = {
        currency: price.currency,
        currency_exponent: price.currency_exponent,
        amount: price.amount,
    };

    if (price.sale_amount !== undefined) response.sale_amount = price.sale_amount;
    if (price.sale_percentage !== undefined) response.sale_percentage = price.sale_percentage;
    if (price.premium !== undefined) {
        response.premium = Object.fromEntries(
            Object.entries(price.premium).map(([premiumType, premiumPrice]) => [
                premiumType,
                {
                    amount: premiumPrice.amount,
                    percentage: premiumPrice.percentage,
                },
            ]),
        );
    }

    return response;
}

export function toStoreConsumableSkuPricingResponse(source: StoreConsumableSkuPricingSource): StoreConsumableSkuPricingResponse {
    return {
        price: toStoreSkuPriceResponse(source.price),
    };
}

export async function getStoreConsumableSkuPricing(
    skuId: string,
    pricingProvider: StoreConsumableSkuPricingProvider = getConfiguredStoreConsumableSkuPricing,
): Promise<StoreConsumableSkuPricingResponse> {
    if (!isStoreSkuRouteSnowflake(skuId)) throw UNKNOWN_STORE_SKU_ERROR;

    const pricing = await pricingProvider({ sku_id: skuId });
    if (!pricing) throw UNKNOWN_STORE_SKU_ERROR;

    return toStoreConsumableSkuPricingResponse(pricing);
}

export function createStoreConsumableSkuPricingRouter(pricingProvider: StoreConsumableSkuPricingProvider = getConfiguredStoreConsumableSkuPricing) {
    const router: Router = createRouter({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Consumable SKU Pricing",
            description: "Returns locally backed pricing information for a consumable SKU without fabricating Discord-managed pricing.",
            responses: {
                200: {
                    body: "StoreConsumableSkuPricingResponse",
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
            const pricing = await getStoreConsumableSkuPricing(req.params.sku_id as string, pricingProvider);

            return res.status(200).json(pricing);
        },
    );

    return router;
}

export default createStoreConsumableSkuPricingRouter();
