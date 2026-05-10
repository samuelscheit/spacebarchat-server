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

import { route } from "@spacebar/api";
import { FieldErrors, getGifApiKey } from "@spacebar/util";
import type { TenorTrendingSearchResponse, TenorTrendingSearchResults } from "@spacebar/schemas";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";

const TENOR_AUTOCOMPLETE_URL = "https://g.tenor.com/v1/autocomplete";
const TENOR_PROVIDER = "tenor";
const DEFAULT_LOCALE = "en-US";
const DEFAULT_LIMIT = 20;
const MIN_LIMIT = 1;
const MAX_LIMIT = 50;

export const GifSuggestProviders = ["tenor", "giphy", "klipy"] as const;
export type GifSuggestProvider = (typeof GifSuggestProviders)[number];

export type GifSuggestQuery = {
    provider: string;
    query: string;
    locale: string;
    limit: number;
};

export type GifSuggestDependencies = {
    fetch: typeof fetch;
    getGifApiKey: typeof getGifApiKey;
};

const defaultDependencies: GifSuggestDependencies = {
    fetch: globalThis.fetch,
    getGifApiKey,
};

function firstQueryValue(value: unknown): string | undefined {
    if (Array.isArray(value)) return firstQueryValue(value[0]);
    if (typeof value === "string") return value;

    return undefined;
}

export function parseGifSuggestQuery(query: Record<string, unknown>): GifSuggestQuery {
    const searchQuery = firstQueryValue(query.q);
    if (!searchQuery || searchQuery.trim().length === 0) {
        throw FieldErrors({
            q: {
                message: "This field is required",
            },
        });
    }

    const provider = firstQueryValue(query.provider)?.trim().toLowerCase() || TENOR_PROVIDER;
    const locale = firstQueryValue(query.locale)?.trim() || DEFAULT_LOCALE;
    const limitValue = Number(firstQueryValue(query.limit));
    const limit = Number.isFinite(limitValue) ? Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, Math.trunc(limitValue))) : DEFAULT_LIMIT;

    return {
        provider,
        query: searchQuery,
        locale,
        limit,
    };
}

export function buildTenorSuggestUrl(query: string, locale: string, limit: number, apiKey: string) {
    const url = new URL(TENOR_AUTOCOMPLETE_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("locale", locale);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("key", apiKey);

    return url.toString();
}

export async function getSuggestedGifSearchTerms(query: GifSuggestQuery, dependencies: GifSuggestDependencies = defaultDependencies): Promise<TenorTrendingSearchResponse> {
    if (query.provider !== TENOR_PROVIDER) return [];

    const response = await dependencies.fetch(buildTenorSuggestUrl(query.query, query.locale, query.limit, dependencies.getGifApiKey()), {
        method: "get",
        headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
        throw new HTTPError("Tenor GIF suggestions failed", 502);
    }

    const { results = [] } = (await response.json()) as Partial<TenorTrendingSearchResults>;
    return Array.isArray(results) ? results.filter((term): term is string => typeof term === "string") : [];
}

export function createGifsSuggestRouter(dependencies: GifSuggestDependencies = defaultDependencies) {
    const router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Suggested GIF Search Terms",
            query: {
                provider: {
                    type: "string",
                    description: "GIF provider to use.",
                    values: [...GifSuggestProviders],
                },
                q: {
                    type: "string",
                    required: true,
                    description: "Search query to suggest completions for.",
                },
                limit: {
                    type: "integer",
                    description: "Maximum number of search terms to return, from 1 to 50.",
                },
                locale: {
                    type: "string",
                    description: "Locale to use in search results.",
                },
            },
            responses: {
                200: {
                    body: "TenorTrendingSearchResponse",
                },
                400: {
                    body: "APIErrorResponse",
                },
                502: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const query = parseGifSuggestQuery(req.query as Record<string, unknown>);
            return res.status(200).json(await getSuggestedGifSearchTerms(query, dependencies));
        },
    );

    return router;
}

export default createGifsSuggestRouter();
