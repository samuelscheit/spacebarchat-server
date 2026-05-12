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
import { ApiError, DiscordApiErrors } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

export const CONTENT_INVENTORY_APPLICATION_MUTATION_UNSUPPORTED_MESSAGE = "Content inventory application sharing mutations are not supported on this Spacebar instance.";

const applicationIdPattern = /^\d{1,20}$/;

export function assertValidContentInventoryApplicationId(value: unknown): asserts value is string {
    if (typeof value !== "string" || !applicationIdPattern.test(value)) throw DiscordApiErrors.INVALID_FORM_BODY;
}

export function createContentInventoryApplicationMutationUnsupportedError(): ApiError {
    return new ApiError(CONTENT_INVENTORY_APPLICATION_MUTATION_UNSUPPORTED_MESSAGE, 0, 501);
}

router.patch(
    "/",
    route({
        requestBody: "ContentInventoryApplicationUpdateSchema",
        coerceRequestBody: false,
        summary: "Modify Content Inventory Application",
        description:
            "Updates the current user's content-inventory sharing preference for an application. Spacebar does not currently persist per-user content inventory application sharing state, so this compatibility endpoint validates the request and fails closed instead of fabricating or mutating unrelated presence settings.",
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
    (req: Request, _res: Response) => {
        const { application_id } = req.params as { application_id: string };

        assertValidContentInventoryApplicationId(application_id);
        throw createContentInventoryApplicationMutationUnsupportedError();
    },
);

export default router;
