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

import type { Snowflake } from "../Identifiers";

export interface BillingUserDiscountResponse {
    id: Snowflake;
    amount: number;
    starts_at?: string | null;
    ends_at?: string | null;
    status: number;
    created_at: string;
    sku_ids: Snowflake[] | null;
    sku_group_ids: Snowflake[] | null;
    plan_ids: Snowflake[];
    user_usage_limit_interval: number;
    user_usage_limit_interval_count: number;
    user_usage_limit: number;
}

export interface BillingUserDiscountOfferResponse {
    id: Snowflake;
    discount_id: Snowflake;
    user_id: Snowflake;
    invoice_id?: Snowflake | null;
    created_at?: string | null;
    applied_at: string | null;
    deleted_at?: string | null;
    expires_at: string | null;
    discount: BillingUserDiscountResponse;
}

export interface BillingChurnUserOfferResponse {
    offer: BillingUserDiscountOfferResponse;
}
