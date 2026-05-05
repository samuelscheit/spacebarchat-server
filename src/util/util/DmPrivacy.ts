export interface RecipientDmPrivacySettings {
    default_guilds_restricted?: boolean | null;
    restricted_guilds?: string[] | null;
}

export interface ServerDmPrivacyCheck {
    isBlocked: boolean;
    isFriend: boolean;
    recipientSettings?: RecipientDmPrivacySettings | null;
    sharedGuildIds: string[];
}

export function canCreateServerDm({ isBlocked, isFriend, recipientSettings, sharedGuildIds }: ServerDmPrivacyCheck) {
    if (isBlocked) return false;
    if (isFriend) return true;
    if (sharedGuildIds.length === 0) return false;
    if (recipientSettings?.default_guilds_restricted) return false;

    const restrictedGuilds = new Set(recipientSettings?.restricted_guilds ?? []);
    return sharedGuildIds.some((guildId) => !restrictedGuilds.has(guildId));
}
