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

/**
 * Discord documents growth activation percentages as floats.
 *
 * @TJS-type number
 */
export type GuildGrowthActivationPercentage = number & {};

export interface GuildGrowthActivationActivationBucket {
    day_pt: string;
    new_members: number;
    pct_communicated?: GuildGrowthActivationPercentage;
    pct_opened_channels?: GuildGrowthActivationPercentage;
}

export type GuildGrowthActivationActivationResponse = GuildGrowthActivationActivationBucket[];
