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

export function assertValidQuestDismissibilityQuestId(value: unknown): asserts value is string {
    if (typeof value !== "string" || !questIdPattern.test(value)) throw DiscordApiErrors.INVALID_FORM_BODY;
}

export function buildResetQuestPreviewDismissibilityResponse(userId: string, questId: string): QuestUserStatusResponse {
    return {
        user_id: userId,
        quest_id: questId,
        enrolled_at: null,
        completed_at: null,
        claimed_at: null,
        dismissed_quest_content: 0,
        progress: {},
    };
}

router.delete(
    "/",
    route({
        summary: "Reset Quest Dismissibility",
        description:
            "Resets the current user's preview quest dismissibility. Spacebar does not persist Discord quest preview state yet, so this returns a conservative empty Quest User Status response with dismissed_quest_content reset to 0 without fabricating progress.",
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
        assertValidQuestDismissibilityQuestId(quest_id);

        return res.status(200).json(buildResetQuestPreviewDismissibilityResponse(req.user_id, quest_id));
    },
);

export default router;
