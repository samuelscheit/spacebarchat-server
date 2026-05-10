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

export interface QuestTaskHeartbeatResponse {
    last_beat_at: string;
    expires_at: string | null;
}

export interface QuestTaskProgressResponse {
    event_name: string;
    value: number;
    updated_at: string;
    completed_at: string | null;
    heartbeat?: QuestTaskHeartbeatResponse | null;
}

export interface QuestTaskProgressMap {
    [event_name: string]: QuestTaskProgressResponse;
}

export interface QuestUserStatusResponse {
    user_id: Snowflake;
    quest_id?: Snowflake;
    enrolled_at: string | null;
    completed_at: string | null;
    claimed_at: string | null;
    claimed_tier?: number | null;
    last_stream_heartbeat_at?: string | null;
    stream_progress_seconds?: number;
    dismissed_quest_content?: number;
    progress: QuestTaskProgressMap;
}
