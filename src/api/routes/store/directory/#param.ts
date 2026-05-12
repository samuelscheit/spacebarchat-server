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
import type { StoreDirectoryResponse } from "@spacebar/schemas";
import { ApiError, DiscordApiErrors, FieldErrors } from "@spacebar/util";
import { Router as createRouter, type Request, type Response, type Router } from "express";

const routeSnowflakePattern = /^[1-9]\d{16,19}$/;

export interface StoreDirectoryQueryOptions {
    country_code?: string;
    localize: boolean;
}

export interface StoreDirectoryProviderOptions extends StoreDirectoryQueryOptions {
    directory_id: string;
}

export type StoreDirectoryProvider = (options: StoreDirectoryProviderOptions) => StoreDirectoryResponse | undefined | Promise<StoreDirectoryResponse | undefined>;

export const UNKNOWN_STORE_DIRECTORY_ERROR = new ApiError(DiscordApiErrors.UNKNOWN_STORE_DIRECTORY_LAYOUT.message, DiscordApiErrors.UNKNOWN_STORE_DIRECTORY_LAYOUT.code, 404);

function firstQueryValue(value: unknown): unknown {
    if (Array.isArray(value)) return firstQueryValue(value[0]);
    return value;
}

function queryString(value: unknown): string | undefined {
    const entry = firstQueryValue(value);
    return typeof entry === "string" && entry.length > 0 ? entry : undefined;
}

function queryBoolean(value: unknown, field: string, defaultValue: boolean): boolean {
    const entry = queryString(value);
    if (entry === undefined) return defaultValue;
    if (entry === "true" || entry === "1") return true;
    if (entry === "false" || entry === "0") return false;

    throw FieldErrors({
        [field]: {
            code: "BASE_TYPE_INVALID",
            message: `${field} must be a boolean`,
        },
    });
}

export function isStoreDirectoryRouteSnowflake(value: string) {
    return routeSnowflakePattern.test(value);
}

export function parseStoreDirectoryQuery(query: Request["query"]): StoreDirectoryQueryOptions {
    return {
        country_code: queryString(query.country_code),
        localize: queryBoolean(query.localize, "localize", true),
    };
}

export function getConfiguredStoreDirectory(_options: StoreDirectoryProviderOptions): StoreDirectoryResponse | undefined {
    // Spacebar does not currently persist Discord's curated store directory catalog.
    return undefined;
}

export async function getStoreDirectory(
    directoryId: string,
    options: StoreDirectoryQueryOptions,
    directoryProvider: StoreDirectoryProvider = getConfiguredStoreDirectory,
): Promise<StoreDirectoryResponse> {
    if (!isStoreDirectoryRouteSnowflake(directoryId)) throw UNKNOWN_STORE_DIRECTORY_ERROR;

    const directory = await directoryProvider({ directory_id: directoryId, ...options });
    if (directory === undefined) throw UNKNOWN_STORE_DIRECTORY_ERROR;

    return directory;
}

export function createStoreDirectoryRouter(directoryProvider: StoreDirectoryProvider = getConfiguredStoreDirectory) {
    const router: Router = createRouter({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Store Directory",
            description: "Returns a locally backed store directory object for the given directory ID when one is configured.",
            query: {
                country_code: {
                    type: "string",
                    description: "ISO 3166-1 alpha-2 country code used for localized store content.",
                },
                localize: {
                    type: "boolean",
                    description: "Whether to localize the directory for the viewer's location (default true).",
                },
            },
            responses: {
                200: {
                    body: "StoreDirectoryResponse",
                },
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
                404: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const query = parseStoreDirectoryQuery(req.query);
            const directory = await getStoreDirectory(req.params.param as string, query, directoryProvider);

            return res.status(200).json(directory);
        },
    );

    return router;
}

export default createStoreDirectoryRouter();
