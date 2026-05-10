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
import type { CollectiblesCategoriesV2Response, CollectiblesCategory } from "@spacebar/schemas";
import { Router as createRouter, type Request, type Response, type Router } from "express";

const emptyCollectiblesCatalog: readonly CollectiblesCategory[] = [];

export interface CollectiblesCategoriesV2QueryOptions {
    country_code?: string;
    include_bundles?: boolean;
    include_nameplates_on_mobile?: boolean;
    include_unpublished?: boolean;
    no_cache?: boolean;
    payment_gateway?: number;
    skip_num_categories?: number;
    variants_return_style?: number;
}

export type CollectiblesCategoriesV2CatalogProvider = (options: CollectiblesCategoriesV2QueryOptions) => readonly CollectiblesCategory[];

export function getCollectiblesCategoriesV2Catalog(_options: CollectiblesCategoriesV2QueryOptions = {}): readonly CollectiblesCategory[] {
    // Spacebar currently has no persisted collectible category or product catalog backing.
    return emptyCollectiblesCatalog;
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

export function parseCollectiblesCategoriesV2Query(query: Request["query"]): CollectiblesCategoriesV2QueryOptions {
    return {
        country_code: parseOptionalString(query.country_code),
        include_bundles: parseOptionalBoolean(query.include_bundles),
        include_nameplates_on_mobile: parseOptionalBoolean(query.include_nameplates_on_mobile),
        include_unpublished: parseOptionalBoolean(query.include_unpublished),
        no_cache: parseOptionalBoolean(query.no_cache),
        payment_gateway: parseOptionalInteger(query.payment_gateway),
        skip_num_categories: parseOptionalInteger(query.skip_num_categories),
        variants_return_style: parseOptionalInteger(query.variants_return_style),
    };
}

export function createCollectiblesCategoriesV2Router(catalogProvider: CollectiblesCategoriesV2CatalogProvider = getCollectiblesCategoriesV2Catalog) {
    const router: Router = createRouter({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Collectibles Categories V2",
            query: {
                country_code: {
                    type: "string",
                    description: "ISO 3166-1 alpha-2 country code used for localized pricing.",
                },
                include_bundles: {
                    type: "boolean",
                    description: "Whether to include bundle products.",
                },
                include_nameplates_on_mobile: {
                    type: "boolean",
                    description: "Whether to include mobile nameplate assets.",
                },
                include_unpublished: {
                    type: "boolean",
                    description: "Whether to include unpublished collectible categories.",
                },
                no_cache: {
                    type: "boolean",
                    description: "Whether to bypass cached catalog data.",
                },
                payment_gateway: {
                    type: "integer",
                    description: "Payment gateway used to select storefront pricing.",
                },
                skip_num_categories: {
                    type: "integer",
                    description: "Number of categories to skip for pagination.",
                },
                variants_return_style: {
                    type: "integer",
                    description: "Variant return style requested by the client.",
                },
            },
            responses: {
                200: {
                    body: "CollectiblesCategoriesV2Response",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        (req: Request, res: Response) => {
            const options = parseCollectiblesCategoriesV2Query(req.query);
            const response: CollectiblesCategoriesV2Response = {
                categories: Array.from(catalogProvider(options)),
            };

            res.status(200).json(response);
        },
    );

    return router;
}

export default createCollectiblesCategoriesV2Router();
