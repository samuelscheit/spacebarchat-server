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
import type { QuestRewardCodeResponse } from "@spacebar/schemas";
import { Request, Response, Router } from "express";
import { assertValidQuestId, UNKNOWN_QUEST } from "../../../util/utility/QuestRoutes";

export interface QuestRewardCodeSource {
    quest_id: string;
    code: string;
    platform: number;
    user_id: string;
    claimed_at: string | Date;
    tier?: number | null;
}

export type QuestRewardCodeProvider = (questId: string, userId: string) => QuestRewardCodeSource | undefined | Promise<QuestRewardCodeSource | undefined>;

export function getConfiguredQuestRewardCode(_questId: string, _userId: string): QuestRewardCodeSource | undefined {
    // Spacebar does not currently persist Discord quest reward-code or redemption data.
    return undefined;
}

function serializeTimestamp(value: string | Date): string | undefined {
    const timestamp = value instanceof Date ? value.toISOString() : value;
    return Number.isFinite(Date.parse(timestamp)) ? timestamp : undefined;
}

function isValidQuestRewardCodeSource(source: QuestRewardCodeSource, questId: string, userId: string): boolean {
    if (source.quest_id !== questId || source.user_id !== userId) return false;
    if (typeof source.code !== "string" || source.code.length === 0) return false;
    if (!Number.isSafeInteger(source.platform) || source.platform < 0) return false;
    if (serializeTimestamp(source.claimed_at) === undefined) return false;
    if (source.tier !== undefined && source.tier !== null && (!Number.isSafeInteger(source.tier) || source.tier < 0)) return false;

    return true;
}

export function toQuestRewardCodeResponse(source: QuestRewardCodeSource): QuestRewardCodeResponse {
    const claimedAt = serializeTimestamp(source.claimed_at);
    if (claimedAt === undefined) throw UNKNOWN_QUEST;

    return {
        quest_id: source.quest_id,
        code: source.code,
        platform: source.platform,
        user_id: source.user_id,
        claimed_at: claimedAt,
        tier: source.tier ?? null,
    };
}

export async function getQuestRewardCode(
    questId: string,
    userId: string,
    rewardCodeProvider: QuestRewardCodeProvider = getConfiguredQuestRewardCode,
): Promise<QuestRewardCodeResponse> {
    assertValidQuestId(questId);

    const rewardCode = await rewardCodeProvider(questId, userId);
    if (!rewardCode || !isValidQuestRewardCodeSource(rewardCode, questId, userId)) throw UNKNOWN_QUEST;

    return toQuestRewardCodeResponse(rewardCode);
}

export function createQuestRewardCodeRouter(rewardCodeProvider: QuestRewardCodeProvider = getConfiguredQuestRewardCode) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Quest Reward Code",
            description:
                "Retrieves the current user's locally stored quest reward code. Spacebar does not currently persist Discord quest reward-code or redemption data, so the default provider fails closed instead of fabricating redeem codes.",
            responses: {
                200: {
                    body: "QuestRewardCodeResponse",
                },
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
                404: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const { quest_id } = req.params as { quest_id: string };
            const rewardCode = await getQuestRewardCode(quest_id, req.user_id, rewardCodeProvider);

            return res.status(200).json(rewardCode);
        },
    );

    return router;
}

export default createQuestRewardCodeRouter();
