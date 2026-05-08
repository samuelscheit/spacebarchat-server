export enum GuildFeature {
    AliasableNames = "ALIASABLE_NAMES",
    AllowExistingThreadForMessage = "ALLOW_EXISTING_THREAD_FOR_MESSAGE",
    AllowInvalidChannelNames = "ALLOW_INVALID_CHANNEL_NAMES",
    AllowUnnamedChannels = "ALLOW_UNNAMED_CHANNELS",
    AnimatedIcon = "ANIMATED_ICON",
    Banner = "BANNER",
    Commerce = "COMMERCE",
    Community = "COMMUNITY",
    Discoverable = "DISCOVERABLE",
    DiscoverableDisabled = "DISCOVERABLE_DISABLED",
    EnabledDiscoverableBefore = "ENABLED_DISCOVERABLE_BEFORE",
    Hub = "HUB",
    InternalEmployeeOnly = "INTERNAL_EMPLOYEE_ONLY",
    InviteSplash = "INVITE_SPLASH",
    InvitesDisabled = "INVITES_DISABLED",
    IrcLikeCategoryNames = "IRC_LIKE_CATEGORY_NAMES",
    MonetizationEnabled = "MONETIZATION_ENABLED",
    MoreEmoji = "MORE_EMOJI",
    MoreStickers = "MORE_STICKERS",
    News = "NEWS",
    Partnered = "PARTNERED",
    PreviewEnabled = "PREVIEW_ENABLED",
    PrivateThreads = "PRIVATE_THREADS",
    SevenDayThreadArchive = "SEVEN_DAY_THREAD_ARCHIVE",
    ThreeDayThreadArchive = "THREE_DAY_THREAD_ARCHIVE",
    ThreadsEnabled = "THREADS_ENABLED",
    TicketedEventsEnabled = "TICKETED_EVENTS_ENABLED",
    VanityUrl = "VANITY_URL",
    Verified = "VERIFIED",
    VipRegions = "VIP_REGIONS",
    WelcomeScreenEnabled = "WELCOME_SCREEN_ENABLED",
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
