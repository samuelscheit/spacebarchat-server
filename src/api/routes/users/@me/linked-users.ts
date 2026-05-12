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
import type { FamilyCenterLinkedUsersResponse } from "@spacebar/schemas";
import { DiscordApiErrors } from "@spacebar/util";
import { type Request, type Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

export function buildFamilyCenterLinkedUsersResponse(userId: string): FamilyCenterLinkedUsersResponse {
    void userId;

    // Spacebar does not persist Discord Family Center links yet.
    return {
        linked_users: [],
        users: [],
    };
}

export function getFamilyCenterLinkedUserDeletionUnavailableError() {
    return DiscordApiErrors.FEATURE_TEMPORARILY_DISABLED;
}

router.get(
    "/",
    route({
        summary: "Get Linked Users",
        description:
            "Returns Family Center linked-user relationships visible to the current user. Spacebar does not persist Discord Family Center links, so only locally supported empty collections are returned.",
        responses: {
            200: {
                body: "FamilyCenterLinkedUsersResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
        },
    }),
    (req: Request, res: Response) => res.status(200).json(buildFamilyCenterLinkedUsersResponse(req.user_id)),
);

router.delete(
    "/",
    route({
        summary: "Delete Linked Users",
        description:
            "Disconnects Family Center linked-user relationships for the current user. Spacebar does not persist Discord Family Center links, so deletion fails closed instead of mutating unrelated user relationships or account data.",
        responses: {
            400: {
                body: "APIErrorResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
        },
    }),
    (_req: Request, _res: Response) => {
        throw getFamilyCenterLinkedUserDeletionUnavailableError();
    },
);

export default router;
