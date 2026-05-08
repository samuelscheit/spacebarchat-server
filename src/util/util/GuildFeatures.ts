export const PATCH_MUTABLE_GUILD_FEATURES = ["COMMUNITY", "INVITES_DISABLED", "DISCOVERABLE"] as const;
const PATCH_MUTABLE_GUILD_FEATURE_SET = new Set<string>(PATCH_MUTABLE_GUILD_FEATURES);

export function canPatchGuildFeature(feature: string) {
    return PATCH_MUTABLE_GUILD_FEATURE_SET.has(feature);
}

export const VANITY_URL_FEATURE = "VANITY_URL";

export function setVanityUrlFeature(features: string[] | null | undefined, hasVanityUrl: boolean) {
    const filteredFeatures = (features ?? []).filter((feature) => feature !== VANITY_URL_FEATURE);

    if (!hasVanityUrl) {
        return filteredFeatures;
    }

    return [...filteredFeatures, VANITY_URL_FEATURE];
}

export function getVanityUrlFeatureState(features: string[] | null | undefined, hasVanityUrl: boolean) {
    const currentFeatures = features ?? [];
    const updatedFeatures = setVanityUrlFeature(currentFeatures, hasVanityUrl);

    return {
        features: updatedFeatures,
        changed: currentFeatures.length !== updatedFeatures.length || currentFeatures.some((feature, index) => feature !== updatedFeatures[index]),
    };
}
