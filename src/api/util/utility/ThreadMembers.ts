import type { ThreadMemberSettingsUpdateSchema } from "@spacebar/schemas";
import { FieldErrors, ThreadMemberFlags } from "@spacebar/util";
import type { ThreadMember } from "@spacebar/util";
import { HTTPError } from "lambert-server";

export const DEFAULT_THREAD_MEMBER_LIMIT = 100;
export const MAX_THREAD_MEMBER_LIMIT = 100;
export const MUTABLE_THREAD_MEMBER_FLAGS = ThreadMemberFlags.ALL_MESSAGES | ThreadMemberFlags.ONLY_MENTIONS | ThreadMemberFlags.NO_MESSAGES;
export const VALID_THREAD_MEMBER_FLAGS = ThreadMemberFlags.HAS_INTERACTED | MUTABLE_THREAD_MEMBER_FLAGS;

export interface PublicThreadMemberMuteConfig {
    end_time?: string;
    selected_time_window?: number;
}

export interface PublicThreadMember {
    id: string;
    user_id: string;
    join_timestamp: string;
    flags: number;
    muted?: boolean;
    mute_config?: PublicThreadMemberMuteConfig;
}

export interface ThreadMemberSettingsMutationResult {
    changed: boolean;
    threadMember: ThreadMember;
}

export function parseThreadMemberLimit(value: string | undefined) {
    if (value === undefined) return DEFAULT_THREAD_MEMBER_LIMIT;

    const limit = Number(value);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_THREAD_MEMBER_LIMIT) {
        throw new HTTPError(`limit must be between 1 and ${MAX_THREAD_MEMBER_LIMIT}`, 422);
    }

    return limit;
}

export function parseThreadMemberWithMember(value: string | undefined) {
    return value === "true";
}

export function resolveThreadMemberUserId(value: string, currentUserId: string) {
    return value === "@me" ? currentUserId : value;
}

export function assertThreadIsNotArchived(thread: { thread_metadata?: { archived?: boolean } }) {
    if (thread.thread_metadata?.archived) throw new RangeError("Cannot modify archived thread members");
}

export function assertValidThreadMemberSettingsFlags(flags: number) {
    if (!Number.isInteger(flags) || flags < 0 || (flags & ~VALID_THREAD_MEMBER_FLAGS) !== 0) {
        throw FieldErrors({ flags: { message: "Value must be a valid thread member flags bitfield" } });
    }

    if ((flags & ThreadMemberFlags.HAS_INTERACTED) !== 0) {
        throw FieldErrors({ flags: { message: "HAS_INTERACTED is managed by the server and cannot be set by clients" } });
    }
}

export function applyThreadMemberSettingsUpdate(threadMember: ThreadMember, body: ThreadMemberSettingsUpdateSchema): ThreadMemberSettingsMutationResult {
    let changed = false;

    if (body.flags !== undefined) {
        assertValidThreadMemberSettingsFlags(body.flags);
        const nextFlags = (threadMember.flags & ThreadMemberFlags.HAS_INTERACTED) | body.flags;
        if (threadMember.flags !== nextFlags) {
            threadMember.flags = nextFlags;
            changed = true;
        }
    }

    if (body.muted !== undefined && threadMember.muted !== body.muted) {
        threadMember.muted = body.muted;
        changed = true;
    }

    if (body.mute_config !== undefined) {
        const nextMuteConfig = normalizeThreadMemberMuteConfig(body.mute_config);
        if (!threadMemberMuteConfigsEqual(threadMember.mute_config, nextMuteConfig)) {
            threadMember.mute_config = nextMuteConfig;
            changed = true;
        }
    }

    return { changed, threadMember };
}

export function serializePublicThreadMember(
    threadMember: Pick<ThreadMember, "id" | "join_timestamp" | "flags" | "muted" | "mute_config">,
    userId: string,
): PublicThreadMember {
    return {
        id: threadMember.id,
        user_id: userId,
        join_timestamp: toIsoString(threadMember.join_timestamp) as string,
        flags: threadMember.flags,
        muted: threadMember.muted,
        mute_config: serializeThreadMemberMuteConfig(threadMember.mute_config),
    };
}

function normalizeThreadMemberMuteConfig(muteConfig: ThreadMemberSettingsUpdateSchema["mute_config"]): ThreadMember["mute_config"] {
    if (!muteConfig) return undefined;

    return {
        ...muteConfig,
        end_time: muteConfig.end_time === undefined ? undefined : toDate(muteConfig.end_time),
    };
}

function serializeThreadMemberMuteConfig(muteConfig: ThreadMember["mute_config"]): PublicThreadMemberMuteConfig | undefined {
    if (!muteConfig) return undefined;

    return {
        ...muteConfig,
        end_time: toIsoString(muteConfig.end_time),
    };
}

function threadMemberMuteConfigsEqual(left: ThreadMember["mute_config"], right: ThreadMember["mute_config"]) {
    return JSON.stringify(serializeThreadMemberMuteConfig(left)) === JSON.stringify(serializeThreadMemberMuteConfig(right));
}

function toIsoString(value: Date | string | undefined): string | undefined {
    if (value === undefined) return undefined;
    return value instanceof Date ? value.toISOString() : value;
}

function toDate(value: Date | string): Date {
    return value instanceof Date ? value : new Date(value);
}

type QueryParameters = Record<string, unknown>;

export interface ThreadMemberListQueryBuilder<TBuilder> {
    innerJoin(relation: string, alias: string): TBuilder;
    leftJoinAndSelect(relation: string, alias: string): TBuilder;
    where(condition: string, parameters?: QueryParameters): TBuilder;
    andWhere(condition: string, parameters?: QueryParameters): TBuilder;
    orderBy(sort: string, order?: "ASC" | "DESC"): TBuilder;
    take(take?: number): TBuilder;
}

export interface ThreadMemberListQueryOptions {
    threadId: string;
    afterUserId?: string;
    limit: number;
    withMember: boolean;
    alias?: string;
    memberAlias?: string;
}

export function applyThreadMemberListQuery<TBuilder extends ThreadMemberListQueryBuilder<TBuilder>>(
    query: TBuilder,
    { afterUserId, alias = "thread_member", limit, memberAlias = "member", threadId, withMember }: ThreadMemberListQueryOptions,
) {
    let builder = query.where(`"${alias}"."id" = :threadId`, { threadId });

    if (withMember) builder = builder.leftJoinAndSelect(`${alias}.member`, memberAlias);
    else builder = builder.innerJoin(`${alias}.member`, memberAlias);

    if (afterUserId) builder = builder.andWhere(`"${memberAlias}"."id" > :afterUserId`, { afterUserId });

    return builder.orderBy(`"${memberAlias}"."id"`, "ASC").take(limit);
}
