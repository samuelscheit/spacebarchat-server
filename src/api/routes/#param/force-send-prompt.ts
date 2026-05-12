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

export const FORCE_SEND_PROMPT_UNSUPPORTED_MESSAGE = "Forced prompt delivery is not supported on this Spacebar instance.";

export function createForceSendPromptUnsupportedError(): ApiError {
    return new ApiError(FORCE_SEND_PROMPT_UNSUPPORTED_MESSAGE, 0, 501);
}

export function forceSendPrompt(_promptTarget: string): never {
    // xHyroM exposes this private client mutation, but Spacebar has no durable
    // prompt-delivery state or provider backing for safely sending prompts.
    throw createForceSendPromptUnsupportedError();
}

router.post(
    "/",
    route({
        summary: "Force Send Prompt",
        description:
            "Registers Discord client's POST /{param}/force-send-prompt route. The only local evidence is the xHyroM client route catalog, and Spacebar has no durable prompt-delivery state or provider integration, so this compatibility endpoint fails closed instead of fabricating prompt side effects.",
        responses: {
            401: {
                body: "APIErrorResponse",
            },
            501: {
                body: "APIErrorResponse",
            },
        },
    }),
    (req: Request, _res: Response) => {
        forceSendPrompt(req.params.param as string);
    },
);

export default router;
