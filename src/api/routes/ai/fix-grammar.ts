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

export const AI_FIX_GRAMMAR_UNSUPPORTED_MESSAGE = "AI grammar correction is not supported on this Spacebar instance.";

export function createAIFixGrammarUnsupportedError(): ApiError {
    return new ApiError(AI_FIX_GRAMMAR_UNSUPPORTED_MESSAGE, 0, 501);
}

router.post(
    "/",
    route({
        summary: "Fix Grammar",
        description:
            "Validates staff-only AI grammar correction requests. Spacebar has no configured AI text-correction provider, so this compatibility endpoint fails closed instead of fabricating corrected text.",
        requestBody: "AIFixGrammarSchema",
        coerceRequestBody: false,
        right: "OPERATOR",
        responses: {
            400: {
                body: "APIErrorResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
            403: {
                body: "APIErrorResponse",
            },
            501: {
                body: "APIErrorResponse",
            },
        },
    }),
    (_req: Request, _res: Response) => {
        throw createAIFixGrammarUnsupportedError();
    },
);

export default router;
