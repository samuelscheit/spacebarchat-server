import { GuildDiscoveryMetadataResponse, GuildDiscoveryMetadataUpdateSchema } from "@spacebar/schemas";
import { GuildFeature } from "../../../util/util/GuildFeatures";

export interface DiscoveryMetadataGuild {
    id: string;
    primary_category_id?: string | null;
    features?: string[];
    description?: string | null;
}

export type GuildDiscoveryMetadataUpdate = Pick<DiscoveryMetadataGuild, "primary_category_id" | "features" | "description">;

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
        is_published: guild.features?.includes(GuildFeature.Discoverable) ?? false,
        reasons_to_join: [],
        social_links: [],
        about: guild.description ?? null,
    };
}

export function getGuildDiscoveryMetadataUpdate(guild: DiscoveryMetadataGuild, body: GuildDiscoveryMetadataUpdateSchema): GuildDiscoveryMetadataUpdate {
    const update: GuildDiscoveryMetadataUpdate = {};

    if (body.primary_category_id !== undefined) {
        update.primary_category_id = body.primary_category_id === null ? null : body.primary_category_id.toString();
    }

    if (body.about !== undefined) {
        update.description = body.about;
    }

    if (body.is_published !== undefined) {
        const features = guild.features ?? [];
        update.features = body.is_published
            ? features.includes(GuildFeature.Discoverable)
                ? features
                : [...features, GuildFeature.Discoverable]
            : features.filter((feature) => feature !== GuildFeature.Discoverable);
    }

    return update;
}
