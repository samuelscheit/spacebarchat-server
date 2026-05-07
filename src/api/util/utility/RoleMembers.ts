export interface RoleMemberSnapshot {
    id: string;
    role_ids: string[];
}

export interface RoleMemberChanges {
    addMemberIds: string[];
    removeMemberIds: string[];
}

export type RoleMemberUpdateMode = "add" | "replace";

export function normalizeRoleMemberPatchIds(value: unknown): string[] {
    if (!Array.isArray(value) || value.some((id) => typeof id !== "string")) throw new TypeError("member_ids must be an array of strings");

    return [...new Set(value)];
}

export function getRoleMemberIdsToAdd(members: RoleMemberSnapshot[], requestedMemberIds: string[], roleId: string): string[] {
    const membersById = new Map(members.map((member) => [member.id, member]));

    return requestedMemberIds.filter((memberId) => {
        const member = membersById.get(memberId);

        return member && !member.role_ids.includes(roleId);
    });
}

export function getRoleMemberIdsToRemove(members: RoleMemberSnapshot[], requestedMemberIds: string[], roleId: string): string[] {
    const desiredMemberIds = new Set(requestedMemberIds);

    return members.filter((member) => member.role_ids.includes(roleId) && !desiredMemberIds.has(member.id)).map((member) => member.id);
}

export function getMissingRoleMemberIds(members: RoleMemberSnapshot[], requestedMemberIds: string[]): string[] {
    const foundMemberIds = new Set(members.map((member) => member.id));

    return requestedMemberIds.filter((memberId) => !foundMemberIds.has(memberId));
}

export function calculateRoleMemberAdditions(members: RoleMemberSnapshot[], memberIds: string[], roleId: string): RoleMemberChanges {
    const requestedMemberIds = normalizeRoleMemberPatchIds(memberIds);

    return {
        addMemberIds: getRoleMemberIdsToAdd(members, requestedMemberIds, roleId),
        removeMemberIds: [],
    };
}

export function calculateRoleMemberReplacement(members: RoleMemberSnapshot[], memberIds: string[], roleId: string): RoleMemberChanges {
    const requestedMemberIds = normalizeRoleMemberPatchIds(memberIds);

    return {
        addMemberIds: getRoleMemberIdsToAdd(members, requestedMemberIds, roleId),
        removeMemberIds: getRoleMemberIdsToRemove(members, requestedMemberIds, roleId),
    };
}

export function calculateRoleMemberChanges(members: RoleMemberSnapshot[], memberIds: string[], roleId: string, mode: RoleMemberUpdateMode): RoleMemberChanges {
    return mode === "replace" ? calculateRoleMemberReplacement(members, memberIds, roleId) : calculateRoleMemberAdditions(members, memberIds, roleId);
}
