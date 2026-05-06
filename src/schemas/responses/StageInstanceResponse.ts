import { Snowflake } from "../Identifiers";

export enum StageInstancePrivacyLevel {
    Public = 1,
    GuildOnly = 2,
}

export interface StageInstanceResponse {
    id: Snowflake;
    guild_id: Snowflake;
    channel_id: Snowflake;
    topic: string;
    privacy_level: StageInstancePrivacyLevel;
    discoverable_disabled: boolean;
    guild_scheduled_event_id?: Snowflake | null;
}
