import { Snowflake } from "../Identifiers";
import { StageInstancePrivacyLevel } from "../responses/StageInstanceResponse";

export interface StageInstanceCreateSchema {
    channel_id: Snowflake;
    topic: string;
    privacy_level?: StageInstancePrivacyLevel;
    send_start_notification?: boolean;
    guild_scheduled_event_id?: Snowflake;
}
