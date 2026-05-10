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
import type { UserGuildResponse } from "./UserGuildsResponse";

export enum FamilyCenterLinkStatus {
    REQUESTED = 1,
    CONNECTED = 2,
    DISCONNECTED = 3,
    REJECTED = 4,
}

export enum FamilyCenterLinkType {
    CURRENT_USER_IS_LINKED_USER = 1,
    CURRENT_USER_IS_REQUESTOR = 2,
}

export enum FamilyCenterActionType {
    USER_ADDED = 1,
    GUILD_JOINED = 2,
    USER_MESSAGED = 3,
    GUILD_MESSAGED = 4,
    USER_CALLED = 5,
}

export interface FamilyCenterLinkedUser {
    created_at: string;
    updated_at: string;
    link_status: FamilyCenterLinkStatus;
    link_type: FamilyCenterLinkType;
    requestor_id: Snowflake;
    user_id: Snowflake;
}

export interface FamilyCenterTeenAuditLogAction {
    event_id: Snowflake;
    user_id: Snowflake;
    entity_id: Snowflake;
    display_type: FamilyCenterActionType;
}

export interface FamilyCenterActionTotals {
    [action_type: string]: number;
}

export interface FamilyCenterTeenAuditLog {
    teen_user_id: Snowflake | null;
    range_start_id: Snowflake | null;
    actions: FamilyCenterTeenAuditLogAction[];
    users: PartialUser[];
    guilds: UserGuildResponse[];
    totals: FamilyCenterActionTotals;
}

export interface FamilyCenterResponse {
    linked_users: FamilyCenterLinkedUser[];
    teen_audit_log: FamilyCenterTeenAuditLog;
    users: PartialUser[];
}

export interface FamilyCenterLinkCodeResponse {
    link_code: string;
}
