/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import type { CategoryLocalizations } from "./DiscoverableGuildsResponse";

const DISCOVERABLE_FEATURE = "DISCOVERABLE";

export interface DiscoverySearchCategory {
    id: number;
    is_primary: boolean;
    name: string;
    name_localizations: CategoryLocalizations;
}

export interface DiscoverySearchGuild {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    splash: string | null;
    banner: string | null;
    approximate_presence_count: number;
    approximate_member_count: number;
    premium_subscription_count: number;
    preferred_locale: string;
    auto_removed: boolean;
    discovery_splash: string | null;
    primary_category_id: number | null;
    vanity_url_code: string | null;
    is_published: boolean;
    keywords: string[];
    nsfw_properties: null;
    features: string[];
    categories: DiscoverySearchCategory[];
    primary_category?: DiscoverySearchCategory;
    objectID: string;
}

export interface DiscoverySearchExhaustive {
    nbHits: boolean;
    typo: boolean;
}

export interface DiscoverySearchProcessingTimings {
    total: number;
}

export interface DiscoverySearchCategoryFacetCounts {
    [categoryId: string]: number;
}

export interface DiscoverySearchAggregateFacets {
    "categories.id": DiscoverySearchCategoryFacetCounts;
}

export interface DiscoverySearchResponse {
    hits: DiscoverySearchGuild[];
    nbHits: number;
    offset: number;
    length: number;
    exhaustiveNbHits: boolean;
    exhaustiveTypo: boolean;
    exhaustive: DiscoverySearchExhaustive;
    query: string;
    params: string;
    processingTimeMS: number;
    processingTimingsMS: DiscoverySearchProcessingTimings;
    serverTimeMS: number;
    aggregateFacets: DiscoverySearchAggregateFacets;
    totalNbHits: number;
}

export interface DiscoverySearchGuildSource {
    id: string;
    name: string;
    description?: string | null;
    icon?: string | null;
    splash?: string | null;
    banner?: string | null;
    discovery_splash?: string | null;
    primary_category_id?: number | null;
    features: string[];
    preferred_locale?: string | null;
    premium_subscription_count?: number | null;
    member_count?: number | null;
    presence_count?: number | null;
}

export function toDiscoverySearchCategory(category: { id: number; is_primary: boolean; name: string; localizations?: CategoryLocalizations | null }): DiscoverySearchCategory {
    return {
        id: category.id,
        is_primary: category.is_primary,
        name: category.name,
        name_localizations: category.localizations ?? {},
    };
}

export function toDiscoverySearchGuild(guild: DiscoverySearchGuildSource, categoriesById: ReadonlyMap<number, DiscoverySearchCategory> = new Map()): DiscoverySearchGuild {
    const primaryCategoryId = guild.primary_category_id ?? null;
    const primaryCategory = primaryCategoryId == null ? undefined : categoriesById.get(primaryCategoryId);
    const categories = primaryCategory ? [primaryCategory] : [];

    return {
        id: guild.id,
        name: guild.name,
        description: guild.description ?? null,
        icon: guild.icon ?? null,
        splash: guild.splash ?? null,
        banner: guild.banner ?? null,
        approximate_presence_count: guild.presence_count ?? 0,
        approximate_member_count: guild.member_count ?? 0,
        premium_subscription_count: guild.premium_subscription_count ?? 0,
        preferred_locale: guild.preferred_locale ?? "en-US",
        auto_removed: false,
        discovery_splash: guild.discovery_splash ?? null,
        primary_category_id: primaryCategoryId,
        vanity_url_code: null,
        is_published: guild.features.includes(DISCOVERABLE_FEATURE),
        keywords: [],
        nsfw_properties: null,
        features: guild.features,
        categories,
        ...(primaryCategory ? { primary_category: primaryCategory } : {}),
        objectID: guild.id,
    };
}
