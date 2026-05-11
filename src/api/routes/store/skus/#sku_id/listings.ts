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
import type { StoreSkuListingsResponse } from "@spacebar/schemas";
import { DiscordApiErrors } from "@spacebar/util";
import { Router as createRouter, type Request, type Response, type Router } from "express";
import type { ApplicationCommandAuthorizationRepository } from "../../../../util/utility/ApplicationAuthorization";
import { getStoreSku, parseStoreSkuQuery, type StoreSkuProvider, type StoreSkuQueryOptions } from "../../../../util/utility/StoreSkuRoute";

const emptyStoreSkuListings: readonly unknown[] = [];

export interface StoreSkuListingsProviderOptions extends StoreSkuQueryOptions {
    sku_id: string;
}

export type StoreSkuListingsProvider = (options: StoreSkuListingsProviderOptions) => readonly unknown[] | Promise<readonly unknown[]>;

export type StoreSkuListingsRouteDependencies = {
    applicationRepository?: ApplicationCommandAuthorizationRepository;
    skuProvider?: StoreSkuProvider;
    listingProvider?: StoreSkuListingsProvider;
};

export function getConfiguredStoreSkuListings(_options: StoreSkuListingsProviderOptions): readonly unknown[] {
    // Spacebar does not currently persist Discord SKU store listing catalogs.
    return emptyStoreSkuListings;
}

export async function listStoreSkuListings(
    skuId: string,
    userId: string,
    options: StoreSkuQueryOptions,
    dependencies: StoreSkuListingsRouteDependencies = {},
): Promise<StoreSkuListingsResponse> {
    await getStoreSku(skuId, userId, options, dependencies);

    const provider = dependencies.listingProvider ?? getConfiguredStoreSkuListings;
    return Array.from(await provider({ sku_id: skuId, ...options }));
}

function sendApplicationAuthorizationError(res: Response) {
    return res.status(403).json({
        code: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code,
        message: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.message,
    });
}

function isApplicationAuthorizationError(error: unknown) {
    return (error as { code?: unknown })?.code === DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code;
}

export function createStoreSkuListingsRouter(dependencies: StoreSkuListingsRouteDependencies = {}) {
    const router: Router = createRouter({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get SKU Store Listings",
            description: "Returns locally backed store listing objects for the given SKU ID after verifying the current user can access the SKU's owning application.",
            query: {
                country_code: {
                    type: "string",
                    description: "ISO 3166-1 alpha-2 country code used for localized pricing.",
                },
                localize: {
                    type: "boolean",
                    description: "Whether to localize listings for the viewer's location (default true).",
                },
            },
            responses: {
                200: {
                    body: "StoreSkuListingsResponse",
                },
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
                403: {
                    body: "APIErrorResponse",
                },
                404: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            try {
                const query = parseStoreSkuQuery(req.query);
                const listings = await listStoreSkuListings(req.params.sku_id as string, req.user_id, query, dependencies);

                return res.status(200).json(listings);
            } catch (error) {
                if (isApplicationAuthorizationError(error)) return sendApplicationAuthorizationError(res);
                throw error;
            }
        },
    );

    return router;
}

export default createStoreSkuListingsRouter();
