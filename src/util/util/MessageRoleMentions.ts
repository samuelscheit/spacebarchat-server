export interface RoleMentionLike {
    id: string;
}

export type SerializableRoleMention = RoleMentionLike | string;

export function serializeMessageRoleMentions(roles: SerializableRoleMention[] | null | undefined) {
    return (roles ?? []).map((role) => (typeof role === "string" ? role : role.id));
}
