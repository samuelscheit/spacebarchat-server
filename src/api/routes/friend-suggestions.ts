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
import type { FriendSuggestionsResponse } from "@spacebar/schemas";
import { emitEvent, type FriendSuggestionDeleteEvent } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router = Router({ mergeParams: true });

type EmitFriendSuggestionDeleteEvent = (event: Omit<FriendSuggestionDeleteEvent, "created_at">) => Promise<unknown> | unknown;

export function buildFriendSuggestionsResponse(_userId: string): FriendSuggestionsResponse {
    // Friend suggestions require contact/social graph sources Spacebar does not persist yet.
    return [];
}

export async function deleteFriendSuggestion(userId: string, suggestedUserId: string, emit: EmitFriendSuggestionDeleteEvent = emitEvent): Promise<void> {
    // Spacebar has no persisted suggestion row to remove, but clients still need
    // the documented acknowledgement and gateway invalidation for local state.
    await emit({
        event: "FRIEND_SUGGESTION_DELETE",
        user_id: userId,
        data: {
            suggested_user_id: suggestedUserId,
        },
    });
}

router.get(
    "/",
    route({
        summary: "Get Friend Suggestions",
        responses: {
            200: {
                body: "FriendSuggestionsResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
        },
    }),
    (req: Request, res: Response) => res.status(200).json(buildFriendSuggestionsResponse(req.user_id)),
);

router.delete(
    "/:user_id",
    route({
        summary: "Remove Friend Suggestion",
        responses: {
            204: {},
            401: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const { user_id } = req.params as { user_id: string };

        await deleteFriendSuggestion(req.user_id, user_id);
        return res.sendStatus(204);
    },
);

export default router;
