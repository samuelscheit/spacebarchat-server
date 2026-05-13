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
const snowflakePattern = /^\d{1,20}$/;

export const UNKNOWN_SAFETY_HUB_CLASSIFICATION_MESSAGE = "Unknown Safety Hub Classification";
export const SAFETY_HUB_REQUEST_REVIEW_UNSUPPORTED_MESSAGE =
    "Safety Hub request reviews are not supported on this Spacebar instance because durable Safety Hub classification and appeal state is not configured.";

export function createUnknownSafetyHubClassificationError(): ApiError {
    return new ApiError(UNKNOWN_SAFETY_HUB_CLASSIFICATION_MESSAGE, 0, 404);
}

export function createSafetyHubRequestReviewUnsupportedError(): ApiError {
    return new ApiError(SAFETY_HUB_REQUEST_REVIEW_UNSUPPORTED_MESSAGE, 0, 501);
}

function getClassificationId(req: Request): string {
    const { classification_id } = req.params as { classification_id?: string };
    if (!classification_id || !snowflakePattern.test(classification_id)) throw createUnknownSafetyHubClassificationError();
    return classification_id;
}

router.put(
    "/",
    route({
        requestBody: "SafetyHubRequestReviewSchema",
        coerceRequestBody: false,
        summary: "Request Classification Review",
        description:
            "Requests a review for a Safety Hub classification when durable classification and appeal persistence are available. Spacebar does not currently persist Safety Hub classifications or appeals, so this compatibility endpoint validates the authenticated request and fails closed with 501 instead of fabricating an appeal.",
        responses: {
            200: {
                body: "SafetyHubRequestReviewResponse",
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
            501: {
                body: "APIErrorResponse",
            },
        },
    }),
    (req: Request, _res: Response) => {
        getClassificationId(req);
        throw createSafetyHubRequestReviewUnsupportedError();
    },
);

export default router;
