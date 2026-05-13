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
import type { CollectiblesPremiumProductClaimSchema, CollectiblesPurchasesResponse } from "@spacebar/schemas";
import { ApiError } from "@spacebar/util";
import { Request, Response, Router } from "express";

export type PremiumCollectiblesProductClaimResult = CollectiblesPurchasesResponse | null;

export interface PremiumCollectiblesProductClaimDependencies {
    claimPremiumCollectiblesProduct(userId: string, skuId: string): Promise<PremiumCollectiblesProductClaimResult>;
}

export const PREMIUM_COLLECTIBLES_PRODUCT_CLAIM_UNSUPPORTED_MESSAGE = "Premium collectibles product claims are not supported on this Spacebar instance.";

export function createPremiumCollectiblesProductClaimUnsupportedError(): ApiError {
    return new ApiError(PREMIUM_COLLECTIBLES_PRODUCT_CLAIM_UNSUPPORTED_MESSAGE, 0, 501);
}

const defaultPremiumCollectiblesProductClaimDependencies: PremiumCollectiblesProductClaimDependencies = {
    async claimPremiumCollectiblesProduct() {
        // Discord grants a premium-only collectible SKU and updates current-user
        // ownership here. Spacebar has no durable collectible ownership or
        // premium entitlement backing, so the default route fails closed.
        throw createPremiumCollectiblesProductClaimUnsupportedError();
    },
};

export function createPremiumCollectiblesProductClaimRouter(dependencies: PremiumCollectiblesProductClaimDependencies = defaultPremiumCollectiblesProductClaimDependencies) {
    const router: Router = Router({ mergeParams: true });

    router.put(
        "/",
        route({
            summary: "Claim Premium Collectibles Product",
            description:
                "Claims a premium-only collectible SKU when a real collectibles ownership and premium entitlement provider is configured. The default Spacebar instance has neither, so it validates the documented payload and fails closed with 501 instead of fabricating collectible ownership.",
            requestBody: "CollectiblesPremiumProductClaimSchema",
            coerceRequestBody: false,
            responses: {
                200: {
                    body: "CollectiblesPurchasesResponse",
                },
                204: {},
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
                501: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const body = req.body as CollectiblesPremiumProductClaimSchema;
            const result = await dependencies.claimPremiumCollectiblesProduct(req.user_id, body.sku_id);

            if (result === null) return res.sendStatus(204);

            return res.status(200).json(result);
        },
    );

    return router;
}

export default createPremiumCollectiblesProductClaimRouter();
