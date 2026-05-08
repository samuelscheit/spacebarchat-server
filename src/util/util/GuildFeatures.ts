export const GuildFeature = {
    AnimatedBanner: "ANIMATED_BANNER",
    AnimatedIcon: "ANIMATED_ICON",
    ApplicationCommandPermissionsV2: "APPLICATION_COMMAND_PERMISSIONS_V2",
    AutoModeration: "AUTO_MODERATION",
    Banner: "BANNER",
    Community: "COMMUNITY",
    CreatorMonetizableProvisional: "CREATOR_MONETIZABLE_PROVISIONAL",
    CreatorStorePage: "CREATOR_STORE_PAGE",
    DeveloperSupportServer: "DEVELOPER_SUPPORT_SERVER",
    Discoverable: "DISCOVERABLE",
    EnhancedRoleColors: "ENHANCED_ROLE_COLORS",
    Featurable: "FEATURABLE",
    GuestsEnabled: "GUESTS_ENABLED",
    GuildTags: "GUILD_TAGS",
    InvitesDisabled: "INVITES_DISABLED",
    InviteSplash: "INVITE_SPLASH",
    MemberVerificationGateEnabled: "MEMBER_VERIFICATION_GATE_ENABLED",
    MoreSoundboard: "MORE_SOUNDBOARD",
    MoreStickers: "MORE_STICKERS",
    News: "NEWS",
    Partnered: "PARTNERED",
    PreviewEnabled: "PREVIEW_ENABLED",
    RaidAlertsDisabled: "RAID_ALERTS_DISABLED",
    RoleIcons: "ROLE_ICONS",
    RoleSubscriptionsAvailableForPurchase: "ROLE_SUBSCRIPTIONS_AVAILABLE_FOR_PURCHASE",
    RoleSubscriptionsEnabled: "ROLE_SUBSCRIPTIONS_ENABLED",
    Soundboard: "SOUNDBOARD",
    TicketedEventsEnabled: "TICKETED_EVENTS_ENABLED",
    VanityUrl: "VANITY_URL",
    Verified: "VERIFIED",
    VipRegions: "VIP_REGIONS",
    WelcomeScreenEnabled: "WELCOME_SCREEN_ENABLED",
} as const;

export const GUILD_FEATURES = Object.freeze(Object.values(GuildFeature));
export type KnownGuildFeature = (typeof GuildFeature)[keyof typeof GuildFeature];

// Guild features are an open Discord/Spacebar string set: keep known values typed
// while preserving forward-compatible/custom values loaded from config or storage.
export type GuildFeatureValue = KnownGuildFeature | (string & {});

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
