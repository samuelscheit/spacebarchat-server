import { assertCanManageRole, Guild, Member, type RoleHierarchyRole } from "@spacebar/util";

export type GuildRoleHierarchyTarget = RoleHierarchyRole & {
    requestedPosition?: number;
};

export async function assertCanManageGuildRole(options: { actorId: string; guildId: string; targetRole: GuildRoleHierarchyTarget }) {
    await assertCanManageGuildRoles({
        actorId: options.actorId,
        guildId: options.guildId,
        targetRoles: [options.targetRole],
    });
}

export async function assertCanManageGuildRoles(options: { actorId: string; guildId: string; targetRoles: readonly GuildRoleHierarchyTarget[] }) {
    if (!options.targetRoles.length) return;

    const [guild, member] = await Promise.all([
        Guild.findOneOrFail({
            where: { id: options.guildId },
            select: { id: true, owner_id: true },
        }),
        Member.findOneOrFail({
            where: { id: options.actorId, guild_id: options.guildId },
            relations: { roles: true },
            select: {
                index: true,
                id: true,
                guild_id: true,
                roles: {
                    id: true,
                    position: true,
                },
            },
        }),
    ]);

    for (const targetRole of options.targetRoles) {
        assertCanManageRole({
            actorId: options.actorId,
            guildOwnerId: guild.owner_id,
            actorRoles: member.roles,
            targetRole,
            requestedPosition: targetRole.requestedPosition,
        });
    }
}
