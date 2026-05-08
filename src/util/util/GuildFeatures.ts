export enum GuildFeature {
    VanityUrl = "VANITY_URL",
    VipRegions = "VIP_REGIONS",
}

export const VANITY_URL_FEATURE = GuildFeature.VanityUrl;
export const VIP_REGIONS_FEATURE = GuildFeature.VipRegions;

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
