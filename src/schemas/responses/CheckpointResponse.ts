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

import type { PartialUser } from "../api/users/User";
import type { Snowflake } from "../Identifiers";

/**
 * Keep Discord checkpoint ratio, percentile, and duration fields as JSON numbers.
 *
 * @TJS-type number
 */
export type CheckpointFloat = number & {};

export enum CheckpointCardType {
    PLANT = 0,
    DONUT = 1,
    DOG_IN_SWIM_RING = 2,
    DISCO_BALL = 3,
    ORIGAMI_PAPER_CRANE = 4,
    SNAIL = 5,
    DUCK_WITH_SUNGLASSES = 6,
    BANANA = 7,
    CAT = 8,
    CARTRIDGE = 9,
}

export interface CheckpointAvatarDecorationAssets {
    static_image_url: string;
    animated_image_url: string | null;
}

export interface CheckpointAvatarDecorationCollectibleItem {
    type: number;
    id: Snowflake;
    sku_id: Snowflake;
    asset: string;
    assets: CheckpointAvatarDecorationAssets;
    label: string;
}

export interface CheckpointMessageTopMonthStatistics {
    month: number;
    num_messages_sent: number;
}

export interface CheckpointMessageStatistics {
    num_messages_sent: number;
    num_messages_sent_percentile: CheckpointFloat | null;
    top_month: CheckpointMessageTopMonthStatistics | null;
}

export interface CheckpointPartialEmoji {
    id?: Snowflake | null;
    name: string | null;
    animated?: boolean;
}

export interface CheckpointEmojiStatistics {
    num_emojis_sent: number;
    emojis: CheckpointPartialEmoji[];
}

export interface CheckpointVoiceTopMonthStatistics {
    month: number;
    num_minutes_in_voice: CheckpointFloat;
}

export interface CheckpointVoiceStatistics {
    total_voice_minutes: CheckpointFloat;
    total_voice_minutes_percentile: CheckpointFloat | null;
    top_month: CheckpointVoiceTopMonthStatistics | null;
}

export interface CheckpointPartialGuild {
    id: Snowflake;
    name: string;
    icon?: string | null;
    description?: string | null;
    home_header?: string | null;
    splash?: string | null;
    discovery_splash?: string | null;
    features: string[];
}

export interface CheckpointGuildStatistics {
    num_messages_sent?: number;
    num_voice_minutes?: CheckpointFloat;
    guild: CheckpointPartialGuild;
}

export interface CheckpointGuildsStatistics {
    num_guilds_joined: number;
    guilds: CheckpointGuildStatistics[];
}

export interface CheckpointSidekick {
    user: PartialUser;
    num_messages_sent: number;
    num_voice_minutes: CheckpointFloat;
}

export interface CheckpointUser {
    user: PartialUser;
}

export interface CheckpointPartialApplication {
    id: Snowflake;
    name: string;
    icon_hash?: string | null;
    banner_hash?: string | null;
    cover_image_hash?: string | null;
}

export interface CheckpointGameStatistics {
    num_sessions: number;
    game: CheckpointPartialApplication;
}

export interface CheckpointGamesStatistics {
    total_games_played: number;
    applications: CheckpointGameStatistics[];
}

export interface CheckpointQuestStatistics {
    num_completed: number;
    num_orbs: number;
}

export interface CheckpointResponse {
    card_id?: CheckpointCardType;
    avatar_decoration: CheckpointAvatarDecorationCollectibleItem | null;
    power_level?: CheckpointFloat;
    power_level_percentile?: CheckpointFloat | null;
    messages?: CheckpointMessageStatistics;
    emojis?: CheckpointEmojiStatistics;
    voice?: CheckpointVoiceStatistics;
    guilds?: CheckpointGuildsStatistics;
    sidekick?: CheckpointSidekick;
    users?: CheckpointUser[];
    applications?: CheckpointGamesStatistics;
    quests?: CheckpointQuestStatistics;
}
