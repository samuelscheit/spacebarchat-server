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
import type { ContentInventorySimilarGamesResponse } from "@spacebar/schemas";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

export function buildContentInventorySimilarGamesResponse(_userId: string, _applicationId: string): ContentInventorySimilarGamesResponse {
    // Spacebar does not persist source-backed content inventory recommendation state yet.
    return [];
}

router.get(
    "/",
    route({
        summary: "Get Similar Games",
        description:
            "Returns current-user content inventory similar game entries for the target application. Spacebar does not currently persist source-backed content inventory recommendation state, so this compatibility endpoint returns an empty list.",
        responses: {
            200: {
                body: "ContentInventorySimilarGamesResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
        },
    }),
    (req: Request, res: Response) => {
        const { application_id } = req.params as { application_id: string };

        res.status(200).json(buildContentInventorySimilarGamesResponse(req.user_id, application_id));
    },
);

export default router;
