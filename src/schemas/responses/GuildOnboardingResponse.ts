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

export interface GuildOnboardingResponse {
    guild_id: Snowflake;
    prompts: GuildOnboardingPrompt[];
    default_channel_ids: Snowflake[];
    enabled: boolean;
    below_requirements: boolean;
    mode: GuildOnboardingMode;
}

export type GuildOnboardingMode = 0 | 1;

export interface GuildOnboardingPrompt {
    id: Snowflake;
    title: string;
    options: GuildOnboardingPromptOption[];
    single_select: boolean;
    required: boolean;
    in_onboarding: boolean;
    type: GuildOnboardingPromptType;
}

export type GuildOnboardingPromptType = 0 | 1;

export interface GuildOnboardingPromptOption {
    id: Snowflake;
    title: string;
    description: string;
    emoji?: GuildOnboardingEmoji | null;
    role_ids: Snowflake[];
    channel_ids: Snowflake[];
}

export interface GuildOnboardingEmoji {
    id?: Snowflake | null;
    name?: string | null;
    animated?: boolean;
}
