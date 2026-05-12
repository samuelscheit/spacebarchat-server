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
import { type GooglePlayVerifyPurchaseTokenSchema } from "@spacebar/schemas";
import { ApiError } from "@spacebar/util";
import { Request, Response, Router } from "express";

export const GOOGLE_PLAY_VERIFY_PURCHASE_TOKEN_UNSUPPORTED_MESSAGE = "Google Play purchase-token verification is not supported on this Spacebar instance.";

export interface GooglePlayVerifyPurchaseTokenRequest {
    user_id: string;
    purchase_token: string;
    package_name?: string;
    product_id?: string;
    sku_id?: string;
    subscription_plan_id?: string;
    ip?: string;
    userAgent?: string;
}

export interface GooglePlayVerifyPurchaseTokenDependencies {
    verifyPurchaseToken(request: GooglePlayVerifyPurchaseTokenRequest): Promise<void>;
}

export function createGooglePlayVerifyPurchaseTokenUnsupportedError(): ApiError {
    return new ApiError(GOOGLE_PLAY_VERIFY_PURCHASE_TOKEN_UNSUPPORTED_MESSAGE, 0, 501);
}

const defaultGooglePlayVerifyPurchaseTokenDependencies: GooglePlayVerifyPurchaseTokenDependencies = {
    async verifyPurchaseToken() {
        // A successful implementation must call Google Play with configured
        // publisher credentials and persist verified entitlement/subscription
        // state. Without that provider and model, do not grant local benefits.
        throw createGooglePlayVerifyPurchaseTokenUnsupportedError();
    },
};

function buildVerifyPurchaseTokenRequest(req: Request, body: GooglePlayVerifyPurchaseTokenSchema): GooglePlayVerifyPurchaseTokenRequest {
    return {
        user_id: req.user_id,
        purchase_token: body.purchase_token,
        package_name: body.package_name,
        product_id: body.product_id,
        sku_id: body.sku_id,
        subscription_plan_id: body.subscription_plan_id,
        ip: req.ip,
        userAgent: req.get("user-agent"),
    };
}

export function createGooglePlayVerifyPurchaseTokenRouter(dependencies: GooglePlayVerifyPurchaseTokenDependencies = defaultGooglePlayVerifyPurchaseTokenDependencies) {
    const router: Router = Router({ mergeParams: true });

    router.post(
        "/",
        route({
            summary: "Verify Google Play Purchase Token",
            description:
                "Verifies a Google Play purchase token with a configured billing provider and persists the resulting local entitlement or subscription state. The default Spacebar instance has no Google Play publisher credentials or durable purchase-token entitlement model, so this compatibility endpoint fails closed with 501 instead of granting benefits from unverified client input.",
            requestBody: "GooglePlayVerifyPurchaseTokenSchema",
            coerceRequestBody: false,
            responses: {
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
            const body = req.body as GooglePlayVerifyPurchaseTokenSchema;

            await dependencies.verifyPurchaseToken(buildVerifyPurchaseTokenRequest(req, body));

            return res.sendStatus(204);
        },
    );

    return router;
}

export default createGooglePlayVerifyPurchaseTokenRouter();
