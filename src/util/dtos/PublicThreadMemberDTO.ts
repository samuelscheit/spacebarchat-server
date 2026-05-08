import type { PublicThreadMember } from "@spacebar/schemas";

type ThreadMemberMuteConfigSource = {
    end_time?: Date | string;
    selected_time_window?: number;
} | null;

export type PublicThreadMemberSource = {
    id: string;
    join_timestamp?: Date | string;
    flags?: number;
    muted?: boolean;
    mute_config?: ThreadMemberMuteConfigSource;
    toJSON?: () => Record<string, unknown>;
};

type PublicThreadMemberSerializationOptions = {
    includeMuted?: boolean;
};

function toIsoString(value: Date | string | unknown): string {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "string") return value;
    throw new RangeError("thread member join_timestamp must be a valid timestamp");
}

function serializeMuteConfig(muteConfig: ThreadMemberMuteConfigSource | unknown): PublicThreadMember["mute_config"] | undefined {
    if (!muteConfig || typeof muteConfig !== "object") return undefined;
    const source = muteConfig as NonNullable<ThreadMemberMuteConfigSource>;

    return {
        ...source,
        end_time: source.end_time === undefined ? undefined : toIsoString(source.end_time),
    };
}

export function serializePublicThreadMember(threadMember: PublicThreadMemberSource, userId: string, options: PublicThreadMemberSerializationOptions = {}): PublicThreadMember {
    const json = threadMember.toJSON?.() ?? {};
    const joinTimestamp = json.join_timestamp ?? threadMember.join_timestamp;
    const muted = json.muted ?? threadMember.muted;
    const muteConfig = serializeMuteConfig(json.mute_config ?? threadMember.mute_config);

    return {
        id: threadMember.id,
        user_id: userId,
        join_timestamp: toIsoString(joinTimestamp),
        flags: (json.flags as number | undefined) ?? threadMember.flags ?? 0,
        ...(options.includeMuted && typeof muted === "boolean" ? { muted } : {}),
        ...(options.includeMuted && muteConfig ? { mute_config: muteConfig } : {}),
    };
}
