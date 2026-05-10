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
import type { StorePriceTiersResponse } from "@spacebar/schemas";
import { Router as createRouter, type Request, type Response, type Router } from "express";

const emptyStorePriceTiers: readonly number[] = [];

export interface StorePriceTiersQueryOptions {
    price_tier_type?: number;
}

export type StorePriceTiersProvider = (options: StorePriceTiersQueryOptions) => readonly number[];

export function getStorePriceTiers(_options: StorePriceTiersQueryOptions = {}): readonly number[] {
    // Spacebar does not persist Discord store monetization price tier catalogs yet.
    return emptyStorePriceTiers;
}

function firstQueryValue(value: unknown): unknown {
    if (Array.isArray(value)) return value[0];
    return value;
}

function parseOptionalInteger(value: unknown): number | undefined {
    const entry = firstQueryValue(value);
    if (typeof entry === "number" && Number.isSafeInteger(entry)) return entry;
    if (typeof entry !== "string" || !/^-?\d+$/.test(entry)) return undefined;

    const parsed = Number.parseInt(entry, 10);
    return Number.isSafeInteger(parsed) ? parsed : undefined;
}

export function parseStorePriceTiersQuery(query: Request["query"]): StorePriceTiersQueryOptions {
    return {
        price_tier_type: parseOptionalInteger(query.price_tier_type),
    };
}

export function listStorePriceTiers(options: StorePriceTiersQueryOptions = {}, priceTierProvider: StorePriceTiersProvider = getStorePriceTiers): StorePriceTiersResponse {
    return Array.from(priceTierProvider(options));
}

export function createStorePriceTiersRouter(priceTierProvider: StorePriceTiersProvider = getStorePriceTiers) {
    const router: Router = createRouter({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Store Price Tiers",
            description: "Returns the available store price tier identifiers.",
            query: {
                price_tier_type: {
                    type: "integer",
                    description: "Price tier type to retrieve: 1 for guild role subscriptions, 2 for guild products.",
                    values: ["1", "2"],
                },
            },
            responses: {
                200: {
                    body: "StorePriceTiersResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        (req: Request, res: Response) => {
            const options = parseStorePriceTiersQuery(req.query);
            res.status(200).json(listStorePriceTiers(options, priceTierProvider));
        },
    );

    return router;
}

export default createStorePriceTiersRouter();
