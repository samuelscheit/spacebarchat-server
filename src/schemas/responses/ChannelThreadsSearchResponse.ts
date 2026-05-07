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

import { PublicChannel, PublicMessage, Snowflake } from "@spacebar/schemas";

export interface ChannelThreadsSearchMemberMuteConfig {
    end_time?: string;
    selected_time_window?: number;
}

export interface ChannelThreadsSearchMember {
    index: number;
    id: Snowflake;
    member_idx: number;
    join_timestamp: string;
    muted: boolean;
    mute_config?: ChannelThreadsSearchMemberMuteConfig;
    flags: number;
}

export interface ChannelThreadsSearchResponse {
    threads: PublicChannel[];
    members: ChannelThreadsSearchMember[];
    messages: PublicMessage[];
    total_results: number;
    has_more: boolean;
}
