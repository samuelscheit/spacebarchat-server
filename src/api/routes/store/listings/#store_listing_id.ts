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
import type { StoreListingResponse, StoreSkuLocalizedString } from "@spacebar/schemas";
import { ApiError, DiscordApiErrors } from "@spacebar/util";
import { Router as createRouter, type Request, type Response, type Router } from "express";
import { requireApplicationStoreAccess, type ApplicationCommandAuthorizationRepository } from "../../../util/utility/ApplicationAuthorization";
import { isStoreSkuRouteSnowflake, parseStoreSkuQuery, toStoreSkuResponse, type StoreSkuQueryOptions, type StoreSkuSource } from "../../../util/utility/StoreSkuRoute";

export { isStoreSkuRouteSnowflake, parseStoreSkuQuery } from "../../../util/utility/StoreSkuRoute";

export interface StoreListingProviderOptions extends StoreSkuQueryOptions {
    store_listing_id: string;
}

export interface StoreListingSource {
    id: string;
    sku: StoreSkuSource;
    child_skus?: StoreSkuSource[];
    alternative_skus?: StoreSkuSource[];
    summary: StoreSkuLocalizedString;
    description?: StoreSkuLocalizedString;
    tagline?: StoreSkuLocalizedString | null;
    flavor_text?: string | null;
    benefits?: object[] | null;
    published?: boolean;
    carousel_items?: object[] | null;
    staff_notes?: object;
    guild?: object | null;
    assets?: object[];
    thumbnail?: object;
    preview_video?: object;
    header_background?: object;
    header_logo_dark_theme?: object;
    header_logo_light_theme?: object;
    box_art?: object;
    hero_background?: object;
    hero_video?: object;
    entitlement_branch_id?: string | null;
    published_at?: string | null;
    unpublished_at?: string | null;
    powerup_metadata?: object;
}

export type StoreListingProvider = (options: StoreListingProviderOptions) => StoreListingSource | undefined | Promise<StoreListingSource | undefined>;

export type StoreListingRouteDependencies = {
    applicationRepository?: ApplicationCommandAuthorizationRepository;
    listingProvider?: StoreListingProvider;
};

export const UNKNOWN_STORE_LISTING_ERROR = new ApiError("Unknown Store Listing", 10028, 404);

export function isStoreListingRouteSnowflake(value: string) {
    return isStoreSkuRouteSnowflake(value);
}

export function getConfiguredStoreListing(_options: StoreListingProviderOptions): StoreListingResponse | undefined {
    // Spacebar does not currently persist Discord store listing catalogs.
    return undefined;
}

function cloneObjectArray<T extends object>(items: readonly T[]): T[] {
    return items.map((item) => ({ ...item }));
}

export function toStoreListingResponse(listing: StoreListingSource): StoreListingResponse {
    const response: StoreListingResponse = {
        id: listing.id,
        sku: toStoreSkuResponse(listing.sku),
        summary: listing.summary,
    };

    if (listing.child_skus !== undefined) response.child_skus = listing.child_skus.map(toStoreSkuResponse);
    if (listing.alternative_skus !== undefined) response.alternative_skus = listing.alternative_skus.map(toStoreSkuResponse);
    if (listing.description !== undefined) response.description = listing.description;
    if (listing.tagline !== undefined) response.tagline = listing.tagline;
    if (listing.flavor_text !== undefined) response.flavor_text = listing.flavor_text;
    if (listing.benefits !== undefined) response.benefits = listing.benefits === null ? null : cloneObjectArray(listing.benefits);
    if (listing.published !== undefined) response.published = listing.published;
    if (listing.carousel_items !== undefined) response.carousel_items = listing.carousel_items === null ? null : cloneObjectArray(listing.carousel_items);
    if (listing.staff_notes !== undefined) response.staff_notes = { ...listing.staff_notes };
    if (listing.guild !== undefined) response.guild = listing.guild === null ? null : { ...listing.guild };
    if (listing.assets !== undefined) response.assets = cloneObjectArray(listing.assets);
    if (listing.thumbnail !== undefined) response.thumbnail = { ...listing.thumbnail };
    if (listing.preview_video !== undefined) response.preview_video = { ...listing.preview_video };
    if (listing.header_background !== undefined) response.header_background = { ...listing.header_background };
    if (listing.header_logo_dark_theme !== undefined) response.header_logo_dark_theme = { ...listing.header_logo_dark_theme };
    if (listing.header_logo_light_theme !== undefined) response.header_logo_light_theme = { ...listing.header_logo_light_theme };
    if (listing.box_art !== undefined) response.box_art = { ...listing.box_art };
    if (listing.hero_background !== undefined) response.hero_background = { ...listing.hero_background };
    if (listing.hero_video !== undefined) response.hero_video = { ...listing.hero_video };
    if (listing.entitlement_branch_id !== undefined) response.entitlement_branch_id = listing.entitlement_branch_id;
    if (listing.published_at !== undefined) response.published_at = listing.published_at;
    if (listing.unpublished_at !== undefined) response.unpublished_at = listing.unpublished_at;
    if (listing.powerup_metadata !== undefined) response.powerup_metadata = { ...listing.powerup_metadata };

    return response;
}

export async function getStoreListing(
    storeListingId: string,
    userId: string,
    options: StoreSkuQueryOptions,
    dependencies: StoreListingRouteDependencies = {},
): Promise<StoreListingResponse> {
    if (!isStoreListingRouteSnowflake(storeListingId)) throw UNKNOWN_STORE_LISTING_ERROR;

    const provider = dependencies.listingProvider ?? getConfiguredStoreListing;
    const listing = await provider({ store_listing_id: storeListingId, ...options });
    if (!listing) throw UNKNOWN_STORE_LISTING_ERROR;

    await requireApplicationStoreAccess(listing.sku.application_id, userId, dependencies.applicationRepository);

    return toStoreListingResponse(listing);
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

export function createStoreListingRouter(dependencies: StoreListingRouteDependencies = {}) {
    const router: Router = createRouter({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Store Listing",
            description: "Returns the locally backed store listing object for the given listing ID when the current user can access the listing's owning application.",
            query: {
                country_code: {
                    type: "string",
                    description: "ISO 3166-1 alpha-2 country code used for localized pricing.",
                },
                localize: {
                    type: "boolean",
                    description: "Whether to localize the listing and SKU for the viewer's location (default true).",
                },
            },
            responses: {
                200: {
                    body: "StoreListingResponse",
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
                const listing = await getStoreListing(req.params.store_listing_id as string, req.user_id, query, dependencies);

                return res.status(200).json(listing);
            } catch (error) {
                if (isApplicationAuthorizationError(error)) return sendApplicationAuthorizationError(res);
                throw error;
            }
        },
    );

    return router;
}

export default createStoreListingRouter();
