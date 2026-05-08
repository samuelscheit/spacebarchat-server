import { getMostRelevantSession } from "@spacebar/util/util/SessionRelevance";
import type { Member, Presence, Role, Session } from "@spacebar/util";

export interface LazyMemberListMember {
    user: {
        id: string;
    };
    roles: string[];
    presence?: Presence;
    settings?: undefined;
}

export interface LazyMemberListOptions {
    includePresences?: boolean;
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

function getPublicSession(member: Member): Session | undefined {
    const session = getMostRelevantSession([...(member.user.sessions ?? [])]);
    if (!session) return undefined;

    return {
        ...session,
        status: session.status === "unknown" ? member.user.settings?.status || "online" : session.status,
    } as Session;
}

function isOnline(session?: Session) {
    return !!session && session.status !== "invisible" && session.status !== "offline";
}

function getRolePosition(role: Role) {
    return role.id === role.guild_id ? Number.NEGATIVE_INFINITY : role.position;
}

function compareRoles(left: Role, right: Role) {
    return getRolePosition(right) - getRolePosition(left) || left.id.localeCompare(right.id);
}

function getFallbackRole(guildId: string) {
    return { id: guildId, guild_id: guildId, position: Number.NEGATIVE_INFINITY } as Role;
}

function getMemberRoles(member: Member) {
    return member.roles ?? [];
}

function getHighestMemberRole(member: Member) {
    return getMemberRoles(member).reduce((highest, role) => (compareRoles(role, highest) < 0 ? role : highest), getFallbackRole(member.guild_id));
}

function compareMembers(left: Member, right: Member) {
    return compareRoles(getHighestMemberRole(left), getHighestMemberRole(right)) || left.user.username.localeCompare(right.user.username) || left.id.localeCompare(right.id);
}

function getOrderedRoles(members: Member[]) {
    return [
        ...new Map(
            members
                .flatMap((member) => getMemberRoles(member))
                .filter((role) => role.id)
                .map((role) => [role.id, role] as [string, Role]),
        ).values(),
    ].sort(compareRoles);
}

function getOrderedDisplayRoles(members: Member[], guildId: string) {
    return [...getOrderedRoles(members).filter((role) => role.id !== guildId && role.hoist), getFallbackRole(guildId)];
}

function getMemberDisplayRole(member: Member, orderedDisplayRoles: Role[], guildId: string) {
    return orderedDisplayRoles.find((role) => role.id !== guildId && getMemberRoles(member).some((memberRole) => memberRole.id === role.id)) ?? getFallbackRole(guildId);
}

function toMemberItem(member: Member, session: Session | undefined, options: LazyMemberListOptions = {}): LazyMemberListItem {
    const roles = getMemberRoles(member)
        .filter((role: Role) => role.id !== member.guild_id)
        .map((role: Role) => role.id);
    const status = session?.status === "invisible" ? "offline" : session?.status || "offline";
    const lazyMember = {
        ...member,
        roles,
        user: member.user.toPublicUser(),
    } as unknown as LazyMemberListMember;

    if (options.includePresences !== false) {
        lazyMember.presence = {
            activities: session?.activities || [],
            user: { id: member.user.id },
            client_status: session?.client_status ?? {},
            status,
        } as Presence;
    }

    return { member: lazyMember };
}

function getRangeBounds(range: [number, number]) {
    const start = Number.isFinite(Number(range[0])) ? Number(range[0]) : 0;
    const end = Number.isFinite(Number(range[1])) ? Number(range[1]) : 99;

    return [Math.max(start, 0), Math.max(end, start)] as const;
}

function getRangedMembers(items: LazyMemberListItem[]) {
    return items.flatMap((item) => (item.member ? [{ ...item.member, settings: undefined }] : []));
}

function buildLazyMemberListSnapshot(members: Member[], guildId: string, options: LazyMemberListOptions = {}): LazyMemberListSnapshot {
    const orderedDisplayRoles = getOrderedDisplayRoles(members, guildId);
    const membersWithSessions = members
        .map((member) => ({
            displayRole: getMemberDisplayRole(member, orderedDisplayRoles, guildId),
            member,
            session: options.includePresences === false ? undefined : getPublicSession(member),
        }))
        .sort((left, right) => {
            const statusOrder = Number(isOnline(right.session)) - Number(isOnline(left.session));
            if (statusOrder !== 0) return statusOrder;
            return compareMembers(left.member, right.member);
        });

    const onlineMembers = membersWithSessions.filter(({ session }) => isOnline(session));
    const offlineMembers = membersWithSessions.filter(({ session }) => !isOnline(session));
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
        items.push(...roleMembers.map(({ member, session }) => toMemberItem(member, session, options)));
    }

    if (offlineMembers.length) {
        const group = {
            count: offlineMembers.length,
            id: "offline",
        };
        items.push({ group });
        groups.push(group);
        items.push(...offlineMembers.map(({ member, session }) => toMemberItem(member, session, options)));
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

export function buildLazyMemberList(members: Member[], guildId: string, range: [number, number], options: LazyMemberListOptions = {}): LazyMemberListResult {
    return sliceLazyMemberList(buildLazyMemberListSnapshot(members, guildId, options), range);
}

export function buildLazyMemberListOperations(members: Member[], guildId: string, ranges: [number, number][], options: LazyMemberListOptions = {}): LazyMemberListOperationsResult {
    const snapshot = buildLazyMemberListSnapshot(members, guildId, options);

    return {
        groups: snapshot.groups,
        online_count: snapshot.online_count,
        ops: ranges.map((range) => ({
            ...sliceLazyMemberList(snapshot, range),
            range,
        })),
    };
}
