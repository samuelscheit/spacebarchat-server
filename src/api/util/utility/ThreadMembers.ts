import { ThreadMember } from "@spacebar/util";
import { HTTPError } from "lambert-server";

export const DEFAULT_THREAD_MEMBER_LIMIT = 100;
export const MAX_THREAD_MEMBER_LIMIT = 100;

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

export interface ThreadMemberCountThread {
    id: string;
    member_count?: number | null;
    save(): Promise<unknown>;
}

export type ThreadMemberCountReader = (threadId: string) => Promise<number>;

export async function syncThreadMemberCount(thread: ThreadMemberCountThread, countThreadMembers: ThreadMemberCountReader) {
    thread.member_count = await countThreadMembers(thread.id);
    await thread.save();

    return thread.member_count;
}

export const countPersistedThreadMembers: ThreadMemberCountReader = (threadId) => ThreadMember.countBy({ id: threadId });

export async function syncPersistedThreadMemberCount(thread: ThreadMemberCountThread) {
    return await syncThreadMemberCount(thread, countPersistedThreadMembers);
}

type QueryParameters = Record<string, unknown>;

export interface ThreadMemberListQueryBuilder<TBuilder> {
    innerJoin(relation: string, alias: string): TBuilder;
    leftJoinAndSelect(relation: string, alias: string): TBuilder;
    addSelect(selection: string): TBuilder;
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
    let builder = query.where(`${alias}.id = :threadId`, { threadId });

    if (withMember) builder = builder.leftJoinAndSelect(`${alias}.member`, memberAlias);
    else builder = builder.innerJoin(`${alias}.member`, memberAlias).addSelect(`${memberAlias}.id`);

    if (afterUserId) builder = builder.andWhere(`${memberAlias}.id > :afterUserId`, { afterUserId });

    return builder.orderBy(`${memberAlias}.id`, "ASC").take(limit);
}
