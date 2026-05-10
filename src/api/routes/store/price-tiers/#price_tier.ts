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
import type { StorePriceTierResponse } from "@spacebar/schemas";
import { DiscordApiErrors } from "@spacebar/util";
import { Router as createRouter, type Request, type Response, type Router } from "express";

const priceTierPattern = /^(0|[1-9]\d*)$/;

export type StorePriceTierProvider = (priceTier: number) => StorePriceTierResponse;

export function assertValidStorePriceTierParam(value: unknown): asserts value is string {
    if (typeof value !== "string" || !priceTierPattern.test(value)) throw DiscordApiErrors.INVALID_FORM_BODY;

    const parsed = Number.parseInt(value, 10);
    if (!Number.isSafeInteger(parsed)) throw DiscordApiErrors.INVALID_FORM_BODY;
}

export function parseStorePriceTierParam(value: unknown): number {
    assertValidStorePriceTierParam(value);

    return Number.parseInt(value, 10);
}

export function getStorePriceTier(_priceTier: number): StorePriceTierResponse {
    // Spacebar does not persist Discord store monetization price tier catalogs yet.
    return {};
}

export function getStorePriceTierPricing(priceTier: number, priceTierProvider: StorePriceTierProvider = getStorePriceTier): StorePriceTierResponse {
    return { ...priceTierProvider(priceTier) };
}

export function createStorePriceTierRouter(priceTierProvider: StorePriceTierProvider = getStorePriceTier) {
    const router: Router = createRouter({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Store Price Tier",
            description: "Returns localized currency pricing for a store price tier.",
            responses: {
                200: {
                    body: "StorePriceTierResponse",
                },
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        (req: Request, res: Response) => {
            const priceTier = parseStorePriceTierParam(req.params.price_tier);
            res.status(200).json(getStorePriceTierPricing(priceTier, priceTierProvider));
        },
    );

    return router;
}

export default createStorePriceTierRouter();
