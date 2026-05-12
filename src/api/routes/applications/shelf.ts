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
import { ApiError } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

export const APPLICATIONS_SHELF_UNSUPPORTED_MESSAGE = "Application shelf updates are not supported on this Spacebar instance.";

export function createApplicationsShelfUnsupportedError(): ApiError {
    return new ApiError(APPLICATIONS_SHELF_UNSUPPORTED_MESSAGE, 0, 501);
}

router.patch(
    "/",
    route({
        summary: "Update Application Shelf",
        description:
            "Updates the authenticated user's application shelf. Spacebar does not currently persist per-user application shelf state, so this compatibility endpoint fails closed instead of fabricating or mutating unrelated application records.",
        responses: {
            401: {
                body: "APIErrorResponse",
            },
            501: {
                body: "APIErrorResponse",
            },
        },
    }),
    (_req: Request, _res: Response) => {
        // This route is user-personalized shelf state. Without a durable local
        // model for that state, mutating Application rows would leak across users.
        throw createApplicationsShelfUnsupportedError();
    },
);

export default router;
