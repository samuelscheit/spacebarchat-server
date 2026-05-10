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
import type { DetectableGameExclusionsResponse } from "@spacebar/schemas";
import { type Request, type Response, Router } from "express";
import { HTTPError } from "lambert-server";

export const DISCORD_DETECTABLE_GAME_EXCLUSIONS_URL = "https://discord.com/api/v10/games/detectable/exclusions";
export const DETECTABLE_GAME_EXCLUSIONS_CACHE_TTL_MS = 60 * 60 * 1000;

type DetectableGameExclusionsCache = {
    data?: DetectableGameExclusionsResponse;
    expires: number;
};

function stringItems(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function normalizeDetectableGameExclusionsPayload(payload: unknown): DetectableGameExclusionsResponse {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return {
            executables: [],
            patterns: [],
        };
    }

    const body = payload as { executables?: unknown; patterns?: unknown };

    return {
        executables: stringItems(body.executables),
        patterns: stringItems(body.patterns),
    };
}

function upstreamUnavailableError() {
    return new HTTPError("Failed to fetch detectable game exclusions", 502);
}

export async function fetchDetectableGameExclusions(fetcher: typeof fetch = fetch): Promise<DetectableGameExclusionsResponse> {
    let response: globalThis.Response;

    try {
        response = await fetcher(DISCORD_DETECTABLE_GAME_EXCLUSIONS_URL, {
            headers: {
                Accept: "application/json",
            },
        });
    } catch {
        throw upstreamUnavailableError();
    }

    if (!response.ok) throw upstreamUnavailableError();

    try {
        return normalizeDetectableGameExclusionsPayload(await response.json());
    } catch {
        throw upstreamUnavailableError();
    }
}

function cacheControlFor(expires: number, now: number) {
    const maxAge = Math.max(0, Math.floor((expires - now) / 1000));

    return `public, max-age=${maxAge}, s-maxage=${maxAge}, immutable`;
}

export function createDetectableGameExclusionsRouter(options: { fetcher?: typeof fetch; now?: () => number; cacheTtlMs?: number } = {}) {
    const router = Router({ mergeParams: true });
    const cache: DetectableGameExclusionsCache = {
        expires: 0,
    };
    const fetcher = options.fetcher ?? fetch;
    const now = options.now ?? Date.now;
    const cacheTtlMs = options.cacheTtlMs ?? DETECTABLE_GAME_EXCLUSIONS_CACHE_TTL_MS;

    router.get(
        "/",
        route({
            summary: "Get Detectable Game Exclusions",
            responses: {
                200: {
                    body: "DetectableGameExclusionsResponse",
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
                    cache.data = await fetchDetectableGameExclusions(fetcher);
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

export default createDetectableGameExclusionsRouter();
