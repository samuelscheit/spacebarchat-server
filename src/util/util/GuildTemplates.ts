export type TemplateId = string | number;

export type TemplateRoleLike = {
    id?: TemplateId | null;
};

export type TemplateChannelPermissionOverwrite = {
    allow: string;
    deny: string;
    id: TemplateId;
    type: number;
};

export type TemplateChannelLike = {
    permission_overwrites?: TemplateChannelPermissionOverwrite[];
};

export type RemappedTemplateChannelPermissionOverwrite = Omit<TemplateChannelPermissionOverwrite, "id"> & {
    id: string;
};

export type RemappedTemplateChannelLike<T extends TemplateChannelLike> = Omit<T, "permission_overwrites"> & {
    permission_overwrites?: RemappedTemplateChannelPermissionOverwrite[];
};

export function normalizeTemplateId(id: TemplateId | null | undefined): string | undefined {
    if (id === null || id === undefined) return undefined;
    return String(id);
}

const ROLE_PERMISSION_OVERWRITE_TYPE = 0;

export function isTemplateEveryoneRoleId(roleId: TemplateId | null | undefined, sourceGuildId: TemplateId | null | undefined): boolean {
    const normalizedRoleId = normalizeTemplateId(roleId);
    if (!normalizedRoleId) return false;

    return normalizedRoleId === "0" || normalizedRoleId === normalizeTemplateId(sourceGuildId);
}

export function createTemplateRoleIdMap(roles: TemplateRoleLike[], sourceGuildId: string | null, guildId: string, generateId: () => string) {
    const roleIdMap = new Map<string, string>([["0", guildId]]);
    const normalizedSourceGuildId = normalizeTemplateId(sourceGuildId);
    if (normalizedSourceGuildId) roleIdMap.set(normalizedSourceGuildId, guildId);

    for (const role of roles) {
        const roleId = normalizeTemplateId(role.id);
        if (!roleId || roleIdMap.has(roleId)) continue;
        roleIdMap.set(roleId, generateId());
    }

    return roleIdMap;
}

export function getMappedTemplateRoleId(roleId: TemplateId | null | undefined, roleIdMap: Map<string, string>) {
    const normalizedRoleId = normalizeTemplateId(roleId);
    if (!normalizedRoleId) return undefined;
    return roleIdMap.get(normalizedRoleId);
}

export function remapTemplateChannelPermissionOverwrites<T extends TemplateChannelLike>(channels: T[], roleIdMap: Map<string, string>): RemappedTemplateChannelLike<T>[] {
    return channels.map((channel) => {
        if (!channel.permission_overwrites?.length) return channel as RemappedTemplateChannelLike<T>;

        return {
            ...channel,
            permission_overwrites: channel.permission_overwrites.flatMap((overwrite) => {
                // Guild templates can only safely preserve role overwrites that
                // point at roles recreated in the destination guild. Unknown
                // roles would keep source-guild IDs, and member overwrites would
                // grant/deny permissions to global user IDs outside the template.
                if (overwrite.type !== ROLE_PERMISSION_OVERWRITE_TYPE) return [];

                const mappedRoleId = getMappedTemplateRoleId(overwrite.id, roleIdMap);
                if (!mappedRoleId) return [];

                return [
                    {
                        ...overwrite,
                        id: mappedRoleId,
                    },
                ];
            }),
        } as RemappedTemplateChannelLike<T>;
    });
}
