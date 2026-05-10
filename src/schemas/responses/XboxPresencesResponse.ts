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

export type XboxPresenceStatus = "idle" | "dnd" | "online" | "offline";

export interface XboxPresenceClientStatus {
    desktop?: string;
    mobile?: string;
    web?: string;
    embedded?: string;
    vr?: string;
}

export interface XboxPresenceActivity {
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

export interface XboxPresence {
    user: PartialUser;
    guild_id?: Snowflake;
    status: XboxPresenceStatus;
    activities: XboxPresenceActivity[];
    client_status: XboxPresenceClientStatus;
}

export interface XboxPresenceVoiceStream {
    user_id: Snowflake;
}

export interface XboxPresenceVoiceChannel {
    channel_id: Snowflake;
    channel_name: string;
    users: Snowflake[];
    streams?: XboxPresenceVoiceStream[];
}

export interface XboxPresenceVoiceGuild {
    guild_id: Snowflake;
    guild_name: string;
    guild_icon: string | null;
    voice_channels: XboxPresenceVoiceChannel[];
}

export interface XboxPresenceApplication {
    id?: Snowflake;
    name?: string;
    icon?: string | null;
    [key: string]: unknown;
}

export interface XboxPresenceConnectedAccountIds {
    user_id: Snowflake;
    provider_ids: string[];
}

export interface XboxPresencesResponse {
    guilds: XboxPresenceVoiceGuild[];
    presences: XboxPresence[];
    applications: XboxPresenceApplication[];
    connected_account_ids: XboxPresenceConnectedAccountIds[];
}
