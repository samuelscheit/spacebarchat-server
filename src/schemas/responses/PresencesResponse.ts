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

export type PresenceResponseStatus = "idle" | "dnd" | "online" | "offline";

export interface PresenceResponseClientStatus {
    desktop?: string;
    mobile?: string;
    web?: string;
    embedded?: string;
    vr?: string;
}

export interface PresenceResponseActivity {
    name: string;
    type: number;
    url?: string | null;
    created_at?: number | string;
    session_id?: string | null;
    platform?: string;
    application_id?: Snowflake;
    details?: string | null;
    state?: string | null;
    flags?: number | string;
    [key: string]: unknown;
}

export interface PresenceResponsePresence {
    user: PartialUser;
    guild_id?: Snowflake;
    status: PresenceResponseStatus;
    activities: PresenceResponseActivity[];
    hidden_activities?: PresenceResponseActivity[];
    client_status: PresenceResponseClientStatus;
    has_played_game?: boolean;
}

export interface PresenceResponseVoiceStream {
    user_id: Snowflake;
}

export interface PresenceResponseVoiceChannel {
    channel_id: Snowflake;
    channel_name: string;
    users: Snowflake[];
    streams?: PresenceResponseVoiceStream[];
}

export interface PresenceResponseVoiceGuild {
    guild_id: Snowflake;
    guild_name: string;
    guild_icon: string | null;
    voice_channels: PresenceResponseVoiceChannel[];
}

export interface PresenceResponseApplication {
    id?: Snowflake;
    name?: string;
    icon?: string | null;
    [key: string]: unknown;
}

export interface PresencesResponse {
    guilds: PresenceResponseVoiceGuild[];
    presences: PresenceResponsePresence[];
    applications: PresenceResponseApplication[];
}
