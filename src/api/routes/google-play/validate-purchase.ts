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
import type { GooglePlayValidatePurchaseSchema } from "@spacebar/schemas";
import { ApiError } from "@spacebar/util";
import { Request, Response, Router } from "express";

export const GOOGLE_PLAY_VALIDATE_PURCHASE_UNSUPPORTED_MESSAGE = "Google Play purchase validation is not supported on this Spacebar instance.";

export function createGooglePlayValidatePurchaseUnsupportedError(): ApiError {
    return new ApiError(GOOGLE_PLAY_VALIDATE_PURCHASE_UNSUPPORTED_MESSAGE, 0, 501);
}

export function validateGooglePlayPurchase(userId: string, body: GooglePlayValidatePurchaseSchema): never {
    void userId;
    void body;

    // Google Play validation requires trusted Google Play Developer API credentials,
    // replay protection, and durable entitlement/subscription state.
    throw createGooglePlayValidatePurchaseUnsupportedError();
}

export function createGooglePlayValidatePurchaseRouter() {
    const router: Router = Router({ mergeParams: true });

    router.post(
        "/",
        route({
            summary: "Validate Google Play Purchase",
            description:
                "Registers Discord client's Google Play purchase-validation route. Spacebar does not currently have Google Play Developer API credentials, receipt replay protection, or durable commerce provisioning state, so this endpoint validates the request boundary and fails closed instead of granting purchases locally.",
            requestBody: "GooglePlayValidatePurchaseSchema",
            responses: {
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
        (req: Request, _res: Response) => {
            validateGooglePlayPurchase(req.user_id, req.body as GooglePlayValidatePurchaseSchema);
        },
    );

    return router;
}

export default createGooglePlayValidatePurchaseRouter();
