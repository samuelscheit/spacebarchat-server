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
import type { ApplicationActivityStatisticsResponse } from "@spacebar/schemas";
import { Request, Response, Router } from "express";

export interface ApplicationActivityStatisticsContext {
    applicationId: string;
    userId: string;
}

export function buildApplicationActivityStatisticsResponse(_context: ApplicationActivityStatisticsContext): ApplicationActivityStatisticsResponse {
    // Spacebar does not persist friend/affine game playtime statistics yet.
    return [];
}

export function createApplicationActivityStatisticsRouter() {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Application Activity Statistics",
            responses: {
                200: {
                    body: "ApplicationActivityStatisticsResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        (req: Request, res: Response) => {
            const body = buildApplicationActivityStatisticsResponse({
                applicationId: req.params.application_id as string,
                userId: req.user_id,
            });

            return res.status(200).json(body);
        },
    );

    return router;
}

export default createApplicationActivityStatisticsRouter();
