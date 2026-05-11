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
import type { QuestConfigResponse } from "@spacebar/schemas";
import { Request, Response, Router } from "express";
import { isQuestConfigActive, toQuestConfigResponse } from "../../../util/utility/QuestConfigResponse";
import { assertValidQuestId, UNKNOWN_QUEST } from "../../../util/utility/QuestRoutes";

export type QuestConfigProvider = (questId: string) => QuestConfigResponse | undefined | Promise<QuestConfigResponse | undefined>;

export { UNKNOWN_QUEST, isQuestConfigActive, toQuestConfigResponse };

export function assertValidQuestConfigId(value: unknown): asserts value is string {
    assertValidQuestId(value);
}

export function getConfiguredQuestConfig(_questId: string): QuestConfigResponse | undefined {
    // Spacebar does not currently persist Discord quest configuration data.
    return undefined;
}

export async function getQuestConfig(questId: string, questConfigProvider: QuestConfigProvider = getConfiguredQuestConfig, now: Date = new Date()): Promise<QuestConfigResponse> {
    assertValidQuestConfigId(questId);

    const config = await questConfigProvider(questId);
    if (!config || !isQuestConfigActive(config, now)) throw UNKNOWN_QUEST;

    return toQuestConfigResponse(config);
}

export function createQuestConfigRouter(questConfigProvider: QuestConfigProvider = getConfiguredQuestConfig) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Quest Config",
            description:
                "Returns the active quest configuration for the specified quest. Spacebar does not currently persist Discord quest configuration data, so only locally provided active quest configs can be returned.",
            responses: {
                200: {
                    body: "QuestConfigResponse",
                },
                400: {
                    body: "APIErrorResponse",
                },
                404: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const { quest_id } = req.params as { quest_id: string };
            const config = await getQuestConfig(quest_id, questConfigProvider);

            return res.status(200).json(config);
        },
    );

    return router;
}

export default createQuestConfigRouter();
