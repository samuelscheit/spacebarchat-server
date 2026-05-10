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
import type { ApplicationDetectableResponse } from "@spacebar/schemas";
import { type Request, type Response, Router } from "express";
import { HTTPError } from "lambert-server";

export const DISCORD_DETECTABLE_NON_GAME_APPLICATIONS_URL = "https://discord.com/api/v10/applications/non-games/detectable";
export const DETECTABLE_NON_GAME_APPLICATIONS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

type DetectableNonGameApplicationsCache = {
    data?: ApplicationDetectableResponse;
    expires: number;
};

export function normalizeDetectableNonGameApplicationsPayload(payload: unknown): ApplicationDetectableResponse {
    if (!Array.isArray(payload)) {
        throw upstreamUnavailableError();
    }

    return payload;
}

function upstreamUnavailableError() {
    return new HTTPError("Failed to fetch detectable non-game applications", 502);
}

export async function fetchDetectableNonGameApplications(fetcher: typeof fetch = fetch): Promise<ApplicationDetectableResponse> {
    let response: globalThis.Response;

    try {
        response = await fetcher(DISCORD_DETECTABLE_NON_GAME_APPLICATIONS_URL, {
            headers: {
                Accept: "application/json",
            },
        });
    } catch {
        throw upstreamUnavailableError();
    }

    if (!response.ok) throw upstreamUnavailableError();

    try {
        return normalizeDetectableNonGameApplicationsPayload(await response.json());
    } catch {
        throw upstreamUnavailableError();
    }
}

function cacheControlFor(expires: number, now: number) {
    const maxAge = Math.max(0, Math.floor((expires - now) / 1000));

    return `public, max-age=${maxAge}, s-maxage=${maxAge}, immutable`;
}

export function createDetectableNonGameApplicationsRouter(options: { fetcher?: typeof fetch; now?: () => number; cacheTtlMs?: number } = {}) {
    const router = Router({ mergeParams: true });
    const cache: DetectableNonGameApplicationsCache = {
        expires: 0,
    };
    const fetcher = options.fetcher ?? fetch;
    const now = options.now ?? Date.now;
    const cacheTtlMs = options.cacheTtlMs ?? DETECTABLE_NON_GAME_APPLICATIONS_CACHE_TTL_MS;

    router.get(
        "/",
        route({
            summary: "Get Detectable Non Game Applications",
            responses: {
                200: {
                    body: "ApplicationDetectableResponse",
                },
                502: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (_req: Request, res: Response) => {
            const requestTime = now();

            if (!cache.data || requestTime > cache.expires) {
                try {
                    cache.data = await fetchDetectableNonGameApplications(fetcher);
                    cache.expires = requestTime + cacheTtlMs;
                } catch (error) {
                    if (!cache.data) throw error;
                }
            }

            return res.set("Cache-Control", cacheControlFor(cache.expires, requestTime)).status(200).json(cache.data);
        },
    );

    return router;
}

export default createDetectableNonGameApplicationsRouter();
