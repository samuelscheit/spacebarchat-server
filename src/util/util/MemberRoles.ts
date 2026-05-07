export type MemberRoleLike = string | { id: string };
export type PublicMemberLike = object & {
    roles?: MemberRoleLike[] | null;
    toPublicMember?: () => PublicMemberLike;
};

export function serializeMemberRoleIds(roles: MemberRoleLike[] | null | undefined) {
    return (roles ?? []).map((role) => (typeof role === "string" ? role : role.id));
}

export function serializePublicMember<T extends PublicMemberLike>(member: T | null | undefined) {
    if (!member) return undefined;

    const publicMember = typeof member.toPublicMember === "function" ? member.toPublicMember() : member;
    return {
        ...publicMember,
        roles: publicMember.roles == null ? publicMember.roles : serializeMemberRoleIds(publicMember.roles),
    };
}
