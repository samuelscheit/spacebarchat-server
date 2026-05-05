export interface RoleMentionLike {
    id: string;
}

export function serializeMessageRoleMentions(roles: RoleMentionLike[] | null | undefined) {
    return (roles ?? []).map((role) => role.id);
}
