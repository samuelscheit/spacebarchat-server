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
import type { PartialUser } from "../api/users/User";

export enum GuildScheduledEventPrivacyLevel {
    GuildOnly = 2,
}

export enum GuildScheduledEventStatus {
    Scheduled = 1,
    Active = 2,
    Completed = 3,
    Canceled = 4,
}

export enum GuildScheduledEventEntityType {
    StageInstance = 1,
    Voice = 2,
    External = 3,
    PrimeTime = 4,
}

export enum GuildScheduledEventRecurrenceRuleFrequency {
    Yearly = 0,
    Monthly = 1,
    Weekly = 2,
    Daily = 3,
}

export enum GuildScheduledEventRecurrenceRuleWeekday {
    Monday = 0,
    Tuesday = 1,
    Wednesday = 2,
    Thursday = 3,
    Friday = 4,
    Saturday = 5,
    Sunday = 6,
}

export interface GuildScheduledEventEntityMetadata {
    location?: string;
}

export interface GuildScheduledEventRecurrenceRuleNWeekday {
    n: number;
    day: GuildScheduledEventRecurrenceRuleWeekday;
}

export interface GuildScheduledEventRecurrenceRule {
    start: string;
    end: string | null;
    frequency: GuildScheduledEventRecurrenceRuleFrequency;
    interval: number;
    by_weekday?: GuildScheduledEventRecurrenceRuleWeekday[] | null;
    by_n_weekday?: GuildScheduledEventRecurrenceRuleNWeekday[] | null;
    by_month?: number[] | null;
    by_month_day?: number[] | null;
    by_year_day?: number[] | null;
    count?: number | null;
}

export interface GuildScheduledEventExceptionResponse {
    event_id: Snowflake;
    event_exception_id: Snowflake;
    is_canceled: boolean;
    scheduled_start_time?: string | null;
    scheduled_end_time?: string | null;
}

export interface GuildScheduledEventResponse {
    id: Snowflake;
    guild_id: Snowflake;
    channel_id: Snowflake | null;
    creator_id?: Snowflake | null;
    creator?: PartialUser;
    name: string;
    description?: string | null;
    scheduled_start_time: string;
    scheduled_end_time: string | null;
    auto_start?: boolean;
    privacy_level: GuildScheduledEventPrivacyLevel;
    status: GuildScheduledEventStatus;
    entity_type: GuildScheduledEventEntityType;
    entity_id?: Snowflake | null;
    entity_metadata: GuildScheduledEventEntityMetadata | null;
    user_count?: number;
    image?: string | null;
    recurrence_rule?: GuildScheduledEventRecurrenceRule | null;
    guild_scheduled_event_exceptions?: GuildScheduledEventExceptionResponse[];
    sku_ids?: Snowflake[];
}
