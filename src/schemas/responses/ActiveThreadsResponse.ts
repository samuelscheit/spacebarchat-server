import { Snowflake } from "../Identifiers";

export interface ActiveThreadsChannel {
    id: Snowflake;
    type: number;
    guild_id?: Snowflake;
    parent_id?: Snowflake | null;
    name?: string | null;
    last_message_id?: Snowflake | null;
    owner_id?: Snowflake;
    rate_limit_per_user?: number;
    message_count?: number;
    member_count?: number;
    total_message_sent?: number;
    thread_metadata?: {
        archived: boolean;
        auto_archive_duration?: number;
        archive_timestamp: string;
        locked?: boolean;
        invitable?: boolean;
        create_timestamp: string;
    };
    member_ids_preview?: Snowflake[];
    applied_tags?: Snowflake[];
    flags?: number;
}

export interface ActiveThreadsThreadMember {
    id: Snowflake;
    member_idx?: Snowflake;
    join_timestamp: string;
    muted: boolean;
    mute_config?: unknown;
    flags: number;
}

export interface ActiveThreadsResponse {
    threads: ActiveThreadsChannel[];
    members: ActiveThreadsThreadMember[];
}
