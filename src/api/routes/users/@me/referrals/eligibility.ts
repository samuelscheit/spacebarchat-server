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
import type { PremiumReferralEligibilityResponse } from "@spacebar/schemas";
import { type Request, type Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

export const PremiumReferralIncentiveStatus = {
    NotEligible: 0,
    Eligible: 1,
    Qualified: 2,
    Cooldown: 3,
    Unapplied: 4,
} as const;

export function getPremiumReferralEligibility(userId: string): PremiumReferralEligibilityResponse {
    void userId;

    // Spacebar does not persist Discord premium referral campaign state, so expose only the empty locally truthful eligibility state.
    return {
        referrals_remaining: 0,
        sent_user_ids: [],
        refresh_at: null,
        has_eligible_friends: false,
        recipient_status: {},
        is_eligible_for_incentive: false,
        is_qualified_for_incentive: false,
        referral_incentive_status: PremiumReferralIncentiveStatus.NotEligible,
    };
}

router.get(
    "/",
    route({
        summary: "Get Premium Referral Eligibility",
        description: "Returns a premium referral eligibility object for the user without fabricating unsupported Nitro referral campaign state.",
        responses: {
            200: {
                body: "PremiumReferralEligibilityResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
        },
    }),
    (req: Request, res: Response) => res.status(200).json(getPremiumReferralEligibility(req.user_id)),
);

export default router;
