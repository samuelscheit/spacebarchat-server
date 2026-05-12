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
import type { DevPortalCsatSurveyResponseSchema } from "@spacebar/schemas";
import { ApiError } from "@spacebar/util";
import { type Request, type Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

export const DEV_PORTAL_CSAT_SURVEY_RESPONSE_USER_MISMATCH = new ApiError("Missing Access", 50001, 403);

export function assertDevPortalCsatSurveyResponseUser(bodyUserId: string, authenticatedUserId: string) {
    if (bodyUserId !== authenticatedUserId) throw DEV_PORTAL_CSAT_SURVEY_RESPONSE_USER_MISMATCH;
}

router.post(
    "/",
    route({
        summary: "Submit Developer Portal CSAT Survey",
        description:
            "Submits a customer satisfaction survey response for the developer portal. Spacebar validates and acknowledges the authenticated user's response without fabricating Discord's private CSAT persistence.",
        requestBody: "DevPortalCsatSurveyResponseSchema",
        coerceRequestBody: false,
        responses: {
            204: {},
            400: {
                body: "APIErrorResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
            403: {
                body: "APIErrorResponse",
            },
        },
    }),
    (req: Request, res: Response) => {
        const body = req.body as DevPortalCsatSurveyResponseSchema;

        assertDevPortalCsatSurveyResponseUser(body.user_id, req.user_id);
        res.sendStatus(204);
    },
);

export default router;
