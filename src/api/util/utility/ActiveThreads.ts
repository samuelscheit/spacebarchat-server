export const GUILD_NEWS_THREAD = 10;
export const GUILD_PUBLIC_THREAD = 11;
export const GUILD_PRIVATE_THREAD = 12;

interface ActiveThreadLike {
    id: string;
    type: number;
    thread_metadata?: {
        archived?: boolean;
    } | null;
}

export function isActiveThread(thread: ActiveThreadLike) {
    return thread.thread_metadata?.archived === false;
}

export function canSeeActiveThread(thread: ActiveThreadLike, joinedThreadIds: ReadonlySet<string>, canManageThreads: boolean) {
    if (!isActiveThread(thread)) return false;
    if (thread.type !== GUILD_PRIVATE_THREAD) return true;

    return canManageThreads || joinedThreadIds.has(thread.id);
}

export function filterVisibleActiveThreads<T extends ActiveThreadLike>(threads: T[], joinedThreadIds: ReadonlySet<string>, canManageThreads: boolean) {
    return threads.filter((thread) => canSeeActiveThread(thread, joinedThreadIds, canManageThreads));
}
