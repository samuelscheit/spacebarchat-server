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
import type { QuestUserStatusResponse } from "./QuestUserStatusResponse";

export interface QuestApplicationResponse {
    id: Snowflake;
    name: string;
    link: string;
}

export interface QuestAssetsResponse {
    hero: string;
    hero_video: string | null;
    quest_bar_hero: string;
    quest_bar_hero_video: string | null;
    game_tile: string;
    logotype: string;
}

export interface QuestGradientResponse {
    primary: string;
    secondary: string;
}

export interface QuestMessagesResponse {
    quest_name: string;
    game_title: string;
    game_publisher: string;
}

export interface QuestTaskResponse {
    event_name: string;
    target: number;
    external_ids?: string[];
    title?: string;
    description?: string;
}

export interface QuestTaskMapResponse {
    [event_name: string]: QuestTaskResponse;
}

export interface QuestTaskConfigResponse {
    type: number;
    join_operator: "and" | "or";
    tasks: QuestTaskMapResponse;
    enrollment_url?: string;
    developer_application_id?: Snowflake;
}

export interface QuestRewardMessagesResponse {
    name: string;
    name_with_article: string;
    redemption_instructions_by_platform?: QuestRewardRedemptionInstructionsByPlatformResponse;
}

export interface QuestRewardRedemptionInstructionsByPlatformResponse {
    [platform: string]: string;
}

export interface QuestRewardResponse {
    type: number;
    sku_id: Snowflake;
    asset?: string | null;
    asset_video?: string | null;
    messages: QuestRewardMessagesResponse;
    approximate_count?: number | null;
    redemption_link?: string | null;
    expires_at?: string | null;
    expires_at_premium?: string | null;
    expiration_mode?: number;
    orb_quantity?: number;
    quantity?: number;
}

export interface QuestRewardsConfigResponse {
    assignment_method: number;
    rewards: QuestRewardResponse[];
    rewards_expire_at: string | null;
    platforms: number[];
}

export interface QuestVideoMessagesResponse {
    video_title: string;
    video_end_cta_title: string;
    video_end_cta_subtitle: string;
    video_end_cta_button_label: string;
}

export interface QuestVideoAssetsResponse {
    video_player_video_hls: string | null;
    video_player_video: string;
    video_player_thumbnail: string | null;
    video_player_video_low_res: string;
    video_player_caption: string;
    video_player_transcript: string;
    quest_bar_preview_video: string | null;
    quest_bar_preview_thumbnail: string | null;
    quest_home_video: string | null;
}

export interface QuestVideoMetadataResponse {
    messages: QuestVideoMessagesResponse;
    assets: QuestVideoAssetsResponse;
}

export interface QuestCosponsorMetadataResponse {
    name: string;
    logotype: string;
    redemption_instructions: string;
}

export interface QuestExperimentsResponse {
    rollout?: string | null;
    targeting?: string | null;
    preview?: string | null;
}

export interface QuestConfigResponse {
    id: Snowflake;
    config_version: number;
    starts_at: string;
    expires_at: string;
    features: number[];
    application: QuestApplicationResponse;
    assets: QuestAssetsResponse;
    colors: QuestGradientResponse;
    messages: QuestMessagesResponse;
    task_config: QuestTaskConfigResponse;
    rewards_config: QuestRewardsConfigResponse;
    video_metadata?: QuestVideoMetadataResponse;
    cosponsor_metadata?: QuestCosponsorMetadataResponse;
    experiments?: QuestExperimentsResponse;
}

export interface QuestResponse {
    id: Snowflake;
    config: QuestConfigResponse;
    user_status: QuestUserStatusResponse | null;
    targeted_content: number[] | null;
    preview: boolean;
}

export interface QuestAdIdentifiersResponse {
    campaign_id: Snowflake;
    ad_set_id: Snowflake;
    ad_id: Snowflake;
    creative_id: Snowflake;
    creative_type: number;
}

export interface QuestAdContextResponse {
    is_campaign_ias_enabled: boolean;
}

export interface QuestDecisionResponse {
    request_id: string;
    quest: QuestResponse | null;
    ad_identifiers: QuestAdIdentifiersResponse | null;
    ad_context: QuestAdContextResponse | null;
    metadata_raw: string | null;
    metadata_sealed: string | null;
    traffic_metadata_raw: string | null;
    traffic_metadata_sealed: string | null;
    creative: null;
    response_ttl_seconds: number;
}
