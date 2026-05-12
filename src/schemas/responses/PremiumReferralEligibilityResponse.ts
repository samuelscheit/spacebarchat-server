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

import type { Snowflake } from "@spacebar/schemas";

export interface PremiumReferralEligibilityResponse {
    referrals_remaining: number;
    sent_user_ids: Snowflake[];
    refresh_at: string | null;
    has_eligible_friends: boolean;
    recipient_status: {
        [userId: Snowflake]: number;
    };
    is_eligible_for_incentive: boolean;
    is_qualified_for_incentive: boolean;
    referral_incentive_status: number;
}
