import type { Member, Presence, Role, Session } from "@spacebar/util";
import { compareMembersByRole, getFallbackRole, getMemberRoles, getOrderedRoles, getPublicSession, isPublicOnlineSession } from "./GuildMemberOrdering";

export interface LazyMemberListMember {
    user: {
        id: string;
    };
    roles: string[];
    presence: Presence;
    settings?: undefined;
}

export interface LazyMemberListItem {
    member?: LazyMemberListMember;
    group?: {
        count: number;
        id: string;
    };
}

export interface LazyMemberListResult {
    items: LazyMemberListItem[];
    groups: { count: number; id: string }[];
    members: LazyMemberListMember[];
    online_count: number;
}

export interface LazyMemberListOperation extends LazyMemberListResult {
    range: [number, number];
}

export interface LazyMemberListOperationsResult {
    ops: LazyMemberListOperation[];
    groups: { count: number; id: string }[];
    online_count: number;
}

interface LazyMemberListSnapshot {
    items: LazyMemberListItem[];
    groups: { count: number; id: string }[];
    online_count: number;
}

function getOrderedDisplayRoles(members: Member[], guildId: string) {
    return [...getOrderedRoles(members).filter((role) => role.id !== guildId && role.hoist), getFallbackRole(guildId)];
}

function getMemberDisplayRole(member: Member, orderedDisplayRoles: Role[], guildId: string) {
    return orderedDisplayRoles.find((role) => role.id !== guildId && getMemberRoles(member).some((memberRole) => memberRole.id === role.id)) ?? getFallbackRole(guildId);
}

function toMemberItem(member: Member, session: Session | undefined): LazyMemberListItem {
    const roles = getMemberRoles(member)
        .filter((role: Role) => role.id !== member.guild_id)
        .map((role: Role) => role.id);
    const status = session?.status === "invisible" ? "offline" : session?.status || "offline";

    return {
        member: {
            ...member,
            roles,
            user: member.user.toPublicUser(),
            presence: {
                activities: session?.activities || [],
                user: { id: member.user.id },
                client_status: session?.client_status ?? {},
                status,
            },
        } as unknown as LazyMemberListMember,
    };
}

function getRangeBounds(range: [number, number]) {
    const start = Number.isFinite(Number(range[0])) ? Number(range[0]) : 0;
    const end = Number.isFinite(Number(range[1])) ? Number(range[1]) : 99;

    return [Math.max(start, 0), Math.max(end, start)] as const;
}

function getRangedMembers(items: LazyMemberListItem[]) {
    return items.flatMap((item) => (item.member ? [{ ...item.member, settings: undefined }] : []));
}

function buildLazyMemberListSnapshot(members: Member[], guildId: string): LazyMemberListSnapshot {
    const orderedDisplayRoles = getOrderedDisplayRoles(members, guildId);
    const membersWithSessions = members
        .map((member) => ({
            displayRole: getMemberDisplayRole(member, orderedDisplayRoles, guildId),
            member,
            session: getPublicSession(member),
        }))
        .sort((left, right) => {
            const statusOrder = Number(isPublicOnlineSession(right.session)) - Number(isPublicOnlineSession(left.session));
            if (statusOrder !== 0) return statusOrder;
            return compareMembersByRole(left.member, right.member);
        });

    const onlineMembers = membersWithSessions.filter(({ session }) => isPublicOnlineSession(session));
    const offlineMembers = membersWithSessions.filter(({ session }) => !isPublicOnlineSession(session));
    const groups: { count: number; id: string }[] = [];
    const items: LazyMemberListItem[] = [];

    for (const role of orderedDisplayRoles) {
        const roleMembers = onlineMembers.filter(({ displayRole }) => displayRole.id === role.id);
        if (!roleMembers.length) continue;

        const group = {
            count: roleMembers.length,
            id: role.id === guildId ? "online" : role.id,
        };
        items.push({ group });
        groups.push(group);
        items.push(...roleMembers.map(({ member, session }) => toMemberItem(member, session)));
    }

    if (offlineMembers.length) {
        const group = {
            count: offlineMembers.length,
            id: "offline",
        };
        items.push({ group });
        groups.push(group);
        items.push(...offlineMembers.map(({ member, session }) => toMemberItem(member, session)));
    }

    return {
        groups,
        items,
        online_count: onlineMembers.length,
    };
}

function sliceLazyMemberList(snapshot: LazyMemberListSnapshot, range: [number, number]): LazyMemberListResult {
    const [start, end] = getRangeBounds(range);
    const rangedItems = snapshot.items.slice(start, end + 1);

    return {
        groups: snapshot.groups,
        items: rangedItems,
        members: getRangedMembers(rangedItems),
        online_count: snapshot.online_count,
    };
}

export function buildLazyMemberList(members: Member[], guildId: string, range: [number, number]): LazyMemberListResult {
    return sliceLazyMemberList(buildLazyMemberListSnapshot(members, guildId), range);
}

export function buildLazyMemberListOperations(members: Member[], guildId: string, ranges: [number, number][]): LazyMemberListOperationsResult {
    const snapshot = buildLazyMemberListSnapshot(members, guildId);

    return {
        groups: snapshot.groups,
        online_count: snapshot.online_count,
        ops: ranges.map((range) => ({
            ...sliceLazyMemberList(snapshot, range),
            range,
        })),
    };
}
