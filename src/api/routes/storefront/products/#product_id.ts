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
import { getConfiguredStorefrontProduct, getStorefrontProduct, type StorefrontProductProvider } from "../../../util/utility/StorefrontProductRoute";

export {
    getConfiguredStorefrontProduct,
    getStorefrontProduct,
    isStorefrontProductId,
    toStorefrontProductResponse,
    UNKNOWN_STOREFRONT_PRODUCT_ERROR,
    type StorefrontProductProvider,
    type StorefrontProductProviderOptions,
    type StorefrontProductSource,
} from "../../../util/utility/StorefrontProductRoute";

export function createStorefrontProductRouter(productProvider: StorefrontProductProvider = getConfiguredStorefrontProduct) {
    const router: Router = createRouter({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Storefront Product",
            description: "Returns the locally backed storefront product object for the given product ID.",
            responses: {
                200: {
                    body: "StorefrontProductResponse",
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
            const product = await getStorefrontProduct(req.params.product_id as string, productProvider);

            return res.status(200).json(product);
        },
    );

    return router;
}

export default createStorefrontProductRouter();
