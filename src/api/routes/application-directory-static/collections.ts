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
import type { ApplicationDirectoryCollection, ApplicationDirectoryCollectionsResponse } from "@spacebar/schemas";
import { Router as createRouter, type Request, type Response, type Router } from "express";

export const APPLICATION_DIRECTORY_COLLECTIONS_CACHE_CONTROL = "public, max-age=3600, s-maxage=3600";

const emptyApplicationDirectoryCollections: readonly ApplicationDirectoryCollection[] = [];

export interface ApplicationDirectoryCollectionsQueryOptions {
    surface?: number;
    active_state?: number;
    platform?: number;
    locale?: string;
    cache?: boolean;
}

export type ApplicationDirectoryCollectionsProvider = (options: ApplicationDirectoryCollectionsQueryOptions) => readonly ApplicationDirectoryCollection[];

export function getApplicationDirectoryCollections(_options: ApplicationDirectoryCollectionsQueryOptions = {}): readonly ApplicationDirectoryCollection[] {
    // Spacebar currently has no source-backed App Directory collection catalog.
    return emptyApplicationDirectoryCollections;
}

function firstQueryValue(value: unknown): unknown {
    if (Array.isArray(value)) return value[0];
    return value;
}

function parseOptionalString(value: unknown): string | undefined {
    const entry = firstQueryValue(value);
    return typeof entry === "string" && entry.length > 0 ? entry : undefined;
}

function parseOptionalBoolean(value: unknown): boolean | undefined {
    const entry = firstQueryValue(value);
    if (typeof entry === "boolean") return entry;
    if (entry === "true") return true;
    if (entry === "false") return false;
    return undefined;
}

function parseOptionalInteger(value: unknown): number | undefined {
    const entry = firstQueryValue(value);
    if (typeof entry === "number" && Number.isSafeInteger(entry)) return entry;
    if (typeof entry !== "string" || !/^-?\d+$/.test(entry)) return undefined;

    const parsed = Number.parseInt(entry, 10);
    return Number.isSafeInteger(parsed) ? parsed : undefined;
}

export function parseApplicationDirectoryCollectionsQuery(query: Request["query"]): ApplicationDirectoryCollectionsQueryOptions {
    return {
        surface: parseOptionalInteger(query.surface),
        active_state: parseOptionalInteger(query.active_state),
        platform: parseOptionalInteger(query.platform),
        locale: parseOptionalString(query.locale),
        cache: parseOptionalBoolean(query.cache),
    };
}

export function createApplicationDirectoryCollectionsRouter(collectionsProvider: ApplicationDirectoryCollectionsProvider = getApplicationDirectoryCollections) {
    const router: Router = createRouter({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Application Directory Collections",
            query: {
                surface: {
                    type: "integer",
                    description: "Application directory request surface used by clients for analytics.",
                },
                active_state: {
                    type: "integer",
                    description: "Directory active-state filter. Discord limits this filter to employees.",
                },
                platform: {
                    type: "integer",
                    description: "Application directory platform flag filter.",
                },
                locale: {
                    type: "string",
                    description: "Locale to return collection text in.",
                },
                cache: {
                    type: "boolean",
                    description: "Whether to return cached results. Discord limits this option to employees.",
                },
            },
            responses: {
                200: {
                    body: "ApplicationDirectoryCollectionsResponse",
                },
            },
        }),
        (req: Request, res: Response) => {
            const options = parseApplicationDirectoryCollectionsQuery(req.query);
            const response: ApplicationDirectoryCollectionsResponse = Array.from(collectionsProvider(options));

            res.set("Cache-Control", APPLICATION_DIRECTORY_COLLECTIONS_CACHE_CONTROL).status(200).json(response);
        },
    );

    return router;
}

export default createApplicationDirectoryCollectionsRouter();
