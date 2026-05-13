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
import type { UserHarvestCreateSchema } from "@spacebar/schemas";
import { ApiError } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

export type CurrentUserHarvest = null;

export const USER_HARVEST_CREATE_UNSUPPORTED_MESSAGE = "User data harvest creation is not supported on this Spacebar instance.";

export function getCurrentUserHarvest(userId: string): CurrentUserHarvest {
    void userId;

    // Spacebar does not persist Discord data-export harvest requests yet.
    return null;
}

export function createUserHarvestCreateUnsupportedError(): ApiError {
    return new ApiError(USER_HARVEST_CREATE_UNSUPPORTED_MESSAGE, 0, 501);
}

export function createCurrentUserHarvest(userId: string, body: UserHarvestCreateSchema): never {
    void userId;
    void body;

    // Discord queues and delivers data-export archives here. Without durable
    // harvest state or a delivery pipeline, a synthetic queued harvest would lie.
    throw createUserHarvestCreateUnsupportedError();
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

router.post(
    "/",
    route({
        requestBody: "UserHarvestCreateSchema",
        coerceRequestBody: false,
        summary: "Create User Harvest",
        description:
            "Creates a user data harvest request for the current user. Discord returns a harvest object after queuing a data export, but Spacebar does not currently persist harvest requests or operate a data-export delivery pipeline, so this compatibility endpoint validates the documented request body and fails closed instead of fabricating export state.",
        responses: {
            400: {
                body: "APIErrorResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
            501: {
                body: "APIErrorResponse",
            },
        },
    }),
    (req: Request, _res: Response) => createCurrentUserHarvest(req.user_id, req.body as UserHarvestCreateSchema),
);

export default router;
