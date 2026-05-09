import type { ChannelPermissionOverwrite } from "@spacebar/schemas";
import { HTTPError } from "lambert-server";
import { Permissions, type PermissionCache } from "./Permissions";

const CHANNEL_PERMISSION_OVERWRITE_ROLE = 0;
const CHANNEL_PERMISSION_OVERWRITE_MEMBER = 1;

export type ResolveChannelPermissionOverwriteOptions = {
    requestedAllow: string;
    requestedDeny: string;
    existingAllow?: string;
    existingDeny?: string;
    /**
     * Permissions used to cap the requested allow/deny bits. Discord uses the
     * actor's guild permissions, or the parent channel permissions when the
     * edited channel has a parent.
     */
    actorPermissions?: Permissions;
    /**
     * Current-channel permissions are only used to decide whether the actor has
     * the MANAGE_ROLES overwrite exception in the channel being edited.
     */
    actorChannelPermissions?: Permissions;
    channelOverwrites?: ChannelPermissionOverwrite[];
};

export type ResolvedChannelPermissionOverwrite = {
    allow: string;
    deny: string;
};

export type ResolveChannelPermissionOverwritesOptions = Omit<ResolveChannelPermissionOverwriteOptions, "requestedAllow" | "requestedDeny" | "existingAllow" | "existingDeny"> & {
    requestedOverwrites: ChannelPermissionOverwrite[];
    existingOverwrites?: ChannelPermissionOverwrite[];
};

function parsePermissionOverwriteBitfield(value: string): bigint {
    if (!/^(?:0|[1-9]\d*)$/.test(value)) throw new HTTPError("Invalid permission overwrite bitfield", 400);

    return BigInt(value);
}

function getActorRoleIds(cache?: PermissionCache): Set<string> {
    const roleIds = new Set(cache?.roles?.map((role) => role.id) ?? []);
    if (cache?.guild?.id) roleIds.add(cache.guild.id);

    return roleIds;
}

function overwriteAppliesToActor(overwrite: ChannelPermissionOverwrite, cache?: PermissionCache) {
    if (overwrite.type === CHANNEL_PERMISSION_OVERWRITE_ROLE) return getActorRoleIds(cache).has(overwrite.id);
    if (overwrite.type === CHANNEL_PERMISSION_OVERWRITE_MEMBER) return overwrite.id === cache?.user_id;

    return false;
}

function actorHasManageRolesChannelOverwrite(actorPermissions?: Permissions, overwrites: ChannelPermissionOverwrite[] = []) {
    if (!actorPermissions?.has("MANAGE_ROLES")) return false;

    return overwrites.some(
        (overwrite) =>
            overwriteAppliesToActor(overwrite, actorPermissions.cache) &&
            (parsePermissionOverwriteBitfield(overwrite.allow) & Permissions.FLAGS.MANAGE_ROLES) === Permissions.FLAGS.MANAGE_ROLES,
    );
}

function getPermissionOverwriteMask(actorPermissions?: Permissions, actorChannelPermissions?: Permissions, channelOverwrites?: ChannelPermissionOverwrite[]) {
    const channelPermissions = actorChannelPermissions ?? actorPermissions;
    if (actorHasManageRolesChannelOverwrite(channelPermissions, channelOverwrites)) return Permissions.ALL_PERMISSIONS;

    return (actorPermissions?.bitfield ?? 0n) & Permissions.ALL_PERMISSIONS;
}

export function resolveChannelPermissionOverwritePermissions({
    requestedAllow,
    requestedDeny,
    existingAllow = "0",
    existingDeny = "0",
    actorPermissions,
    actorChannelPermissions,
    channelOverwrites,
}: ResolveChannelPermissionOverwriteOptions): ResolvedChannelPermissionOverwrite {
    const permissionMask = getPermissionOverwriteMask(actorPermissions, actorChannelPermissions, channelOverwrites);

    return {
        allow: String((parsePermissionOverwriteBitfield(existingAllow) & ~permissionMask) | (permissionMask & parsePermissionOverwriteBitfield(requestedAllow))),
        deny: String((parsePermissionOverwriteBitfield(existingDeny) & ~permissionMask) | (permissionMask & parsePermissionOverwriteBitfield(requestedDeny))),
    };
}

export function resolveChannelPermissionOverwrites({
    requestedOverwrites,
    existingOverwrites = [],
    actorPermissions,
    actorChannelPermissions,
    channelOverwrites,
}: ResolveChannelPermissionOverwritesOptions): ChannelPermissionOverwrite[] {
    const effectiveChannelOverwrites = channelOverwrites ?? existingOverwrites;
    const permissionMask = getPermissionOverwriteMask(actorPermissions, actorChannelPermissions, effectiveChannelOverwrites);
    const requestedIds = new Set(requestedOverwrites.map((overwrite) => overwrite.id));
    const existingById = new Map(existingOverwrites.map((overwrite) => [overwrite.id, overwrite]));
    const resolved = requestedOverwrites.map((overwrite) => {
        const existing = existingById.get(overwrite.id);
        return {
            ...overwrite,
            ...resolveChannelPermissionOverwritePermissions({
                requestedAllow: overwrite.allow,
                requestedDeny: overwrite.deny,
                existingAllow: existing?.allow,
                existingDeny: existing?.deny,
                actorPermissions,
                actorChannelPermissions,
                channelOverwrites: effectiveChannelOverwrites,
            }),
        };
    });

    for (const overwrite of existingOverwrites) {
        if (requestedIds.has(overwrite.id)) continue;

        const preservedAllow = parsePermissionOverwriteBitfield(overwrite.allow) & ~permissionMask;
        const preservedDeny = parsePermissionOverwriteBitfield(overwrite.deny) & ~permissionMask;
        if (!preservedAllow && !preservedDeny) continue;

        resolved.push({
            ...overwrite,
            allow: preservedAllow.toString(),
            deny: preservedDeny.toString(),
        });
    }

    return resolved;
}
