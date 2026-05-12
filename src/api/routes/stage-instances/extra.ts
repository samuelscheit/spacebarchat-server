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

import { getStageInstancesExtra, route, type StageInstancesExtraDependencies } from "@spacebar/api";
import { ApiError } from "@spacebar/util";
import { Request, Response, Router } from "express";

export const STAGE_INSTANCES_EXTRA_MUTATION_UNSUPPORTED_MESSAGE = "Stage instance extra metadata updates are not supported on this Spacebar instance.";

export function createStageInstancesExtraMutationUnsupportedError(): ApiError {
    return new ApiError(STAGE_INSTANCES_EXTRA_MUTATION_UNSUPPORTED_MESSAGE, 0, 501);
}

export function createStageInstancesExtraRouter(dependencies?: StageInstancesExtraDependencies) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Stage Instance Extra Data",
            description:
                "Returns the authenticated user's visible persisted stage instances. Spacebar does not currently persist Discord-only extra stage discovery, participant, voice-state, or guild metadata.",
            responses: {
                200: {
                    body: "StageInstancesExtraResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const response = await getStageInstancesExtra(req.user_id, dependencies);
            return res.status(200).json(response);
        },
    );

    router.patch(
        "/",
        route({
            summary: "Update Stage Instance Extra Data",
            description:
                "Discord exposes this client route for mutating provider-backed stage extra metadata. Spacebar persists only normal stage instance records, so this compatibility endpoint fails closed instead of mutating unrelated stage instance, channel, voice, or scheduled event state.",
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
            throw createStageInstancesExtraMutationUnsupportedError();
        },
    );

    return router;
}

export default createStageInstancesExtraRouter();
