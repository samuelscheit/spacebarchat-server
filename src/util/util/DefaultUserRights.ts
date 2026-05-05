export interface DefaultUserRightsConfiguration {
    defaultRights: string;
    defaultBotRights?: string;
}

export function getDefaultUserRights(bot: boolean | undefined, config: DefaultUserRightsConfiguration) {
    if (bot) return config.defaultBotRights ?? config.defaultRights;
    return config.defaultRights;
}
