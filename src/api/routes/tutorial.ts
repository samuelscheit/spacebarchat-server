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
import type { TutorialResponse } from "@spacebar/schemas";
import { Request, Response, Router } from "express";

const router = Router({ mergeParams: true });

export type CurrentUserTutorial = TutorialResponse | null;

export async function getCurrentUserTutorial(userId: string): Promise<CurrentUserTutorial> {
    void userId;
    // Spacebar does not persist Discord's per-user tutorial progress yet.
    // Return null so callers use Discord's documented no-tutorial 204 response instead of fabricated progress.
    return null;
}

router.get(
    "/",
    route({
        summary: "Get Tutorial",
        description: "Returns the authenticated user's tutorial progress when persisted tutorial state exists; otherwise returns 204 with no body.",
        responses: {
            200: {
                body: "TutorialResponse",
            },
            204: {},
            401: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const tutorial = await getCurrentUserTutorial(req.user_id);

        if (tutorial === null) return res.sendStatus(204);

        return res.status(200).json(tutorial);
    },
);

export default router;
