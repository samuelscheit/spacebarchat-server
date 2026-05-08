export enum GuildFeature {
    AliasableNames = "ALIASABLE_NAMES",
    AllowExistingThreadForMessage = "ALLOW_EXISTING_THREAD_FOR_MESSAGE",
    AllowInvalidChannelNames = "ALLOW_INVALID_CHANNEL_NAMES",
    AllowUnnamedChannels = "ALLOW_UNNAMED_CHANNELS",
    Community = "COMMUNITY",
    Discoverable = "DISCOVERABLE",
    InternalEmployeeOnly = "INTERNAL_EMPLOYEE_ONLY",
    InvitesDisabled = "INVITES_DISABLED",
    IrcLikeCategoryNames = "IRC_LIKE_CATEGORY_NAMES",
    News = "NEWS",
    VanityUrl = "VANITY_URL",
    VipRegions = "VIP_REGIONS",
}

export const VANITY_URL_FEATURE = GuildFeature.VanityUrl;

export function setVanityUrlFeature(features: readonly GuildFeature[] | null | undefined, hasVanityUrl: boolean) {
    const filteredFeatures = (features ?? []).filter((feature) => feature !== GuildFeature.VanityUrl);

    if (!hasVanityUrl) {
        return filteredFeatures;
    }

    return [...filteredFeatures, GuildFeature.VanityUrl];
}

export function getVanityUrlFeatureState(features: readonly GuildFeature[] | null | undefined, hasVanityUrl: boolean) {
    const currentFeatures = features ?? [];
    const updatedFeatures = setVanityUrlFeature(currentFeatures, hasVanityUrl);

    return {
        features: updatedFeatures,
        changed: currentFeatures.length !== updatedFeatures.length || currentFeatures.some((feature, index) => feature !== updatedFeatures[index]),
    };
}
