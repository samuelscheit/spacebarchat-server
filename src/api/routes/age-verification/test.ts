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
import { Request, Response, Router } from "express";
import { AGE_VERIFICATION_UNSUPPORTED_MESSAGE, createAgeVerificationUnsupportedError } from "./verify";

const router: Router = Router({ mergeParams: true });

export { AGE_VERIFICATION_UNSUPPORTED_MESSAGE, createAgeVerificationUnsupportedError };

router.post(
    "/",
    route({
        summary: "Test Age Assurance",
        description:
            "Exercises Discord's age-assurance test flow. Spacebar has no age-assurance provider, age-inference model, or durable verified-age-group state, so this compatibility endpoint fails closed instead of fabricating a successful test result.",
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
        // Discord's route depends on proprietary age-assurance provider and
        // inference state. Spacebar cannot truthfully complete that test locally.
        throw createAgeVerificationUnsupportedError();
    },
);

export default router;
