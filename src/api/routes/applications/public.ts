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

export const APPLICATIONS_PUBLIC_PATCH_UNSUPPORTED_MESSAGE = "Public application bulk mutation is not supported on this Spacebar instance.";
export const APPLICATIONS_PUBLIC_PUT_UNSUPPORTED_MESSAGE = "Public application bulk replacement is not supported on this Spacebar instance.";

export function createApplicationsPublicPatchUnsupportedError(): ApiError {
    return new ApiError(APPLICATIONS_PUBLIC_PATCH_UNSUPPORTED_MESSAGE, 0, 501);
}

export function createApplicationsPublicPutUnsupportedError(): ApiError {
    return new ApiError(APPLICATIONS_PUBLIC_PUT_UNSUPPORTED_MESSAGE, 0, 501);
}

router.patch(
    "/",
    route({
        summary: "Modify Public Applications",
        description:
            "Registers Discord client's PATCH /applications/public route without mutating local application records. Spacebar only has source-backed public application read models for this collection, so this compatibility endpoint fails closed instead of fabricating or altering public application metadata.",
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
        // The only local evidence for this route is the Discord client route
        // catalog. No source-backed request shape or mutation semantics are
        // available, so do not update unrelated Application rows.
        throw createApplicationsPublicPatchUnsupportedError();
    },
);

router.put(
    "/",
    route({
        summary: "Replace Public Applications",
        description:
            "Registers Discord client's PUT /applications/public route without mutating local application records. The only local evidence is the xHyroM client route catalog; public Userdoccers sources document only GET for this collection, so Spacebar fails closed instead of fabricating or overwriting public application metadata.",
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
        // PUT is only present in the Discord client route catalog. There is no
        // source-backed request shape or durable bulk-public-application state.
        throw createApplicationsPublicPutUnsupportedError();
    },
);

export default router;
