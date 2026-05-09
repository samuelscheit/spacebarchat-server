import type { Region } from "@spacebar/schemas";

type GatewayRegionConfiguration = {
    default: string;
    available: Region[];
};

export function selectConfiguredRegion(regions: GatewayRegionConfiguration, requestedRegion?: string): Region {
    const requested = requestedRegion ? regions.available.find((region) => region.id === requestedRegion) : undefined;
    const fallback = regions.available.find((region) => region.id === regions.default);

    if (!requested && !fallback) {
        throw new Error("No default region configured");
    }

    return requested ?? fallback!;
}

export function selectStreamRegion(regions: GatewayRegionConfiguration, preferredRegion?: string): Region {
    return selectConfiguredRegion(regions, preferredRegion);
}
