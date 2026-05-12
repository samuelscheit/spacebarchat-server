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

import type { ApplicationType } from "../api/developers/Application";
import type { Snowflake } from "../Identifiers";
import type { StoreSkuResponse } from "./StoreSkuResponse";

export interface PartnerSdkApplicationSkuRecommendationsResponse {
    skus: StoreSkuResponse[];
    skus_to_user_ids: PartnerSdkApplicationSkuRecommendationMap;
    application: PartnerSdkApplicationSkuRecommendationApplication;
}

export interface PartnerSdkApplicationSkuRecommendationMap {
    [skuId: Snowflake]: PartnerSdkApplicationSkuRecommendation;
}

export interface PartnerSdkApplicationSkuRecommendation {
    user_id: Snowflake;
    reason: PartnerSdkApplicationSkuRecommendationReason;
}

export type PartnerSdkApplicationSkuRecommendationReason = "WISHLIST" | "RECOMMENDATION";

export interface PartnerSdkApplicationSkuRecommendationApplication {
    id: Snowflake;
    name: string;
    description: string;
    icon: string | null;
    type: ApplicationType | null;
    flags: number;
}
