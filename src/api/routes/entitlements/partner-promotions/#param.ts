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
import { ApiError } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

export const PARTNER_PROMOTION_UNSUPPORTED_MESSAGE = "Partner promotion claims are not supported on this Spacebar instance.";

export function createPartnerPromotionUnsupportedError(): ApiError {
    return new ApiError(PARTNER_PROMOTION_UNSUPPORTED_MESSAGE, 0, 501);
}

export function claimPartnerPromotion(_promotionId: string): never {
    // Discord backs this mutation with private partner-promotion entitlement state.
    throw createPartnerPromotionUnsupportedError();
}

router.post(
    "/",
    route({
        summary: "Claim Partner Promotion",
        description:
            "Claims a partner promotion for the authenticated user. Spacebar does not currently persist partner-promotion entitlement state or integrate with a partner promotion provider, so this compatibility endpoint fails closed instead of fabricating an entitlement.",
        responses: {
            401: {
                body: "APIErrorResponse",
            },
            501: {
                body: "APIErrorResponse",
            },
        },
    }),
    (req: Request, _res: Response) => {
        claimPartnerPromotion(req.params.param as string);
    },
);

export default router;
