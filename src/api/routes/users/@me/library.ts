/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors
	
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
import type { LibraryApplicationBranchModifySchema } from "@spacebar/schemas";
import { ApiError, DiscordApiErrors } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router = Router({ mergeParams: true });
const routeSnowflakePattern = /^\d{1,20}$/;

export const USER_LIBRARY_APPLICATION_BRANCH_UPDATE_UNSUPPORTED_MESSAGE = "User library application branch updates are not supported on this Spacebar instance.";

export interface UserLibraryApplicationBranchUpdateRequest {
    user_id: string;
    application_id: string;
    branch_id: string;
    flags?: number;
}

export function createUserLibraryApplicationBranchUpdateUnsupportedError(): ApiError {
    return new ApiError(USER_LIBRARY_APPLICATION_BRANCH_UPDATE_UNSUPPORTED_MESSAGE, 0, 501);
}

export function parseUserLibraryApplicationBranchApplicationId(applicationId: string): string {
    if (!routeSnowflakePattern.test(applicationId)) throw DiscordApiErrors.UNKNOWN_APPLICATION;
    return applicationId;
}

export function parseUserLibraryApplicationBranchBranchId(branchId: string): string {
    if (!routeSnowflakePattern.test(branchId)) throw DiscordApiErrors.UNKNOWN_BRANCH;
    return branchId;
}

export function updateUserLibraryApplicationBranch(request: UserLibraryApplicationBranchUpdateRequest): never {
    parseUserLibraryApplicationBranchApplicationId(request.application_id);
    parseUserLibraryApplicationBranchBranchId(request.branch_id);
    void request.user_id;
    void request.flags;

    // Spacebar does not currently persist Discord user-library application branches or their per-user flags.
    throw createUserLibraryApplicationBranchUpdateUnsupportedError();
}

router.get("/", route({}), (req: Request, res: Response) => {
    res.status(200).send([]);
});

router.patch(
    "/:application_id/:branch_id",
    route({
        summary: "Update User Library Application Branch",
        description:
            "Updates per-user flags for an application branch in the current user's Discord library. Spacebar does not currently persist Discord user-library application branch state, so this compatibility endpoint validates the request and fails closed instead of fabricating library records.",
        requestBody: "LibraryApplicationBranchModifySchema",
        coerceRequestBody: false,
        responses: {
            400: {
                body: "APIErrorResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
            404: {
                body: "APIErrorResponse",
            },
            501: {
                body: "APIErrorResponse",
            },
        },
    }),
    (req: Request, _res: Response) => {
        const body = req.body as LibraryApplicationBranchModifySchema;

        updateUserLibraryApplicationBranch({
            user_id: req.user_id,
            application_id: req.params.application_id as string,
            branch_id: req.params.branch_id as string,
            flags: body.flags,
        });
    },
);

export default router;
