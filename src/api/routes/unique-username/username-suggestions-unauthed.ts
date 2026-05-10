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
import { type UniqueUsernameSuggestionResponse } from "@spacebar/schemas";
import { Request, Response, Router } from "express";
import { createUniqueUsernameSuggestion } from "../../util/UniqueUsernameSuggestion";

export {
    createUniqueUsernameSuggestion,
    isUniqueUsernameSuggestionAvailable,
    normalizeUniqueUsernameSuggestionBase,
    normalizedMaxUsernameLength,
    UNIQUE_USERNAME_SUGGESTION_DEFAULT_BASE,
    uniqueUsernameSuggestionCandidate,
} from "../../util/UniqueUsernameSuggestion";

const router = Router({ mergeParams: true });

export default router;

router.get(
    "/",
    route({
        summary: "Get Unique Username Suggestions",
        query: {
            global_name: {
                type: "string",
                description: "The display name to base the username suggestion on.",
            },
        },
        responses: {
            200: {
                body: "UniqueUsernameSuggestionResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const response: UniqueUsernameSuggestionResponse = {
            username: await createUniqueUsernameSuggestion(req.query.global_name),
        };

        return res.json(response);
    },
);
