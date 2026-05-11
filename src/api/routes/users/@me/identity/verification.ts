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

const router: Router = Router({ mergeParams: true });

export const USER_IDENTITY_VERIFICATION_UNSUPPORTED_MESSAGE = "User identity verification is not supported on this Spacebar instance.";

export function createUserIdentityVerificationUnsupportedError(): ApiError {
    return new ApiError(USER_IDENTITY_VERIFICATION_UNSUPPORTED_MESSAGE, 0, 501);
}

router.get(
    "/",
    route({
        summary: "Get User Identity Verification",
        description:
            "Returns the most recent user identity verification attempt. This Discord endpoint is deprecated and depends on Stripe identity attempt state; Spacebar does not currently persist that state or integrate with an identity provider, so this compatibility endpoint fails closed instead of fabricating verification data.",
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
        // Discord reads Stripe-backed identity verification attempts here. Without
        // durable attempt state, returning a synthetic status would be misleading.
        throw createUserIdentityVerificationUnsupportedError();
    },
);

export default router;
