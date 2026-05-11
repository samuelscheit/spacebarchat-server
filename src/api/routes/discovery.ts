/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors

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

import { createDiscoveryCategoryFindOptions, route } from "@spacebar/api";
import { type DiscoverySearchCategory, type DiscoverySearchResponse, type DiscoveryValidTermResponse, toDiscoverySearchCategory, toDiscoverySearchGuild } from "@spacebar/schemas";
import { Categories, FieldErrors, Guild, GuildFeature } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { ArrayContains, FindOptionsWhere, In, MoreThan, Raw } from "typeorm";

const router = Router({ mergeParams: true });
const MAX_DISCOVERY_SEARCH_TERM_LENGTH = 100;
const DISCOVERY_SEARCH_DEFAULT_LIMIT = 48;
const DISCOVERY_SEARCH_MAX_LIMIT = 48;
const DISCOVERY_SEARCH_DEFAULT_OFFSET = 0;
const DISCOVERY_SEARCH_MAX_OFFSET = 2999;
const DISCOVERY_SEARCH_FILTERS = "approximate_member_count>0 AND approximate_presence_count>0 AND auto_removed:false AND is_published:true";

type DiscoveryCategoryResponse = Pick<Categories, "id" | "name" | "localizations" | "is_primary" | "icon">;
type QueryValue = Request["query"][string];

export interface DiscoverySearchQuery {
    query: string;
    limit: number;
    offset: number;
}

export function localizeDiscoveryCategories(categories: Categories[], locale: unknown): DiscoveryCategoryResponse[] {
    if (typeof locale !== "string" || locale.length === 0) return categories;

    return categories.map((category) => {
        const name = category.localizations?.[locale];
        if (!name) return category;

        return { ...category, name };
    });
}

export async function getDiscoveryCategories(query: Request["query"]): Promise<DiscoveryCategoryResponse[]> {
    const { locale, primary_only } = query;
    const categories = await Categories.find(createDiscoveryCategoryFindOptions(primary_only));

    return localizeDiscoveryCategories(categories, locale);
}

function firstQueryValue(value: QueryValue, field: string): string | undefined {
    if (Array.isArray(value)) return firstQueryValue(value[0], field);
    if (value === undefined) return undefined;
    if (typeof value === "string") return value;

    throw FieldErrors({
        [field]: {
            message: "This field must be a string",
        },
    });
}

function parseBoundedIntegerQueryValue(value: QueryValue, field: string, defaultValue: number, min: number, max: number): number {
    const raw = firstQueryValue(value, field);
    if (raw === undefined || raw.length === 0) return defaultValue;

    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || !Number.isSafeInteger(parsed)) {
        throw FieldErrors({
            [field]: {
                code: "NUMBER_TYPE_COERCE",
                message: `Value "${raw}" is not int.`,
            },
        });
    }

    if (parsed < min) {
        throw FieldErrors({
            [field]: {
                code: "NUMBER_TYPE_MIN",
                message: `int value should be greater than or equal to ${min}.`,
            },
        });
    }

    if (parsed > max) {
        throw FieldErrors({
            [field]: {
                code: "NUMBER_TYPE_MAX",
                message: `int value should be less than or equal to ${max}.`,
            },
        });
    }

    return parsed;
}

export function parseDiscoverySearchQuery(query: Request["query"]): DiscoverySearchQuery {
    return {
        query: firstQueryValue(query.query, "query")?.trim() ?? "",
        limit: parseBoundedIntegerQueryValue(query.limit, "limit", DISCOVERY_SEARCH_DEFAULT_LIMIT, 1, DISCOVERY_SEARCH_MAX_LIMIT),
        offset: parseBoundedIntegerQueryValue(query.offset, "offset", DISCOVERY_SEARCH_DEFAULT_OFFSET, 0, DISCOVERY_SEARCH_MAX_OFFSET),
    };
}

function escapeLikePattern(value: string): string {
    return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export function createPublishedDiscoveryGuildWhere(query: string): FindOptionsWhere<Guild> | FindOptionsWhere<Guild>[] {
    const baseWhere: FindOptionsWhere<Guild> = {
        discovery_excluded: false,
        features: ArrayContains([GuildFeature.Discoverable]),
        member_count: MoreThan(0),
        presence_count: MoreThan(0),
    };

    if (!query) return baseWhere;

    const pattern = `%${escapeLikePattern(query.toLowerCase())}%`;
    const textSearch = Raw((alias) => `LOWER(${alias}) LIKE :pattern ESCAPE '\\'`, { pattern });

    return [
        {
            ...baseWhere,
            name: textSearch,
        },
        {
            ...baseWhere,
            description: textSearch,
        },
    ];
}

function buildDiscoverySearchParams({ query, limit, offset }: DiscoverySearchQuery): string {
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    params.set("offset", String(offset));
    params.set("length", String(limit));
    params.set("filters", DISCOVERY_SEARCH_FILTERS);
    return params.toString();
}

async function getDiscoverySearchCategoryMap(guilds: Pick<Guild, "primary_category_id">[]): Promise<Map<number, DiscoverySearchCategory>> {
    const categoryIds = [
        ...new Set(guilds.map((guild) => guild.primary_category_id).filter((categoryId): categoryId is number => categoryId !== null && categoryId !== undefined)),
    ];
    if (!categoryIds.length) return new Map();

    const categories = await Categories.find({
        where: {
            id: In(categoryIds),
        },
    });

    return new Map(categories.map((category) => [category.id, toDiscoverySearchCategory(category)]));
}

export async function searchPublishedGuilds(query: Request["query"]): Promise<DiscoverySearchResponse> {
    const startedAt = Date.now();
    const searchQuery = parseDiscoverySearchQuery(query);
    const [guilds, total] = await Guild.findAndCount({
        where: createPublishedDiscoveryGuildWhere(searchQuery.query),
        order: {
            discovery_weight: "DESC",
            member_count: "DESC",
            id: "ASC",
        },
        skip: searchQuery.offset,
        take: searchQuery.limit,
    });
    const categoriesById = await getDiscoverySearchCategoryMap(guilds);
    const elapsed = Math.max(0, Date.now() - startedAt);

    return {
        hits: guilds.map((guild) => toDiscoverySearchGuild(guild, categoriesById)),
        nbHits: total,
        offset: searchQuery.offset,
        length: searchQuery.limit,
        exhaustiveNbHits: true,
        exhaustiveTypo: true,
        exhaustive: {
            nbHits: true,
            typo: true,
        },
        query: searchQuery.query,
        params: buildDiscoverySearchParams(searchQuery),
        processingTimeMS: elapsed,
        processingTimingsMS: {
            total: elapsed,
        },
        serverTimeMS: elapsed,
        aggregateFacets: {
            "categories.id": {},
        },
        totalNbHits: total,
    };
}

export function parseDiscoverySearchTerm(term: unknown): string {
    if (typeof term === "string") return term;

    throw FieldErrors({
        term: {
            message: "This field is required",
        },
    });
}

export function isDiscoverySearchTermValid(term: string): boolean {
    const trimmed = term.trim();

    return trimmed.length > 0 && trimmed.length <= MAX_DISCOVERY_SEARCH_TERM_LENGTH;
}

export function getDiscoveryValidTermResponse(query: Request["query"]): DiscoveryValidTermResponse {
    return {
        valid: isDiscoverySearchTermValid(parseDiscoverySearchTerm(query.term)),
    };
}

router.get(
    "/search",
    route({
        summary: "Search Published Guilds",
        query: {
            query: {
                type: "string",
                description: "The search query to match against published discoverable guilds.",
            },
            limit: {
                type: "number",
                description: "The maximum number of published guilds to return, between 1 and 48.",
            },
            offset: {
                type: "number",
                description: "The number of published guilds to skip before returning results, up to 2999.",
            },
        },
        responses: {
            200: {
                body: "DiscoverySearchResponse",
            },
            400: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        res.status(200).send(await searchPublishedGuilds(req.query));
    },
);

router.get(
    "/valid-term",
    route({
        summary: "Validate Discovery Search Term",
        query: {
            term: {
                type: "string",
                required: true,
                description: "The search term to validate.",
            },
        },
        responses: {
            200: {
                body: "DiscoveryValidTermResponse",
            },
            400: {
                body: "APIErrorResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
        },
    }),
    (req: Request, res: Response) => res.status(200).json(getDiscoveryValidTermResponse(req.query)),
);

router.get(
    "/categories",
    route({
        query: {
            locale: {
                type: "string",
                description: "Locale to use when selecting localized category names.",
            },
            primary_only: {
                type: "boolean",
                description: "Only return primary discovery categories.",
            },
        },
        responses: {
            200: {
                body: "APIDiscoveryCategoryArray",
            },
        },
    }),
    async (req: Request, res: Response) => {
        res.send(await getDiscoveryCategories(req.query));
    },
);

export default router;
