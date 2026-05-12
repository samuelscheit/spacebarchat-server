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
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

export type CurrentUserHarvest = null;

export function getCurrentUserHarvest(userId: string): CurrentUserHarvest {
    void userId;

    // Spacebar does not persist Discord data-export harvest requests yet.
    return null;
}

router.get(
    "/",
    route({
        summary: "Get User Harvest",
        description:
            "Returns the current user's most recent user data harvest request when durable harvest state exists. Spacebar does not currently persist Discord data-export harvest requests, so it returns the documented 204 no-content response instead of fabricating export state.",
        responses: {
            204: {},
            401: {
                body: "APIErrorResponse",
            },
        },
    }),
    (req: Request, res: Response) => {
        const harvest = getCurrentUserHarvest(req.user_id);

        if (harvest === null) return res.sendStatus(204);
    },
);

export default router;
