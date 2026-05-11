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

import type { QuestConfigResponse } from "@spacebar/schemas";

export function isQuestConfigActive(config: QuestConfigResponse, now: Date = new Date()): boolean {
    const startsAt = Date.parse(config.starts_at);
    const expiresAt = Date.parse(config.expires_at);
    if (!Number.isFinite(startsAt) || !Number.isFinite(expiresAt)) return false;

    const nowMs = now.getTime();
    return startsAt <= nowMs && nowMs < expiresAt;
}

export function toQuestConfigResponse(config: QuestConfigResponse): QuestConfigResponse {
    const response: QuestConfigResponse = {
        id: config.id,
        config_version: config.config_version,
        starts_at: config.starts_at,
        expires_at: config.expires_at,
        features: [...config.features],
        application: {
            id: config.application.id,
            name: config.application.name,
            link: config.application.link,
        },
        assets: {
            hero: config.assets.hero,
            hero_video: config.assets.hero_video,
            quest_bar_hero: config.assets.quest_bar_hero,
            quest_bar_hero_video: config.assets.quest_bar_hero_video,
            game_tile: config.assets.game_tile,
            logotype: config.assets.logotype,
        },
        colors: {
            primary: config.colors.primary,
            secondary: config.colors.secondary,
        },
        messages: {
            quest_name: config.messages.quest_name,
            game_title: config.messages.game_title,
            game_publisher: config.messages.game_publisher,
        },
        task_config: {
            type: config.task_config.type,
            join_operator: config.task_config.join_operator,
            tasks: Object.fromEntries(
                Object.entries(config.task_config.tasks).map(([eventName, task]) => [
                    eventName,
                    {
                        event_name: task.event_name,
                        target: task.target,
                        ...(task.external_ids !== undefined ? { external_ids: [...task.external_ids] } : {}),
                        ...(task.title !== undefined ? { title: task.title } : {}),
                        ...(task.description !== undefined ? { description: task.description } : {}),
                    },
                ]),
            ),
            ...(config.task_config.enrollment_url !== undefined ? { enrollment_url: config.task_config.enrollment_url } : {}),
            ...(config.task_config.developer_application_id !== undefined ? { developer_application_id: config.task_config.developer_application_id } : {}),
        },
        rewards_config: {
            assignment_method: config.rewards_config.assignment_method,
            rewards: config.rewards_config.rewards.map((reward) => ({
                type: reward.type,
                sku_id: reward.sku_id,
                ...(reward.asset !== undefined ? { asset: reward.asset } : {}),
                ...(reward.asset_video !== undefined ? { asset_video: reward.asset_video } : {}),
                messages: {
                    name: reward.messages.name,
                    name_with_article: reward.messages.name_with_article,
                    ...(reward.messages.redemption_instructions_by_platform !== undefined
                        ? { redemption_instructions_by_platform: { ...reward.messages.redemption_instructions_by_platform } }
                        : {}),
                },
                ...(reward.approximate_count !== undefined ? { approximate_count: reward.approximate_count } : {}),
                ...(reward.redemption_link !== undefined ? { redemption_link: reward.redemption_link } : {}),
                ...(reward.expires_at !== undefined ? { expires_at: reward.expires_at } : {}),
                ...(reward.expires_at_premium !== undefined ? { expires_at_premium: reward.expires_at_premium } : {}),
                ...(reward.expiration_mode !== undefined ? { expiration_mode: reward.expiration_mode } : {}),
                ...(reward.orb_quantity !== undefined ? { orb_quantity: reward.orb_quantity } : {}),
                ...(reward.quantity !== undefined ? { quantity: reward.quantity } : {}),
            })),
            rewards_expire_at: config.rewards_config.rewards_expire_at,
            platforms: [...config.rewards_config.platforms],
        },
    };

    if (config.video_metadata !== undefined) {
        response.video_metadata = {
            messages: {
                video_title: config.video_metadata.messages.video_title,
                video_end_cta_title: config.video_metadata.messages.video_end_cta_title,
                video_end_cta_subtitle: config.video_metadata.messages.video_end_cta_subtitle,
                video_end_cta_button_label: config.video_metadata.messages.video_end_cta_button_label,
            },
            assets: {
                video_player_video_hls: config.video_metadata.assets.video_player_video_hls,
                video_player_video: config.video_metadata.assets.video_player_video,
                video_player_thumbnail: config.video_metadata.assets.video_player_thumbnail,
                video_player_video_low_res: config.video_metadata.assets.video_player_video_low_res,
                video_player_caption: config.video_metadata.assets.video_player_caption,
                video_player_transcript: config.video_metadata.assets.video_player_transcript,
                quest_bar_preview_video: config.video_metadata.assets.quest_bar_preview_video,
                quest_bar_preview_thumbnail: config.video_metadata.assets.quest_bar_preview_thumbnail,
                quest_home_video: config.video_metadata.assets.quest_home_video,
            },
        };
    }

    if (config.cosponsor_metadata !== undefined) {
        response.cosponsor_metadata = {
            name: config.cosponsor_metadata.name,
            logotype: config.cosponsor_metadata.logotype,
            redemption_instructions: config.cosponsor_metadata.redemption_instructions,
        };
    }

    if (config.experiments !== undefined) {
        response.experiments = {
            ...(config.experiments.rollout !== undefined ? { rollout: config.experiments.rollout } : {}),
            ...(config.experiments.targeting !== undefined ? { targeting: config.experiments.targeting } : {}),
            ...(config.experiments.preview !== undefined ? { preview: config.experiments.preview } : {}),
        };
    }

    return response;
}
