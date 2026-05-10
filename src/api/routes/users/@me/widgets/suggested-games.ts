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
import type { ProfileWidgetsSuggestedGamesResponse } from "@spacebar/schemas";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

export function buildProfileWidgetsSuggestedGamesResponse(_userId: string): ProfileWidgetsSuggestedGamesResponse {
    // Spacebar does not persist source-backed profile widget recommendation signals yet.
    return {
        suggested_games: [],
        suggested_wishlist_games: [],
    };
}

router.get(
    "/",
    route({
        summary: "Get Profile Widgets Suggested Games",
        description:
            "Returns suggested application IDs for the current user's profile game widgets. Spacebar does not currently persist source-backed profile widget recommendation signals, so this compatibility endpoint returns empty suggestion sets.",
        responses: {
            200: {
                body: "ProfileWidgetsSuggestedGamesResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
        },
    }),
    (req: Request, res: Response) => res.status(200).json(buildProfileWidgetsSuggestedGamesResponse(req.user_id)),
);

export default router;
