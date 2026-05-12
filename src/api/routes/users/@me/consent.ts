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
import type { UserConsentsResponse } from "@spacebar/schemas";
import { createDefaultUserConsentsResponse } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router = Router({ mergeParams: true });

export function buildUserConsentsResponse(_userId: string): UserConsentsResponse {
    return createDefaultUserConsentsResponse();
}

router.get(
    "/",
    route({
        summary: "Get User Consents",
        description:
            "Returns the current user's conservative tracking consent state. Spacebar does not currently persist personalization or usage-statistics consent, so the local response mirrors READY's non-consented personalization state and includes the endpoint-only usage-statistics consent as not consented.",
        responses: {
            200: {
                body: "UserConsentsResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
        },
    }),
    (req: Request, res: Response) => res.status(200).json(buildUserConsentsResponse(req.user_id)),
);

export default router;
