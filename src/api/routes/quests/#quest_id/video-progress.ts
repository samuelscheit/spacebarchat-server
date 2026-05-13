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
import type { QuestUserStatusResponse, QuestVideoProgressSchema } from "@spacebar/schemas";
import { DiscordApiErrors, emitEvent } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { toQuestUserStatusResponse } from "../@me";
import { assertValidQuestId, UNKNOWN_QUEST } from "../../../util/utility/QuestRoutes";

export const QUEST_VIDEO_PROGRESS_EVENT_NAME = "QUESTS_USER_STATUS_UPDATE";
export const QUEST_VIDEO_PROGRESS_EVENTS = new Set(["WATCH_VIDEO", "WATCH_VIDEO_ON_MOBILE"]);

export interface QuestVideoProgressContext {
    questId: string;
    userId: string;
    timestamp: number;
}

export type QuestVideoProgressProvider = (context: QuestVideoProgressContext) => unknown | Promise<unknown>;
export type QuestVideoProgressEventEmitter = (userId: string, status: QuestUserStatusResponse) => unknown | Promise<unknown>;

export function getConfiguredQuestVideoProgress(_context: QuestVideoProgressContext): undefined {
    // Spacebar does not currently persist Discord quest enrollment or video-watch progress.
    return undefined;
}

function assertValidVideoProgressTimestamp(value: unknown): asserts value is number {
    if (!Number.isSafeInteger(value) || (value as number) < 0) throw DiscordApiErrors.INVALID_FORM_BODY;
}

function hasVideoProgress(status: QuestUserStatusResponse): boolean {
    return Object.keys(status.progress).some((eventName) => QUEST_VIDEO_PROGRESS_EVENTS.has(eventName));
}

export function toQuestVideoProgressResponse(source: unknown, userId: string, questId: string): QuestUserStatusResponse {
    const status = toQuestUserStatusResponse(source, userId, questId);
    if (!status || status.quest_id !== questId || !hasVideoProgress(status)) throw UNKNOWN_QUEST;

    return status;
}

export async function emitQuestUserStatusUpdate(userId: string, status: QuestUserStatusResponse): Promise<void> {
    await emitEvent({
        user_id: userId,
        event: QUEST_VIDEO_PROGRESS_EVENT_NAME,
        data: status,
    });
}

export async function submitQuestVideoProgress(
    questId: string,
    userId: string,
    body: QuestVideoProgressSchema,
    provider: QuestVideoProgressProvider = getConfiguredQuestVideoProgress,
    eventEmitter: QuestVideoProgressEventEmitter = emitQuestUserStatusUpdate,
): Promise<QuestUserStatusResponse> {
    assertValidQuestId(questId);
    assertValidVideoProgressTimestamp(body.timestamp);

    const status = toQuestVideoProgressResponse(
        await provider({
            questId,
            userId,
            timestamp: body.timestamp,
        }),
        userId,
        questId,
    );

    await eventEmitter(userId, status);

    return status;
}

export function createQuestVideoProgressRouter(
    provider: QuestVideoProgressProvider = getConfiguredQuestVideoProgress,
    eventEmitter: QuestVideoProgressEventEmitter = emitQuestUserStatusUpdate,
) {
    const router: Router = Router({ mergeParams: true });

    router.post(
        "/",
        route({
            summary: "Send Quest Video Progress",
            description:
                "Updates the current user's progress for a locally backed video quest task and emits a quest status gateway event. Spacebar does not currently persist Discord quest enrollment or video-watch progress, so the default provider fails closed instead of fabricating quest progress.",
            requestBody: "QuestVideoProgressSchema",
            coerceRequestBody: false,
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
                404: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const { quest_id } = req.params as { quest_id: string };
            const status = await submitQuestVideoProgress(quest_id, req.user_id, req.body as QuestVideoProgressSchema, provider, eventEmitter);

            return res.status(200).json(status);
        },
    );

    return router;
}

export default createQuestVideoProgressRouter();
