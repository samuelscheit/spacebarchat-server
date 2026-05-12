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
import type { BillingLocalizedPricingPromoResponse } from "@spacebar/schemas";
import { IpDataClient } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

export interface BillingLocalizedPricingPromoLocationInfo {
    country_code?: string;
}

export function createBillingLocalizedPricingPromoResponse(locationInfo: BillingLocalizedPricingPromoLocationInfo | null | undefined): BillingLocalizedPricingPromoResponse {
    if (!locationInfo?.country_code) return {};

    return {
        country_code: locationInfo.country_code,
        localized_pricing_promo: null,
    };
}

router.get(
    "/",
    route({
        summary: "Get Localized Pricing Promo",
        description:
            "Returns the requester's detected country and a null localized pricing promo when Spacebar has no configured local promotion data, avoiding fabricated Discord-managed prices.",
        responses: {
            200: {
                body: "BillingLocalizedPricingPromoResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const locationInfo = await IpDataClient.getIpInfo(req.ip!);

        return res.status(200).json(createBillingLocalizedPricingPromoResponse(locationInfo));
    },
);

export default router;
