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
import type { UserSurveyResponse } from "@spacebar/schemas";
import { type Request, type Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

export function buildUserSurveyResponse(userId: string): UserSurveyResponse {
    void userId;

    // Spacebar does not persist Discord's private survey eligibility or prompt state.
    return { survey: null };
}

router.get(
    "/",
    route({
        summary: "Get User Survey",
        description:
            "Returns the current user's active survey. Spacebar does not persist Discord's private survey eligibility or survey prompt state, so it returns no active survey instead of fabricating prompt metadata.",
        query: {
            disable_auto_seen: {
                type: "boolean",
                description: "Whether to prevent automatically marking the survey as seen.",
            },
            survey_override: {
                type: "string",
                description: "Discord employee-only survey override ID. Ignored by Spacebar because local survey override state is unsupported.",
            },
        },
        responses: {
            200: {
                body: "UserSurveyResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
        },
    }),
    (req: Request, res: Response) => res.status(200).json(buildUserSurveyResponse(req.user_id)),
);

export default router;
