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
import type { PremiumReferralIncentiveEligibilityResponse } from "@spacebar/schemas";
import { type Request, type Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

export function getPremiumReferralIncentiveEligibility(userId: string): PremiumReferralIncentiveEligibilityResponse {
    void userId;

    // Spacebar does not persist Discord premium referral incentive state, so fail closed.
    return { is_eligible_for_incentive: false };
}

router.get(
    "/",
    route({
        summary: "Get Premium Referral Incentive Eligibility",
        description: "Returns a subset of the premium referral eligibility object for the user with their eligibility for a personal discount upon referral redemption.",
        responses: {
            200: {
                body: "PremiumReferralIncentiveEligibilityResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
        },
    }),
    (req: Request, res: Response) => res.status(200).json(getPremiumReferralIncentiveEligibility(req.user_id)),
);

export default router;
