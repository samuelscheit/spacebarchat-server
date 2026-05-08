import type { ChannelPermissionOverwrite } from "@spacebar/schemas";
import { Permissions, type PermissionCache } from "./Permissions";

const CHANNEL_PERMISSION_OVERWRITE_ROLE = 0;
const CHANNEL_PERMISSION_OVERWRITE_MEMBER = 1;

export type ResolveChannelPermissionOverwriteOptions = {
    requestedAllow: string;
    requestedDeny: string;
    actorPermissions?: Permissions;
    channelOverwrites?: ChannelPermissionOverwrite[];
};

export type ResolvedChannelPermissionOverwrite = {
    allow: string;
    deny: string;
};

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
        (overwrite) => overwriteAppliesToActor(overwrite, actorPermissions.cache) && (BigInt(overwrite.allow) & Permissions.FLAGS.MANAGE_ROLES) === Permissions.FLAGS.MANAGE_ROLES,
    );
}

export function resolveChannelPermissionOverwritePermissions({
    requestedAllow,
    requestedDeny,
    actorPermissions,
    channelOverwrites,
}: ResolveChannelPermissionOverwriteOptions): ResolvedChannelPermissionOverwrite {
    const permissionMask = actorHasManageRolesChannelOverwrite(actorPermissions, channelOverwrites) ? Permissions.ALL_PERMISSIONS : (actorPermissions?.bitfield ?? 0n);

    return {
        allow: String(permissionMask & BigInt(requestedAllow || "0")),
        deny: String(permissionMask & BigInt(requestedDeny || "0")),
    };
}
