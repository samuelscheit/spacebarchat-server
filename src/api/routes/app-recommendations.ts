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
import type { AppRecommendationsResponse } from "@spacebar/schemas";
import { type Request, type Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

export function listAppRecommendations(_userId: string): AppRecommendationsResponse {
    // Spacebar does not persist source-backed application recommendation signals yet.
    return [];
}

router.get(
    "/",
    route({
        summary: "Get App Recommendations",
        description:
            "Returns application recommendations for the current user. Spacebar does not currently persist source-backed application recommendation signals, so this compatibility endpoint returns an empty recommendation list.",
        responses: {
            200: {
                body: "AppRecommendationsResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
        },
    }),
    (req: Request, res: Response) => res.status(200).json(listAppRecommendations(req.user_id)),
);

export default router;
