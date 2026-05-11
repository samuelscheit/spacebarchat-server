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
import { ChannelType, type StoreListingResponse } from "@spacebar/schemas";
import { Channel, DiscordApiErrors } from "@spacebar/util";
import { Router as createRouter, type Request, type Response, type Router } from "express";
import { parseStoreSkuQuery, toStoreListingResponse, UNKNOWN_STORE_LISTING_ERROR, type StoreListingSource } from "../../store/listings/#store_listing_id";
import type { StoreSkuQueryOptions } from "../../../util/utility/StoreSkuRoute";

export interface ChannelStoreListingProviderOptions extends StoreSkuQueryOptions {
    channel_id: string;
}

export type ChannelStoreListingProvider = (options: ChannelStoreListingProviderOptions) => StoreListingSource | undefined | Promise<StoreListingSource | undefined>;

export type ChannelStoreListingChannel = Pick<Channel, "id" | "guild_id" | "type">;

export type ChannelStoreListingRepository = {
    findOneOrFail(options: unknown): Promise<ChannelStoreListingChannel>;
};

export type ChannelStoreListingRouteDependencies = {
    channelRepository?: ChannelStoreListingRepository;
    listingProvider?: ChannelStoreListingProvider;
};

export { UNKNOWN_STORE_LISTING_ERROR };

export function getConfiguredChannelStoreListing(_options: ChannelStoreListingProviderOptions): StoreListingSource | undefined {
    // Spacebar does not currently persist Discord channel store listing catalogs.
    return undefined;
}

export function assertChannelSupportsStoreListing(channel: Pick<ChannelStoreListingChannel, "type">): void {
    if (channel.type !== ChannelType.GUILD_STORE) throw DiscordApiErrors.CANNOT_EXECUTE_ON_THIS_CHANNEL_TYPE;
}

export async function getChannelStoreListing(
    channelId: string,
    options: StoreSkuQueryOptions,
    dependencies: ChannelStoreListingRouteDependencies = {},
): Promise<StoreListingResponse> {
    const channelRepository = dependencies.channelRepository ?? (Channel as ChannelStoreListingRepository);
    const channel = await channelRepository.findOneOrFail({
        where: { id: channelId },
        select: {
            id: true,
            guild_id: true,
            type: true,
        },
    });

    assertChannelSupportsStoreListing(channel);

    const provider = dependencies.listingProvider ?? getConfiguredChannelStoreListing;
    const listing = await provider({ channel_id: channelId, ...options });
    if (!listing) throw UNKNOWN_STORE_LISTING_ERROR;

    return toStoreListingResponse(listing);
}

export function createChannelStoreListingRouter(dependencies: ChannelStoreListingRouteDependencies = {}) {
    const router: Router = createRouter({ mergeParams: true });

    router.get(
        "/",
        route({
            permission: "VIEW_CHANNEL",
            summary: "Get Channel Store Listing",
            description: "Returns the locally backed store listing object for a guild store channel when the current user can view the channel.",
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
            const query = parseStoreSkuQuery(req.query);
            const listing = await getChannelStoreListing(req.params.channel_id as string, query, dependencies);

            return res.status(200).json(listing);
        },
    );

    return router;
}

export default createChannelStoreListingRouter();
