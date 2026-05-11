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
import type { QuestAssetsResponse, QuestGradientResponse, QuestMessagesResponse } from "./QuestDecisionResponse";
import type { QuestUserStatusResponse } from "./QuestUserStatusResponse";

export interface ClaimedQuestCollectibleProductResponse {
    [key: string]: unknown;
}

export interface ClaimedQuestRewardResponse {
    type: number;
    sku_id: Snowflake;
    name: string;
    name_with_article: string;
    asset: string;
    asset_video?: string | null;
    orb_quantity?: number;
    collectible_product?: ClaimedQuestCollectibleProductResponse | null;
}

export interface ClaimedQuestConfigResponse {
    id: Snowflake;
    starts_at: string;
    expires_at: string;
    features: number[];
    colors: QuestGradientResponse;
    assets: QuestAssetsResponse;
    messages: QuestMessagesResponse;
    rewards: ClaimedQuestRewardResponse[];
}

export interface ClaimedQuestResponse {
    id: Snowflake;
    config: ClaimedQuestConfigResponse;
    user_status: QuestUserStatusResponse;
}

export interface QuestClaimedQuestsResponse {
    quests: ClaimedQuestResponse[];
}
