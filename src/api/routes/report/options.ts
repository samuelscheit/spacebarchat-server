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
import type { ReportOptionsResponse } from "@spacebar/schemas";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

export function listReportOptions(): ReportOptionsResponse {
    return [];
}

router.get(
    "/",
    route({
        summary: "Get Report Options",
        description: "Returns report option objects that can be used when creating a staged message report.",
        responses: {
            200: {
                body: "ReportOptionsResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
        },
        spacebarOnly: false,
    }),
    (_req: Request, res: Response) => {
        res.status(200).json(listReportOptions());
    },
);

export default router;
