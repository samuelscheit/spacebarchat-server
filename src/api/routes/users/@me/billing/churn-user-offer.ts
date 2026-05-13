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
import type { BillingUserDiscountOfferResponse } from "@spacebar/schemas";
import { ApiError } from "@spacebar/util";
import { Router as createRouter, type Request, type Response, type Router } from "express";

export const UNKNOWN_CHURN_USER_OFFER = new ApiError("Unknown offer", 0, 404);

export type BillingChurnUserOfferProvider = (userId: string) => BillingUserDiscountOfferResponse | null | Promise<BillingUserDiscountOfferResponse | null>;

export async function getBillingChurnUserOffer(userId: string): Promise<BillingUserDiscountOfferResponse | null> {
    void userId;

    // Spacebar does not currently persist Discord-managed retention discount offers.
    return null;
}

export function createUserBillingChurnUserOfferRouter(offerProvider: BillingChurnUserOfferProvider = getBillingChurnUserOffer) {
    const router: Router = createRouter({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Churn User Offer",
            description:
                "Returns the current retention discount offer for the authenticated user when locally persisted non-renewing subscription offer state exists. Spacebar does not currently persist Discord-managed retention discounts, so unknown offers fail closed instead of fabricating billing discounts.",
            responses: {
                200: {
                    body: "BillingChurnUserOfferResponse",
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
            const offer = await offerProvider(req.user_id);
            if (!offer) throw UNKNOWN_CHURN_USER_OFFER;

            return res.status(200).json({ offer });
        },
    );

    return router;
}

export default createUserBillingChurnUserOfferRouter();
