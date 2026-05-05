export type TemplateRoleLike = {
    id?: string | null;
};

export type TemplateChannelPermissionOverwrite = {
    allow: string;
    deny: string;
    id: string;
    type: number;
};

export type TemplateChannelLike = {
    permission_overwrites?: TemplateChannelPermissionOverwrite[];
};

const ROLE_PERMISSION_OVERWRITE_TYPE = 0;

export function createTemplateRoleIdMap(roles: TemplateRoleLike[], sourceGuildId: string | null, guildId: string, generateId: () => string) {
    const roleIdMap = new Map<string, string>([["0", guildId]]);
    if (sourceGuildId) roleIdMap.set(sourceGuildId, guildId);

    for (const role of roles) {
        if (!role.id || roleIdMap.has(role.id)) continue;
        roleIdMap.set(role.id, generateId());
    }

    return roleIdMap;
}

export function remapTemplateChannelPermissionOverwrites<T extends TemplateChannelLike>(channels: T[], roleIdMap: Map<string, string>): T[] {
    return channels.map((channel) => {
        if (!channel.permission_overwrites?.length) return channel;

        return {
            ...channel,
            permission_overwrites: channel.permission_overwrites.map((overwrite) => {
                if (overwrite.type !== ROLE_PERMISSION_OVERWRITE_TYPE) return overwrite;

                return {
                    ...overwrite,
                    id: roleIdMap.get(overwrite.id) ?? overwrite.id,
                };
            }),
        };
    });
}
