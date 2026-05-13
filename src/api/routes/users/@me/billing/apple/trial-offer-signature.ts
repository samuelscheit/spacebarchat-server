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
import { ApiError } from "@spacebar/util";
import { Request, Response, Router } from "express";

export const APPLE_TRIAL_OFFER_SIGNATURE_UNSUPPORTED_MESSAGE = "Apple trial offer signature generation is not supported on this Spacebar instance.";

export function createAppleTrialOfferSignatureUnsupportedError(): ApiError {
    return new ApiError(APPLE_TRIAL_OFFER_SIGNATURE_UNSUPPORTED_MESSAGE, 0, 501);
}

export function createUserBillingAppleTrialOfferSignatureRouter() {
    const router: Router = Router({ mergeParams: true });

    router.post(
        "/",
        route({
            summary: "Generate Apple Trial Offer Signature",
            description:
                "Generates a provider-backed Apple App Store trial offer signature for Discord's billing flow. Spacebar does not currently integrate with Apple offer signing keys or persist Apple trial-offer state, so this compatibility endpoint fails closed instead of returning an unverifiable synthetic signature.",
            responses: {
                401: {
                    body: "APIErrorResponse",
                },
                501: {
                    body: "APIErrorResponse",
                },
            },
        }),
        (_req: Request, _res: Response) => {
            throw createAppleTrialOfferSignatureUnsupportedError();
        },
    );

    return router;
}

export default createUserBillingAppleTrialOfferSignatureRouter();
