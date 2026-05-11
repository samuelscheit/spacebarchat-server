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

import { Config, FieldErrors, Guild, GuildFeature, Member } from "@spacebar/util";

import { createDiscoverableGuildCategoryFilter, route } from "@spacebar/api";
import { Request, Response, Router } from "express";
import { ArrayContains, FindOptionsWhere, ILike, In, MoreThan, Not } from "typeorm";
import { type DiscoverableGuildsResponse, toDiscoverableGuild } from "@spacebar/schemas";

const router = Router({ mergeParams: true });
const DEFAULT_DISCOVERABLE_GUILD_SEARCH_LIMIT = 24;
const MAX_DISCOVERABLE_GUILD_SEARCH_LIMIT = 48;
const MAX_DISCOVERABLE_GUILD_SEARCH_OFFSET = 2999;
const MAX_DISCOVERABLE_GUILD_SEARCH_QUERY_LENGTH = 100;
const MAX_POSTGRES_INTEGER = 2147483647;

type DiscoverableGuildSearchQuery = {
    query: string;
    limit: number;
    offset: number;
    categoryId?: number;
};

function queryValue(value: Request["query"][string], field: string, required = false): string | undefined {
    if (typeof value === "string") return value;
    if (value === undefined && !required) return undefined;

    throw FieldErrors({
        [field]: {
            message: required ? "This field is required" : "This field must be a string",
        },
    });
}

function parseBoundedIntegerQuery(value: Request["query"][string], field: string, fallback: number, max: number): number {
    const raw = queryValue(value, field);
    if (raw === undefined || raw === "") return fallback;

    if (!/^\d+$/.test(raw)) {
        throw FieldErrors({
            [field]: {
                message: "This field must be a non-negative integer",
            },
        });
    }

    return Math.min(Number(raw), max);
}

function parseOptionalIntegerQuery(value: Request["query"][string], field: string): number | undefined {
    const raw = queryValue(value, field);
    if (raw === undefined || raw === "") return undefined;

    if (!/^\d+$/.test(raw)) {
        throw FieldErrors({
            [field]: {
                message: "This field must be a non-negative integer",
            },
        });
    }

    const parsed = Number(raw);
    if (!Number.isSafeInteger(parsed) || parsed > MAX_POSTGRES_INTEGER) {
        throw FieldErrors({
            [field]: {
                message: "This field must be a valid integer",
            },
        });
    }

    return parsed;
}

function escapeLikePattern(value: string): string {
    return value.replace(/[\\%_]/g, "\\$&");
}

export function parseDiscoverableGuildSearchQuery(query: Request["query"]): DiscoverableGuildSearchQuery {
    const term = queryValue(query.query, "query", true)!.trim();

    if (term.length === 0 || term.length > MAX_DISCOVERABLE_GUILD_SEARCH_QUERY_LENGTH) {
        throw FieldErrors({
            query: {
                message: `This field must be between 1 and ${MAX_DISCOVERABLE_GUILD_SEARCH_QUERY_LENGTH} characters`,
            },
        });
    }

    const categoryId = parseOptionalIntegerQuery(query.category_id, "category_id");

    return {
        query: term,
        limit: parseBoundedIntegerQuery(query.limit, "limit", DEFAULT_DISCOVERABLE_GUILD_SEARCH_LIMIT, MAX_DISCOVERABLE_GUILD_SEARCH_LIMIT),
        offset: parseBoundedIntegerQuery(query.offset, "offset", 0, MAX_DISCOVERABLE_GUILD_SEARCH_OFFSET),
        ...(categoryId === undefined ? {} : { categoryId }),
    };
}

async function hiddenDiscoverableGuildIds(userId: string | undefined): Promise<string[]> {
    const hideJoinedGuilds = Config.get().guild.discovery.hideJoinedGuilds;
    if (!hideJoinedGuilds || !userId) return [];

    return await Member.find({
        where: { id: userId },
        select: { guild_id: true },
    }).then((members) => members.map((member) => member.guild_id));
}

function createDiscoverableGuildSearchWhere(search: DiscoverableGuildSearchQuery, hiddenGuildIds: string[]): FindOptionsWhere<Guild>[] {
    const showAllGuilds = Config.get().guild.discovery.showAllGuilds;
    const baseWhere: FindOptionsWhere<Guild> = {
        ...(hiddenGuildIds.length ? { id: Not(In(hiddenGuildIds)) } : {}),
        discovery_excluded: false,
        member_count: MoreThan(200),
        presence_count: MoreThan(0),
        ...(search.categoryId === undefined ? {} : { primary_category_id: search.categoryId }),
        ...(showAllGuilds ? {} : { features: ArrayContains([GuildFeature.Discoverable]) }),
    };
    const textSearch = ILike(`%${escapeLikePattern(search.query)}%`);

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

export async function getDiscoverableGuildSearchResponse(query: Request["query"], userId?: string): Promise<DiscoverableGuildsResponse> {
    const search = parseDiscoverableGuildSearchQuery(query);
    const hiddenGuildIds = await hiddenDiscoverableGuildIds(userId);
    const [guilds, total] = await Guild.findAndCount({
        where: createDiscoverableGuildSearchWhere(search, hiddenGuildIds),
        order: {
            discovery_weight: "DESC",
            member_count: "DESC",
        },
        skip: search.offset,
        take: search.limit,
    });

    return {
        total,
        guilds: guilds.map(toDiscoverableGuild),
        offset: search.offset,
        limit: search.limit,
    };
}

router.get(
    "/",
    route({
        query: {
            offset: {
                type: "number",
                description: "The number of discoverable guilds to skip before returning results.",
            },
            limit: {
                type: "number",
                description: "The maximum number of discoverable guilds to return.",
            },
            categories: {
                type: "string",
                description: "Filter by one or more primary category IDs. May be repeated or comma-separated.",
            },
        },
        responses: {
            200: {
                body: "DiscoverableGuildsResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const { offset, limit, categories } = req.query;
        const categoryFilter = createDiscoverableGuildCategoryFilter(categories);
        const showAllGuilds = Config.get().guild.discovery.showAllGuilds;
        const configLimit = Config.get().guild.discovery.limit;
        const hideJoinedGuilds = Config.get().guild.discovery.hideJoinedGuilds;
        const hiddenGuildIds = hideJoinedGuilds
            ? await Member.find({
                  where: { id: req.user_id },
                  select: { guild_id: true },
              }).then((members) => members.map((member) => member.guild_id))
            : [];

        const guilds = await Guild.find({
            where: {
                id: Not(In(hiddenGuildIds)),
                discovery_excluded: false,
                ...(categoryFilter == undefined ? {} : { primary_category_id: categoryFilter }),
                ...(showAllGuilds ? {} : { features: ArrayContains([GuildFeature.Discoverable]) }),
            },
            order: {
                discovery_weight: "DESC",
                member_count: "DESC",
            },
            skip: Math.abs(Number(offset || Config.get().guild.discovery.offset)),
            take: Math.abs(Number(limit || configLimit)),
        });

        const total = guilds.length;

        const response = {
            total: total,
            guilds: guilds.map(toDiscoverableGuild),
            offset: Number(offset || Config.get().guild.discovery.offset),
            limit: Number(limit || configLimit),
        } satisfies DiscoverableGuildsResponse;

        return res.send(response);
    },
);

router.get(
    "/search",
    route({
        summary: "Search Discoverable Guilds",
        query: {
            query: {
                type: "string",
                required: true,
                description: "The search query to match against discoverable guild names and descriptions.",
            },
            limit: {
                type: "number",
                description: "The maximum number of discoverable guilds to return. Values above 48 are clamped.",
            },
            offset: {
                type: "number",
                description: "The number of matching discoverable guilds to skip before returning results. Values above 2999 are clamped.",
            },
            category_id: {
                type: "number",
                description: "Filter by a primary discovery category ID.",
            },
        },
        responses: {
            200: {
                body: "DiscoverableGuildsResponse",
            },
            400: {
                body: "APIErrorResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => res.status(200).send(await getDiscoverableGuildSearchResponse(req.query, req.user_id)),
);

export default router;
