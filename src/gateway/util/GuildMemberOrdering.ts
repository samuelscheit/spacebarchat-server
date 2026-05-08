import type { Member, Role, Session } from "@spacebar/util";
import { getMostRelevantSession } from "@spacebar/util/util/SessionRelevance";

export interface GuildMemberWithSession {
    member: Member;
    session?: Session;
}

function getRolePosition(role: Role) {
    return role.id === role.guild_id ? Number.NEGATIVE_INFINITY : role.position;
}

export function compareRoles(left: Role, right: Role) {
    return getRolePosition(right) - getRolePosition(left) || left.id.localeCompare(right.id);
}

export function getFallbackRole(guildId: string) {
    return { id: guildId, guild_id: guildId, position: Number.NEGATIVE_INFINITY } as Role;
}

export function getMemberRoles(member: Member) {
    return member.roles ?? [];
}

export function getHighestMemberRole(member: Member) {
    return getMemberRoles(member).reduce((highest, role) => (compareRoles(role, highest) < 0 ? role : highest), getFallbackRole(member.guild_id));
}

export function compareMembersByRole(left: Member, right: Member) {
    return compareRoles(getHighestMemberRole(left), getHighestMemberRole(right)) || left.user.username.localeCompare(right.user.username) || left.id.localeCompare(right.id);
}

export function getOrderedRoles(members: Member[]) {
    return [
        ...new Map(
            members
                .flatMap((member) => getMemberRoles(member))
                .filter((role) => role.id)
                .map((role) => [role.id, role] as [string, Role]),
        ).values(),
    ].sort(compareRoles);
}

export function isPublicOnlineSession(session?: Session): session is Session {
    return !!session && session.status !== "invisible" && session.status !== "offline";
}

export function getPublicSession(member: Member): Session | undefined {
    const session = getMostRelevantSession([...(member.user.sessions ?? [])]);
    if (!session) return undefined;

    return {
        ...session,
        status: session.status === "unknown" ? member.user.settings?.status || "online" : session.status,
    } as Session;
}

export function sortMembersByRole(members: Member[]) {
    return [...members].sort(compareMembersByRole);
}
