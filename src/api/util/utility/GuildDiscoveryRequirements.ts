import type { GuildDiscoveryRequirementsResponse } from "@spacebar/schemas";
import { SpacebarApiErrors } from "@spacebar/util";

export const DISCOVERABLE_FEATURE = "DISCOVERABLE";

export interface DiscoveryRequirementsGuild {
    id: string;
    discovery_excluded?: boolean;
}

export interface DiscoveryPublishPolicyGuild {
    features?: string[];
    discovery_excluded?: boolean;
}

export interface DiscoveryPublishRights {
    has(right: "MANAGE_GUILDS" | "SELF_ADD_DISCOVERABLE"): boolean;
}

const defaultHealthScore = {
    avg_nonnew_participators: 0,
    avg_nonnew_communicators: 0,
    num_intentful_joiners: 0,
    perc_ret_w1_intentful: 0,
};

export function toGuildDiscoveryRequirements(guild: DiscoveryRequirementsGuild): GuildDiscoveryRequirementsResponse {
    const allowedByAdmin = !guild.discovery_excluded;

    return {
        guild_id: guild.id,
        safe_environment: allowedByAdmin,
        healthy: true,
        health_score_pending: false,
        size: true,
        nsfw_properties: {},
        protected: allowedByAdmin,
        sufficient: allowedByAdmin,
        sufficient_without_grace_period: allowedByAdmin,
        valid_rules_channel: true,
        retention_healthy: true,
        engagement_healthy: true,
        age: true,
        minimum_age: 0,
        health_score: { ...defaultHealthScore },
        minimum_size: 0,
    };
}

export function addsDiscoverableFeature(currentFeatures: string[] | undefined, nextFeatures: string[] | undefined): boolean {
    return nextFeatures?.includes(DISCOVERABLE_FEATURE) === true && currentFeatures?.includes(DISCOVERABLE_FEATURE) !== true;
}

export function assertCanPublishGuildDiscovery(guild: DiscoveryPublishPolicyGuild, rights: DiscoveryPublishRights) {
    if (!guild.discovery_excluded && (rights.has("MANAGE_GUILDS") || rights.has("SELF_ADD_DISCOVERABLE"))) return;

    throw SpacebarApiErrors.MISSING_RIGHTS.withParams("SELF_ADD_DISCOVERABLE");
}

export function assertCanApplyGuildDiscoveryFeatures(guild: DiscoveryPublishPolicyGuild, nextFeatures: string[] | undefined, rights: DiscoveryPublishRights) {
    if (!addsDiscoverableFeature(guild.features, nextFeatures)) return;

    assertCanPublishGuildDiscovery(guild, rights);
}
