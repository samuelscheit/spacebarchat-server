export const MAX_FILTERED_GUILD_MEMBERS_REQUEST = 100;

export function normalizeGuildMembersRequestLimit(query: string | undefined, userIds: string[] | undefined, limit: number | undefined) {
    if (!query && !userIds?.length) return limit;

    if (!limit || limit > MAX_FILTERED_GUILD_MEMBERS_REQUEST) return MAX_FILTERED_GUILD_MEMBERS_REQUEST;

    return limit;
}
