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
import type { GravityIcyMiResponse } from "@spacebar/schemas";
import { Request, Response, Router } from "express";

export const EMPTY_GRAVITY_ICYMI_LOAD_ID = "spacebar/empty";

export function getCurrentUserGravityIcyMiResponse(_userId: string): GravityIcyMiResponse {
    return {
        items: [],
        load_id: EMPTY_GRAVITY_ICYMI_LOAD_ID,
    };
}

export function createCurrentUserGravityIcyMiRouter() {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Current User Gravity ICYMI Items",
            description: "Returns the current user's locally backed Gravity ICYMI item envelope without fabricating Discord private feed state.",
            query: {
                refresh: {
                    type: "boolean",
                    description: "Whether the client is forcing a refreshed Gravity ICYMI feed.",
                },
            },
            responses: {
                200: {
                    body: "GravityIcyMiResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        (req: Request, res: Response) => res.status(200).json(getCurrentUserGravityIcyMiResponse(req.user_id)),
    );

    return router;
}

export default createCurrentUserGravityIcyMiRouter();
