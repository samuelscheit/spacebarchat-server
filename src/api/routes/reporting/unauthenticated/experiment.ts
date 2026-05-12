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
import type { ReportingUnauthenticatedExperimentResponse } from "@spacebar/schemas";
import { ApiError } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router = Router({ mergeParams: true });
const response: ReportingUnauthenticatedExperimentResponse = {};

export const UNAUTHENTICATED_DSA_EXPERIMENT_UNSUPPORTED_MESSAGE = "Unauthenticated DSA reporting experiments are not supported on this Spacebar instance.";

export function createUnauthenticatedDsaExperimentUnsupportedError(): ApiError {
    return new ApiError(UNAUTHENTICATED_DSA_EXPERIMENT_UNSUPPORTED_MESSAGE, 0, 501);
}

router.get(
    "/",
    route({
        summary: "Query Unauthenticated Report Eligibility",
        description: "Query unauthenticated report eligibility.",
        responses: {
            200: {
                body: "ReportingUnauthenticatedExperimentResponse",
            },
        },
        spacebarOnly: false,
    }),
    (_req: Request, res: Response) => {
        res.json(response);
    },
);

router.post(
    "/",
    route({
        summary: "Track Unauthenticated DSA Reporting Experiment",
        description:
            "Records unauthenticated DSA reporting experiment state when a real experiment provider is configured. Spacebar does not persist Discord's unauthenticated DSA experiment or reporting verification state, so this compatibility endpoint fails closed with 501 instead of accepting unsupported state.",
        responses: {
            501: {
                body: "APIErrorResponse",
            },
        },
        spacebarOnly: false,
    }),
    (_req: Request, _res: Response) => {
        throw createUnauthenticatedDsaExperimentUnsupportedError();
    },
);

export default router;
