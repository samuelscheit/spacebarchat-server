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

export interface GuildWelcomeScreenFunnelBucket {
    day_pt: string;
    option_channel_id: Snowflake;
    option_selected: string;
    users_viewed_welcome_screen: number;
    users_clicked_any_option: number;
    users_clicked_option: number;
    users_sent_message: number;
    pct_clicked_option?: number;
    pct_sent_message?: number;
}

export type GuildWelcomeScreenFunnelResponse = GuildWelcomeScreenFunnelBucket[];
