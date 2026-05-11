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
import { Router as createRouter, type Request, type Response, type Router } from "express";
import {
    getConfiguredStorefrontCollection,
    getStorefrontCollection,
    parseStorefrontCollectionQuery,
    type StorefrontCollectionProvider,
} from "../../../util/utility/StorefrontCollectionRoute";

export {
    getConfiguredStorefrontCollection,
    getStorefrontCollection,
    isStorefrontCollectionId,
    parseStorefrontCollectionQuery,
    toStorefrontCollectionResponse,
    UNKNOWN_STOREFRONT_COLLECTION_ERROR,
    type StorefrontCollectionProvider,
    type StorefrontCollectionProviderOptions,
    type StorefrontCollectionQueryOptions,
    type StorefrontCollectionSource,
} from "../../../util/utility/StorefrontCollectionRoute";

export function createStorefrontCollectionRouter(collectionProvider: StorefrontCollectionProvider = getConfiguredStorefrontCollection) {
    const router: Router = createRouter({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Storefront Collection",
            description: "Returns the locally backed storefront collection and locally backed products for the given collection ID.",
            query: {
                country_code: {
                    type: "string",
                    description: "ISO 3166-1 alpha-2 country code used for localized pricing.",
                },
                guild_id: {
                    type: "string",
                    description: "Guild ID used to fetch a guild-specific storefront collection.",
                },
                include_unpublished_products: {
                    type: "boolean",
                    description: "Whether to include unpublished products when supported by the local provider.",
                },
                include_unpublished_collection: {
                    type: "boolean",
                    description: "Whether to include an unpublished collection when supported by the local provider.",
                },
            },
            responses: {
                200: {
                    body: "StorefrontCollectionResponse",
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
            const query = parseStorefrontCollectionQuery(req.query);
            const collection = await getStorefrontCollection(req.params.collection_id as string, query, collectionProvider);

            return res.status(200).json(collection);
        },
    );

    return router;
}

export default createStorefrontCollectionRouter();
