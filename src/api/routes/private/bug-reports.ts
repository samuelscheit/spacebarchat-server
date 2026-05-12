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
import type { PrivateBugReportsResponse } from "@spacebar/schemas";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

export function listPrivateBugReports(userId: string): PrivateBugReportsResponse {
    void userId;

    // Spacebar does not persist Discord private bug-report submissions yet.
    return [];
}

router.get(
    "/",
    route({
        summary: "Get Private Bug Reports",
        description:
            "Returns private bug reports visible to the authenticated user when durable bug-report state exists. Spacebar does not currently persist Discord private bug-report submissions, so the local representation is empty.",
        responses: {
            200: {
                body: "PrivateBugReportsResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
        },
    }),
    (req: Request, res: Response) => res.status(200).json(listPrivateBugReports(req.user_id)),
);

export default router;
