import { GuildDiscoveryMetadataResponse } from "@spacebar/schemas";

export interface DiscoveryMetadataGuild {
    id: string;
    primary_category_id?: string | null;
    features?: string[];
    description?: string | null;
}

export function toGuildDiscoveryMetadata(guild: DiscoveryMetadataGuild): GuildDiscoveryMetadataResponse {
    const primaryCategoryId = guild.primary_category_id ? Number(guild.primary_category_id) : null;

    return {
        guild_id: guild.id,
        primary_category_id: primaryCategoryId,
        category_ids: primaryCategoryId === null ? [] : [primaryCategoryId],
        keywords: [],
        emoji_discoverability_enabled: true,
        partner_actioned_timestamp: null,
        partner_application_timestamp: null,
        is_published: guild.features?.includes("DISCOVERABLE") ?? false,
        reasons_to_join: [],
        social_links: [],
        about: guild.description ?? null,
    };
}
