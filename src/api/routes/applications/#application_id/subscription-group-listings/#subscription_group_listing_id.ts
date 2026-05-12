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
import type { ApplicationSubscriptionGroupListingResponse } from "@spacebar/schemas";
import { ApiError, DiscordApiErrors } from "@spacebar/util";
import { Router as createRouter, type Request, type Response, type Router } from "express";
import { requireApplicationStoreAccess, type ApplicationCommandAuthorizationRepository } from "../../../../util/utility/ApplicationAuthorization";

const routeSnowflakePattern = /^[1-9]\d{16,19}$/;

export interface ApplicationSubscriptionGroupListingProviderOptions {
    application_id: string;
    subscription_group_listing_id: string;
}

export type ApplicationSubscriptionGroupListingSource = ApplicationSubscriptionGroupListingResponse;

export type ApplicationSubscriptionGroupListingProvider = (
    options: ApplicationSubscriptionGroupListingProviderOptions,
) => ApplicationSubscriptionGroupListingSource | undefined | Promise<ApplicationSubscriptionGroupListingSource | undefined>;

export type ApplicationSubscriptionGroupListingRouteDependencies = {
    applicationRepository?: ApplicationCommandAuthorizationRepository;
    listingProvider?: ApplicationSubscriptionGroupListingProvider;
};

export const UNKNOWN_APPLICATION_SUBSCRIPTION_GROUP_LISTING_ERROR = new ApiError(DiscordApiErrors.UNKNOWN_STORE_LISTING.message, DiscordApiErrors.UNKNOWN_STORE_LISTING.code, 404);

export function isApplicationSubscriptionGroupListingRouteSnowflake(value: string) {
    return routeSnowflakePattern.test(value);
}

export function getConfiguredApplicationSubscriptionGroupListing(
    _options: ApplicationSubscriptionGroupListingProviderOptions,
): ApplicationSubscriptionGroupListingSource | undefined {
    // Spacebar does not currently persist Discord application subscription group listing catalogs.
    return undefined;
}

export function toApplicationSubscriptionGroupListingResponse(listing: ApplicationSubscriptionGroupListingSource): ApplicationSubscriptionGroupListingResponse {
    return { ...listing };
}

export async function getApplicationSubscriptionGroupListing(
    applicationId: string,
    subscriptionGroupListingId: string,
    userId: string,
    dependencies: ApplicationSubscriptionGroupListingRouteDependencies = {},
): Promise<ApplicationSubscriptionGroupListingResponse> {
    if (!isApplicationSubscriptionGroupListingRouteSnowflake(applicationId)) throw DiscordApiErrors.UNKNOWN_APPLICATION;
    if (!isApplicationSubscriptionGroupListingRouteSnowflake(subscriptionGroupListingId)) throw UNKNOWN_APPLICATION_SUBSCRIPTION_GROUP_LISTING_ERROR;

    await requireApplicationStoreAccess(applicationId, userId, dependencies.applicationRepository);

    const provider = dependencies.listingProvider ?? getConfiguredApplicationSubscriptionGroupListing;
    const listing = await provider({
        application_id: applicationId,
        subscription_group_listing_id: subscriptionGroupListingId,
    });
    if (!listing) throw UNKNOWN_APPLICATION_SUBSCRIPTION_GROUP_LISTING_ERROR;

    const listingId = listing.id;
    if (typeof listingId === "string" && listingId !== subscriptionGroupListingId) throw UNKNOWN_APPLICATION_SUBSCRIPTION_GROUP_LISTING_ERROR;

    const listingApplicationId = listing.application_id;
    if (typeof listingApplicationId === "string" && listingApplicationId !== applicationId) throw UNKNOWN_APPLICATION_SUBSCRIPTION_GROUP_LISTING_ERROR;

    return toApplicationSubscriptionGroupListingResponse(listing);
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

export function createApplicationSubscriptionGroupListingRouter(dependencies: ApplicationSubscriptionGroupListingRouteDependencies = {}) {
    const router: Router = createRouter({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Application Subscription Group Listing",
            description:
                "Returns a provider-backed application subscription group listing after verifying the current user can access the owning application's store data. Spacebar does not persist Discord subscription group listing catalogs, so the default behavior is a not-found response rather than fabricated commerce state.",
            responses: {
                200: {
                    body: "ApplicationSubscriptionGroupListingResponse",
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
                const listing = await getApplicationSubscriptionGroupListing(
                    req.params.application_id as string,
                    req.params.subscription_group_listing_id as string,
                    req.user_id,
                    dependencies,
                );

                return res.status(200).json(listing);
            } catch (error) {
                if (isApplicationAuthorizationError(error)) return sendApplicationAuthorizationError(res);
                throw error;
            }
        },
    );

    return router;
}

export default createApplicationSubscriptionGroupListingRouter();
