import { DiscordApiErrors } from "./Constants";

export type RoleHierarchyRole = {
    id: string;
    position: number;
};

export function resolveCreatedRolePermissions(options: { requested?: string; everyone?: string; actor?: bigint }) {
    const fallback = options.everyone ?? "0";
    const requested = options.requested && options.requested !== "0" ? options.requested : fallback;
    const actorPermissions = options.actor ?? 0n;

    return String(actorPermissions & BigInt(requested));
}

export function getHighestRolePosition(roles: readonly RoleHierarchyRole[] | null | undefined) {
    return roles?.reduce((highest, role) => Math.max(highest, role.position), Number.NEGATIVE_INFINITY) ?? Number.NEGATIVE_INFINITY;
}

export function canManageRole(options: { actorId: string; guildOwnerId?: string | null; actorRoles?: readonly RoleHierarchyRole[] | null; targetRole: RoleHierarchyRole }) {
    if (options.guildOwnerId && options.actorId === options.guildOwnerId) return true;
    return getHighestRolePosition(options.actorRoles) > options.targetRole.position;
}

export function assertCanManageRole(options: { actorId: string; guildOwnerId?: string | null; actorRoles?: readonly RoleHierarchyRole[] | null; targetRole: RoleHierarchyRole }) {
    if (!canManageRole(options)) throw DiscordApiErrors.MISSING_PERMISSIONS.withParams("MANAGE_ROLES");
}
