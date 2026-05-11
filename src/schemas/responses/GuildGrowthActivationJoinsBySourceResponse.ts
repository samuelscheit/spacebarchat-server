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

export interface GuildGrowthActivationJoinsBySourceBucket {
    day_pt: string;
    discovery_joins: number;
    invites: number;
    vanity_joins: number;
    hubs_joins: number;
    bot_joins: number;
    integration_joins: number;
    other_joins: number;
    total_joins: number;
}

export type GuildGrowthActivationJoinsBySourceResponse = GuildGrowthActivationJoinsBySourceBucket[];
