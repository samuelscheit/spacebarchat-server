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
import { NextFunction, Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

export const AGE_VERIFICATION_UNSUPPORTED_MESSAGE = "Age verification is not supported on this Spacebar instance.";

export function createAgeVerificationUnsupportedError(): ApiError {
    return new ApiError(AGE_VERIFICATION_UNSUPPORTED_MESSAGE, 0, 501);
}

function defaultEmptyRequestBody(req: Request, _res: Response, next: NextFunction) {
    if (req.body === undefined) req.body = {};
    next();
}

router.post(
    "/",
    defaultEmptyRequestBody,
    route({
        summary: "Verify Age",
        requestBody: "AgeVerificationVerifySchema",
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
    (_req: Request, _res: Response) => {
        // Discord starts a third-party provider session here. Spacebar has no
        // provider integration or durable verification request state, so fail
        // closed instead of minting a fake verification session.
        throw createAgeVerificationUnsupportedError();
    },
);

export default router;
