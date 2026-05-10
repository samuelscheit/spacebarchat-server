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
import { TenorGif, TenorSearchResults, type TenorIntegrationGifResponse } from "@spacebar/schemas";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";

const TENOR_SEARCH_LIMIT = 10;
const TENOR_SEARCH_URL = "https://g.tenor.com/v1/search";

export type IntegrationsTenorSearchDependencies = {
    fetch: typeof fetch;
    getGifApiKey: typeof getGifApiKey;
};

const defaultDependencies: IntegrationsTenorSearchDependencies = {
    fetch: globalThis.fetch,
    getGifApiKey,
};

export function parseTenorSearchQuery(query: Request["query"][string]) {
    if (typeof query === "string" && query.trim().length > 0) return query;

    throw FieldErrors({
        q: {
            message: "This field is required",
        },
    });
}

export function createTenorSearchUrl(query: string, apiKey: string) {
    const url = new URL(TENOR_SEARCH_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", String(TENOR_SEARCH_LIMIT));
    url.searchParams.set("media_filter", "gif");
    url.searchParams.set("key", apiKey);

    return url.toString();
}

export function toIntegrationTenorGif(result: TenorGif): TenorIntegrationGifResponse | undefined {
    const media = result.media?.[0]?.gif;
    const [width, height] = media?.dims ?? [];
    if (!media?.url || typeof width !== "number" || typeof height !== "number") return undefined;

    return {
        type: "gif",
        url: result.itemurl || result.url,
        src: media.url,
        width,
        height,
    };
}

export async function searchTenorGifs(query: string, dependencies: IntegrationsTenorSearchDependencies = defaultDependencies) {
    const apiKey = dependencies.getGifApiKey();
    const response = await dependencies.fetch(createTenorSearchUrl(query, apiKey), {
        method: "get",
        headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
        throw new HTTPError("Tenor search failed", 502);
    }

    const { results = [] } = (await response.json()) as Partial<TenorSearchResults>;
    return results.map(toIntegrationTenorGif).filter((gif): gif is TenorIntegrationGifResponse => Boolean(gif));
}

export function createIntegrationsTenorSearchRouter(dependencies: IntegrationsTenorSearchDependencies = defaultDependencies) {
    const router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            query: {
                q: {
                    type: "string",
                    required: true,
                    description: "Search query",
                },
            },
            responses: {
                200: {
                    body: "TenorIntegrationSearchResponse",
                },
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
                502: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const query = parseTenorSearchQuery(req.query.q);
            return res.status(200).json(await searchTenorGifs(query, dependencies));
        },
    );

    return router;
}

export default createIntegrationsTenorSearchRouter();
