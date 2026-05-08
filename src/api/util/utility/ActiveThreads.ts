import { ChannelType } from "@spacebar/schemas/api/channels/Channel";
import { serializePublicThreadMember } from "@spacebar/util";

export type ActiveGuildThreadLike = {
    id: string;
    guild_id?: string | null;
    parent_id?: string | null;
    owner_id?: string | null;
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

export const ACTIVE_GUILD_THREAD_TYPES = [ChannelType.GUILD_NEWS_THREAD, ChannelType.GUILD_PUBLIC_THREAD, ChannelType.GUILD_PRIVATE_THREAD] as const;
const GUILD_PRIVATE_THREAD_TYPE = ChannelType.GUILD_PRIVATE_THREAD;
const threadTypes = new Set<number>(ACTIVE_GUILD_THREAD_TYPES);

export function isActiveGuildThread(thread: ActiveGuildThreadLike, guildId: string) {
    return thread.guild_id === guildId && threadTypes.has(thread.type) && thread.thread_metadata?.archived === false;
}

export function canAccessActiveGuildThread(
    thread: ActiveGuildThreadLike,
    guildId: string,
    joinedThreadIds: ReadonlySet<string>,
    parentPermissions: Map<string, PermissionLike>,
    viewerId?: string,
) {
    if (!isActiveGuildThread(thread, guildId)) return false;

    const parentId = thread.parent_id;
    if (!parentId) return false;

    const parentPermission = parentPermissions.get(parentId);
    if (!parentPermission?.has("VIEW_CHANNEL")) return false;

    if (thread.type === GUILD_PRIVATE_THREAD_TYPE) return joinedThreadIds.has(thread.id) || parentPermission.has("MANAGE_THREADS") || thread.owner_id === viewerId;
    return true;
}

export function filterAccessibleActiveGuildThreads(
    threads: ActiveGuildThreadLike[],
    guildId: string,
    joinedThreadIds: ReadonlySet<string>,
    parentPermissions: Map<string, PermissionLike>,
    viewerId?: string,
) {
    return threads.filter((thread) => canAccessActiveGuildThread(thread, guildId, joinedThreadIds, parentPermissions, viewerId));
}

export function serializeActiveThreadMember(threadMember: ThreadMemberLike, userId: string) {
    return serializePublicThreadMember(threadMember, userId);
}

export function serializeActiveGuildThreads(threads: ActiveGuildThreadLike[], threadMembers: ThreadMemberLike[], userId: string): ActiveThreadsResponseBody {
    const returnedThreadIds = new Set(threads.map((thread) => thread.id));

    return {
        threads: threads.map((thread) => thread.toJSON()),
        members: threadMembers.filter((threadMember) => returnedThreadIds.has(threadMember.id)).map((threadMember) => serializeActiveThreadMember(threadMember, userId)),
    };
}
