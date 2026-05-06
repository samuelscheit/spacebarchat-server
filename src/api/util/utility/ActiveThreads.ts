import { ChannelType } from "@spacebar/schemas/api/channels/Channel";

export const ACTIVE_THREAD_TYPES = [ChannelType.GUILD_NEWS_THREAD, ChannelType.GUILD_PUBLIC_THREAD, ChannelType.GUILD_PRIVATE_THREAD] as const;

export type ActiveThreadType = (typeof ACTIVE_THREAD_TYPES)[number];

export interface ActiveThreadLike {
    id: string;
    type: ActiveThreadType;
    owner_id?: string | null;
    thread_metadata?: {
        archived?: boolean;
        [metadataField: string]: unknown;
    } | null;
}

export function isActiveThread(thread: ActiveThreadLike) {
    return thread.thread_metadata?.archived === false;
}

export function canSeeActiveThread(thread: ActiveThreadLike, joinedThreadIds: ReadonlySet<string>, canManageThreads: boolean, viewerId?: string) {
    if (!isActiveThread(thread)) return false;
    if (thread.type !== ChannelType.GUILD_PRIVATE_THREAD) return true;

    return canManageThreads || joinedThreadIds.has(thread.id) || (viewerId !== undefined && thread.owner_id === viewerId);
}

export function filterVisibleActiveThreads<T extends ActiveThreadLike>(threads: T[], joinedThreadIds: ReadonlySet<string>, canManageThreads: boolean, viewerId?: string) {
    return threads.filter((thread) => canSeeActiveThread(thread, joinedThreadIds, canManageThreads, viewerId));
}
