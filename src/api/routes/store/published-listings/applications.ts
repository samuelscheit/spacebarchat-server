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
import type { StorePublishedListingsApplicationsResponse } from "@spacebar/schemas";
import { FieldErrors } from "@spacebar/util";
import { Router as createRouter, type Request, type Response, type Router } from "express";

const emptyPublishedApplicationStoreListings: readonly unknown[] = [];
const snowflakePattern = /^\d{1,20}$/;

export interface StorePublishedListingsApplicationsQueryOptions {
    application_ids: string[];
    country_code?: string;
    localize: boolean;
}

export type StorePublishedListingsApplicationsProvider = (options: StorePublishedListingsApplicationsQueryOptions) => readonly unknown[];

function queryValues(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap(queryValues);
    if (typeof value !== "string") return [];

    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

function firstQueryValue(value: unknown): unknown {
    if (Array.isArray(value)) return firstQueryValue(value[0]);
    return value;
}

function queryString(value: unknown): string | undefined {
    const entry = firstQueryValue(value);
    return typeof entry === "string" && entry.length > 0 ? entry : undefined;
}

function queryBoolean(value: unknown, defaultValue: boolean): boolean {
    const entry = queryString(value);
    if (entry === undefined) return defaultValue;
    if (entry === "true" || entry === "1") return true;
    if (entry === "false" || entry === "0") return false;

    throw FieldErrors({
        localize: {
            code: "BASE_TYPE_INVALID",
            message: "localize must be a boolean",
        },
    });
}

export function parseStorePublishedListingsApplicationsQuery(query: Request["query"]): StorePublishedListingsApplicationsQueryOptions {
    const rawApplicationIds = [...queryValues(query.application_ids), ...queryValues(query["application_ids[]"])];

    if (!rawApplicationIds.length) {
        throw FieldErrors({
            application_ids: {
                code: "BASE_TYPE_REQUIRED",
                message: "application_ids is required",
            },
        });
    }

    if (rawApplicationIds.length > 100) {
        throw FieldErrors({
            application_ids: {
                code: "BASE_TYPE_BAD_LENGTH",
                message: "application_ids must contain between 1 and 100 values",
            },
        });
    }

    if (rawApplicationIds.some((applicationId) => !snowflakePattern.test(applicationId))) {
        throw FieldErrors({
            application_ids: {
                code: "BASE_TYPE_INVALID",
                message: "application_ids must contain valid snowflakes",
            },
        });
    }

    return {
        application_ids: [...new Set(rawApplicationIds)],
        country_code: queryString(query.country_code),
        localize: queryBoolean(query.localize, true),
    };
}

export function getStorePublishedListingsApplications(_options: StorePublishedListingsApplicationsQueryOptions): readonly unknown[] {
    // Spacebar does not currently persist Discord published primary application store listing catalogs.
    return emptyPublishedApplicationStoreListings;
}

export function listStorePublishedListingsApplications(
    options: StorePublishedListingsApplicationsQueryOptions,
    listingProvider: StorePublishedListingsApplicationsProvider = getStorePublishedListingsApplications,
): StorePublishedListingsApplicationsResponse {
    return Array.from(listingProvider(options));
}

export function createStorePublishedListingsApplicationsRouter(listingProvider: StorePublishedListingsApplicationsProvider = getStorePublishedListingsApplications) {
    const router: Router = createRouter({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Bulk Application Primary Store Listing",
            description: "Returns published store listing objects for the primary SKUs of the given application IDs.",
            query: {
                application_ids: {
                    type: "array",
                    required: true,
                    description: "Application IDs to retrieve primary published store listings for (1-100).",
                },
                country_code: {
                    type: "string",
                    description: "ISO 3166-1 alpha-2 country code used for localized pricing.",
                },
                localize: {
                    type: "boolean",
                    description: "Whether to localize SKUs for the viewer's location (default true).",
                },
            },
            responses: {
                200: {
                    body: "StorePublishedListingsApplicationsResponse",
                },
                400: {
                    body: "APIErrorResponse",
                },
            },
        }),
        (req: Request, res: Response) => {
            const options = parseStorePublishedListingsApplicationsQuery(req.query);
            res.status(200).json(listStorePublishedListingsApplications(options, listingProvider));
        },
    );

    return router;
}

export default createStorePublishedListingsApplicationsRouter();
