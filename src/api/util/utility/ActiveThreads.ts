type ThreadLike = {
    id: string;
    guild_id?: string | null;
    parent_id?: string | null;
    type: number;
    thread_metadata?: {
        archived?: boolean;
    } | null;
    toJSON: () => unknown;
};

type ThreadMemberLike = {
    id: string;
    join_timestamp?: Date | string;
    flags?: number;
    toJSON?: () => Record<string, unknown>;
};

type PermissionLike = {
    has: (permission: "VIEW_CHANNEL" | "MANAGE_THREADS") => boolean;
};

export type ActiveThreadsResponseBody = {
    threads: unknown[];
    members: unknown[];
};

export const ACTIVE_GUILD_THREAD_TYPES = [10, 11, 12] as const;
const GUILD_PRIVATE_THREAD_TYPE = 12;
const threadTypes = new Set<number>(ACTIVE_GUILD_THREAD_TYPES);

export function isActiveGuildThread(thread: ThreadLike, guildId: string) {
    return thread.guild_id === guildId && threadTypes.has(thread.type) && thread.thread_metadata?.archived === false;
}

export function canAccessActiveGuildThread(thread: ThreadLike, guildId: string, joinedThreadIds: Set<string>, parentPermissions: Map<string, PermissionLike>) {
    if (!isActiveGuildThread(thread, guildId)) return false;

    const parentId = thread.parent_id;
    if (!parentId) return false;

    const parentPermission = parentPermissions.get(parentId);
    if (!parentPermission?.has("VIEW_CHANNEL")) return false;

    if (thread.type === GUILD_PRIVATE_THREAD_TYPE) return joinedThreadIds.has(thread.id) || parentPermission.has("MANAGE_THREADS");
    return true;
}

export function filterAccessibleActiveGuildThreads(threads: ThreadLike[], guildId: string, joinedThreadIds: Set<string>, parentPermissions: Map<string, PermissionLike>) {
    return threads.filter((thread) => canAccessActiveGuildThread(thread, guildId, joinedThreadIds, parentPermissions));
}

export function serializeActiveThreadMember(threadMember: ThreadMemberLike, userId: string) {
    const json = threadMember.toJSON?.() ?? threadMember;
    const joinTimestamp = json.join_timestamp ?? threadMember.join_timestamp;

    return {
        id: threadMember.id,
        user_id: userId,
        join_timestamp: joinTimestamp instanceof Date ? joinTimestamp.toISOString() : joinTimestamp,
        flags: json.flags ?? threadMember.flags ?? 0,
    };
}

export function serializeActiveGuildThreads(threads: ThreadLike[], threadMembers: ThreadMemberLike[], userId: string): ActiveThreadsResponseBody {
    const returnedThreadIds = new Set(threads.map((thread) => thread.id));

    return {
        threads: threads.map((thread) => thread.toJSON()),
        members: threadMembers.filter((threadMember) => returnedThreadIds.has(threadMember.id)).map((threadMember) => serializeActiveThreadMember(threadMember, userId)),
    };
}
