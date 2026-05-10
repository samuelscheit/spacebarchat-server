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
import { getGifApiKey } from "@spacebar/util";
import { Request, Response, Router } from "express";
import type { TenorTrendingSearchResponse, TenorTrendingSearchResults } from "@spacebar/schemas";

const router = Router({ mergeParams: true });

export const GifSearchTermProviders = ["tenor", "giphy", "klipy"] as const;
export type GifSearchTermProvider = (typeof GifSearchTermProviders)[number];

const TENOR_PROVIDER: GifSearchTermProvider = "tenor";
const DEFAULT_LOCALE = "en-US";
const DEFAULT_LIMIT = 5;
const MIN_LIMIT = 1;
const MAX_LIMIT = 50;

function firstQueryValue(value: unknown): string | undefined {
    if (Array.isArray(value)) return firstQueryValue(value[0]);
    if (typeof value === "string") return value;

    return undefined;
}

export function parseGifTrendingSearchQuery(query: Record<string, unknown>) {
    const provider = firstQueryValue(query.provider)?.trim().toLowerCase() || TENOR_PROVIDER;
    const locale = firstQueryValue(query.locale)?.trim() || DEFAULT_LOCALE;
    const limitValue = Number(firstQueryValue(query.limit));
    const limit = Number.isFinite(limitValue) ? Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, Math.trunc(limitValue))) : DEFAULT_LIMIT;

    return {
        provider,
        locale,
        limit,
    };
}

export function buildTenorTrendingTermsUrl(locale: string, limit: number, apiKey: string) {
    const url = new URL("https://g.tenor.com/v1/trending_terms");
    url.searchParams.set("locale", locale);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("key", apiKey);

    return url.toString();
}

router.get(
    "/",
    route({
        summary: "Get Trending GIF Search Terms",
        query: {
            provider: {
                type: "string",
                description: "GIF provider to use.",
                values: [...GifSearchTermProviders],
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
            401: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const { provider, locale, limit } = parseGifTrendingSearchQuery(req.query as Record<string, unknown>);
        const apiKey = getGifApiKey();

        if (provider !== TENOR_PROVIDER) {
            const response: TenorTrendingSearchResponse = [];
            return res.status(200).json(response);
        }

        const response = await fetch(buildTenorTrendingTermsUrl(locale, limit, apiKey), {
            method: "get",
            headers: { "Content-Type": "application/json" },
        });

        const { results } = (await response.json()) as TenorTrendingSearchResults;
        const body: TenorTrendingSearchResponse = Array.isArray(results) ? results.filter((term): term is string => typeof term === "string") : [];

        return res.status(200).json(body);
    },
);

export default router;
