export const GuildFeature = {
    AliasableNames: "ALIASABLE_NAMES",
    AllowExistingThreadForMessage: "ALLOW_EXISTING_THREAD_FOR_MESSAGE",
    AllowInvalidChannelNames: "ALLOW_INVALID_CHANNEL_NAMES",
    AllowUnnamedChannels: "ALLOW_UNNAMED_CHANNELS",
    AnimatedBanner: "ANIMATED_BANNER",
    AnimatedIcon: "ANIMATED_ICON",
    ApplicationCommandPermissionsV2: "APPLICATION_COMMAND_PERMISSIONS_V2",
    AutoModeration: "AUTO_MODERATION",
    Banner: "BANNER",
    Commerce: "COMMERCE",
    Community: "COMMUNITY",
    CreatorMonetizableProvisional: "CREATOR_MONETIZABLE_PROVISIONAL",
    CreatorStorePage: "CREATOR_STORE_PAGE",
    DeveloperSupportServer: "DEVELOPER_SUPPORT_SERVER",
    Discoverable: "DISCOVERABLE",
    DiscoverableDisabled: "DISCOVERABLE_DISABLED",
    EnabledDiscoverableBefore: "ENABLED_DISCOVERABLE_BEFORE",
    EnhancedRoleColors: "ENHANCED_ROLE_COLORS",
    Featurable: "FEATURABLE",
    GuestsEnabled: "GUESTS_ENABLED",
    GuildTags: "GUILD_TAGS",
    Hub: "HUB",
    InternalEmployeeOnly: "INTERNAL_EMPLOYEE_ONLY",
    InviteSplash: "INVITE_SPLASH",
    InvitesDisabled: "INVITES_DISABLED",
    IrcLikeCategoryNames: "IRC_LIKE_CATEGORY_NAMES",
    MemberVerificationGateEnabled: "MEMBER_VERIFICATION_GATE_ENABLED",
    MonetizationEnabled: "MONETIZATION_ENABLED",
    MoreEmoji: "MORE_EMOJI",
    MoreSoundboard: "MORE_SOUNDBOARD",
    MoreStickers: "MORE_STICKERS",
    News: "NEWS",
    Partnered: "PARTNERED",
    PreviewEnabled: "PREVIEW_ENABLED",
    PrivateThreads: "PRIVATE_THREADS",
    RaidAlertsDisabled: "RAID_ALERTS_DISABLED",
    RoleIcons: "ROLE_ICONS",
    RoleSubscriptionsAvailableForPurchase: "ROLE_SUBSCRIPTIONS_AVAILABLE_FOR_PURCHASE",
    RoleSubscriptionsEnabled: "ROLE_SUBSCRIPTIONS_ENABLED",
    SevenDayThreadArchive: "SEVEN_DAY_THREAD_ARCHIVE",
    Soundboard: "SOUNDBOARD",
    ThreeDayThreadArchive: "THREE_DAY_THREAD_ARCHIVE",
    ThreadsEnabled: "THREADS_ENABLED",
    TicketedEventsEnabled: "TICKETED_EVENTS_ENABLED",
    VanityUrl: "VANITY_URL",
    Verified: "VERIFIED",
    VipRegions: "VIP_REGIONS",
    WelcomeScreenEnabled: "WELCOME_SCREEN_ENABLED",
} as const;

export const GUILD_FEATURES = Object.freeze(Object.values(GuildFeature));
export type KnownGuildFeature = (typeof GuildFeature)[keyof typeof GuildFeature];

// Guild features are an open Discord/Spacebar string set. Keep known values in
// GuildFeature for code paths that need named constants, but expose storage and
// schema-facing values as plain strings so generated JSON Schema remains open.
export type GuildFeatureValue = string;

export const MUTABLE_GUILD_FEATURES: readonly GuildFeatureValue[] = Object.freeze([
    GuildFeature.Community,
    GuildFeature.Discoverable,
    GuildFeature.InvitesDisabled,
    GuildFeature.RaidAlertsDisabled,
]);

export const VANITY_URL_FEATURE: KnownGuildFeature = GuildFeature.VanityUrl;

export function setVanityUrlFeature(features: readonly GuildFeatureValue[] | null | undefined, hasVanityUrl: boolean): GuildFeatureValue[] {
    const filteredFeatures = (features ?? []).filter((feature) => feature !== VANITY_URL_FEATURE);

    if (!hasVanityUrl) {
        return filteredFeatures;
    }

    return [...filteredFeatures, VANITY_URL_FEATURE];
}

export function getVanityUrlFeatureState(features: readonly GuildFeatureValue[] | null | undefined, hasVanityUrl: boolean) {
    const currentFeatures = features ?? [];
    const updatedFeatures = setVanityUrlFeature(currentFeatures, hasVanityUrl);

    return {
        features: updatedFeatures,
        changed: currentFeatures.length !== updatedFeatures.length || currentFeatures.some((feature, index) => feature !== updatedFeatures[index]),
    };
}
