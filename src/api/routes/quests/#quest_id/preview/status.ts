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
import type { QuestUserStatusResponse } from "@spacebar/schemas";
import { DiscordApiErrors } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

const questIdPattern = /^\d{17,20}$/;

export function assertValidQuestId(value: unknown): asserts value is string {
    if (typeof value !== "string" || !questIdPattern.test(value)) throw DiscordApiErrors.INVALID_FORM_BODY;
}

export function buildResetQuestPreviewStatusResponse(userId: string, questId: string): QuestUserStatusResponse {
    return {
        user_id: userId,
        quest_id: questId,
        enrolled_at: null,
        completed_at: null,
        claimed_at: null,
        progress: {},
    };
}

router.delete(
    "/",
    route({
        summary: "Reset Quest",
        description:
            "Resets the current user's preview quest status. Spacebar does not persist Discord quest preview state yet, so this returns a conservative empty Quest User Status response without fabricating progress.",
        right: "OPERATOR",
        responses: {
            200: {
                body: "QuestUserStatusResponse",
            },
            400: {
                body: "APIErrorResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
            403: {
                body: "APIErrorResponse",
            },
        },
    }),
    (req: Request, res: Response) => {
        const { quest_id } = req.params as { quest_id: string };
        assertValidQuestId(quest_id);

        return res.status(200).json(buildResetQuestPreviewStatusResponse(req.user_id, quest_id));
    },
);

export default router;
