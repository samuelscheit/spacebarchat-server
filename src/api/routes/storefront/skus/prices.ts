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
import type { StorefrontSkuCountryPrices, StorefrontSkuPrice, StorefrontSkuPricesResponse, StorefrontSkuUnitPrice } from "@spacebar/schemas";
import { DiscordApiErrors } from "@spacebar/util";
import { Router as createRouter, type Request, type Response, type Router } from "express";
import { isStorefrontProductId } from "../../../util/utility/StorefrontProductRoute";

const maxStorefrontSkuPriceIds = 100;
const emptyStorefrontSkuPrices: StorefrontSkuPriceMap = {};

export interface StorefrontSkuPricesQueryOptions {
    sku_ids: string[];
}

export type StorefrontSkuPriceMap = Readonly<Record<string, StorefrontSkuPrice | undefined>>;

export type StorefrontSkuPricesProvider = (options: StorefrontSkuPricesQueryOptions) => StorefrontSkuPriceMap | Promise<StorefrontSkuPriceMap>;

function queryValues(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap(queryValues);
    if (typeof value !== "string") return [];

    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

export function isStorefrontSkuPriceSkuId(value: string) {
    return isStorefrontProductId(value);
}

function requiredStorefrontSkuPriceSkuIds(values: string[]): string[] {
    if (values.length === 0 || values.length > maxStorefrontSkuPriceIds) throw DiscordApiErrors.INVALID_FORM_BODY;

    for (const value of values) {
        if (!isStorefrontSkuPriceSkuId(value)) throw DiscordApiErrors.INVALID_FORM_BODY;
    }

    return [...new Set(values)];
}

export function parseStorefrontSkuPricesQuery(query: Request["query"]): StorefrontSkuPricesQueryOptions {
    return {
        sku_ids: requiredStorefrontSkuPriceSkuIds([...queryValues(query.sku_ids), ...queryValues(query["sku_ids[]"])]),
    };
}

export function getConfiguredStorefrontSkuPrices(_options: StorefrontSkuPricesQueryOptions): StorefrontSkuPriceMap {
    // Spacebar does not currently persist Discord storefront SKU price catalogs.
    return emptyStorefrontSkuPrices;
}

function cloneUnitPrice(price: StorefrontSkuUnitPrice): StorefrontSkuUnitPrice {
    return {
        currency: price.currency,
        amount: price.amount,
        exponent: price.exponent,
    };
}

function cloneCountryPrices(countryPrices: StorefrontSkuCountryPrices): StorefrontSkuCountryPrices {
    return {
        country_code: countryPrices.country_code,
        prices: countryPrices.prices.map(cloneUnitPrice),
    };
}

function clonePaymentSourcePrices(paymentSourcePrices: NonNullable<StorefrontSkuPrice["payment_source_prices"]>): NonNullable<StorefrontSkuPrice["payment_source_prices"]> {
    return Object.fromEntries(Object.entries(paymentSourcePrices).map(([paymentSourceId, prices]) => [paymentSourceId, prices.map(cloneUnitPrice)]));
}

export function toStorefrontSkuPricesResponse(prices: StorefrontSkuPriceMap, skuIds: readonly string[]): StorefrontSkuPricesResponse {
    const response: StorefrontSkuPricesResponse = {
        sku_prices: {},
    };

    for (const skuId of [...new Set(skuIds)]) {
        const price = prices[skuId];
        if (!price) continue;

        const clonedPrice: StorefrontSkuPrice = {};
        if (price.country_prices !== undefined) clonedPrice.country_prices = cloneCountryPrices(price.country_prices);
        if (price.payment_source_prices !== undefined) clonedPrice.payment_source_prices = clonePaymentSourcePrices(price.payment_source_prices);

        response.sku_prices[skuId] = clonedPrice;
    }

    return response;
}

export async function getStorefrontSkuPrices(
    options: StorefrontSkuPricesQueryOptions,
    priceProvider: StorefrontSkuPricesProvider = getConfiguredStorefrontSkuPrices,
): Promise<StorefrontSkuPricesResponse> {
    const prices = await priceProvider(options);

    return toStorefrontSkuPricesResponse(prices, options.sku_ids);
}

export function createStorefrontSkuPricesRouter(priceProvider: StorefrontSkuPricesProvider = getConfiguredStorefrontSkuPrices) {
    const router: Router = createRouter({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Storefront SKU Prices",
            description: "Returns locally backed pricing objects for the requested storefront SKU IDs.",
            query: {
                sku_ids: {
                    type: "array",
                    required: true,
                    description: "SKU IDs to retrieve storefront prices for (1-100).",
                },
            },
            responses: {
                200: {
                    body: "StorefrontSkuPricesResponse",
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
            const options = parseStorefrontSkuPricesQuery(req.query);
            const prices = await getStorefrontSkuPrices(options, priceProvider);

            return res.status(200).json(prices);
        },
    );

    return router;
}

export default createStorefrontSkuPricesRouter();
