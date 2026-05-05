export type MemberRoleLike = string | { id: string };

export function serializeMemberRoleIds(roles: MemberRoleLike[] | null | undefined) {
    return (roles ?? []).map((role) => (typeof role === "string" ? role : role.id));
}
