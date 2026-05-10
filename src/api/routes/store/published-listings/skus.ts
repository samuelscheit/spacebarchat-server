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

import { route } from "@spacebar/api";
import type { StorePublishedListingsSkusResponse } from "@spacebar/schemas";
import { DiscordApiErrors } from "@spacebar/util";
import { Request, Response, Router } from "express";

const emptyPublishedStoreListings: readonly unknown[] = [];

export interface StorePublishedListingsSkusQueryOptions {
    application_id: string;
    guild_id?: string;
    country_code?: string;
    localize?: boolean;
}

export type StorePublishedListingsSkusProvider = (options: StorePublishedListingsSkusQueryOptions) => readonly unknown[];

function firstQueryValue(value: unknown): unknown {
    if (Array.isArray(value)) return firstQueryValue(value[0]);
    return value;
}

function queryString(value: unknown): string | undefined {
    const entry = firstQueryValue(value);
    return typeof entry === "string" && entry.length > 0 ? entry : undefined;
}

function queryBoolean(value: unknown): boolean | undefined {
    const entry = queryString(value);
    if (entry === "true" || entry === "1") return true;
    if (entry === "false" || entry === "0") return false;
    return undefined;
}

function assertSnowflake(value: unknown): asserts value is string {
    if (typeof value !== "string" || !/^\d{1,20}$/.test(value)) throw DiscordApiErrors.INVALID_FORM_BODY;
}

function requiredSnowflake(value: unknown): string {
    const entry = queryString(value);
    assertSnowflake(entry);
    return entry;
}

function optionalSnowflake(value: unknown): string | undefined {
    const entry = queryString(value);
    if (entry === undefined) return undefined;

    assertSnowflake(entry);
    return entry;
}

export function parseStorePublishedListingsSkusQuery(query: Request["query"]): StorePublishedListingsSkusQueryOptions {
    return {
        application_id: requiredSnowflake(query.application_id),
        guild_id: optionalSnowflake(query.guild_id),
        country_code: queryString(query.country_code),
        localize: queryBoolean(query.localize),
    };
}

export function getStorePublishedListingsSkus(_options: StorePublishedListingsSkusQueryOptions): readonly unknown[] {
    // Spacebar does not currently persist Discord published store listing catalogs.
    return emptyPublishedStoreListings;
}

export function listStorePublishedListingsSkus(
    options: StorePublishedListingsSkusQueryOptions,
    listingProvider: StorePublishedListingsSkusProvider = getStorePublishedListingsSkus,
): StorePublishedListingsSkusResponse {
    return Array.from(listingProvider(options));
}

export function createStorePublishedListingsSkusRouter(listingProvider: StorePublishedListingsSkusProvider = getStorePublishedListingsSkus) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Application Published Store Listings",
            description: "Returns published store listing objects for an application.",
            query: {
                application_id: {
                    type: "string",
                    required: true,
                    description: "Application ID to retrieve published store listings for.",
                },
                guild_id: {
                    type: "string",
                    description: "Guild ID used to fetch hidden listings.",
                },
                country_code: {
                    type: "string",
                    description: "ISO 3166-1 alpha-2 country code used for localized pricing.",
                },
                localize: {
                    type: "boolean",
                    description: "Whether to localize SKUs for the viewer's location.",
                },
            },
            responses: {
                200: {
                    body: "StorePublishedListingsSkusResponse",
                },
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        (req: Request, res: Response) => {
            const options = parseStorePublishedListingsSkusQuery(req.query);
            res.status(200).json(listStorePublishedListingsSkus(options, listingProvider));
        },
    );

    router.get("/:sku_id", route({}), (req: Request, res: Response) => {
        //TODO
        // const id = req.params.id;
        res.json({
            id: "",
            summary: "",
            sku: {
                id: "",
                type: 1,
                dependent_sku_id: null,
                application_id: "",
                manifets_labels: [],
                access_type: 2,
                name: "",
                features: [],
                release_date: "",
                premium: false,
                slug: "",
                flags: 4,
                genres: [],
                legal_notice: "",
                application: {
                    id: "",
                    name: "",
                    icon: "",
                    description: "",
                    summary: "",
                    cover_image: "",
                    primary_sku_id: "",
                    hook: true,
                    slug: "",
                    guild_id: "",
                    bot_public: "",
                    bot_require_code_grant: false,
                    verify_key: "",
                    publishers: [
                        {
                            id: "",
                            name: "",
                        },
                    ],
                    developers: [
                        {
                            id: "",
                            name: "",
                        },
                    ],
                    system_requirements: {},
                    show_age_gate: false,
                    price: {
                        amount: 0,
                        currency: "EUR",
                    },
                    locales: [],
                },
                tagline: "",
                description: "",
                carousel_items: [
                    {
                        asset_id: "",
                    },
                ],
                header_logo_dark_theme: {}, //{id: "", size: 4665, mime_type: "image/gif", width 160, height: 160}
                header_logo_light_theme: {},
                box_art: {},
                thumbnail: {},
                header_background: {},
                hero_background: {},
                assets: [],
            },
        }).status(200);
    });

    return router;
}

export default createStorePublishedListingsSkusRouter();
