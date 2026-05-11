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
import type {
    PartialQuestResponse,
    QuestCurrentUserQuestsResponse,
    QuestResponse,
    QuestTaskHeartbeatResponse,
    QuestTaskProgressResponse,
    QuestUserStatusResponse,
} from "@spacebar/schemas";
import { Request, Response, Router } from "express";
import { toQuestConfigResponse } from "../../util/utility/QuestConfigResponse";
import { assertValidQuestId } from "../../util/utility/QuestRoutes";

export type CurrentUserQuestsProvider = (userId: string) => QuestCurrentUserQuestsResponse | undefined | Promise<QuestCurrentUserQuestsResponse | undefined>;

export function buildEmptyCurrentUserQuestsResponse(): QuestCurrentUserQuestsResponse {
    return {
        quests: [],
        excluded_quests: [],
        quest_enrollment_blocked_until: null,
    };
}

export function getConfiguredCurrentUserQuests(_userId: string): QuestCurrentUserQuestsResponse {
    // Spacebar does not currently persist Discord quest enrollment, progress, or claim state.
    return buildEmptyCurrentUserQuestsResponse();
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isValidQuestSnowflake(value: unknown): value is string {
    try {
        assertValidQuestId(value);
        return true;
    } catch {
        return false;
    }
}

function serializeTimestamp(value: unknown): string | null | undefined {
    if (value === null) return null;
    const timestamp = value instanceof Date ? value.toISOString() : value;
    if (typeof timestamp !== "string") return undefined;

    return Number.isFinite(Date.parse(timestamp)) ? timestamp : undefined;
}

function serializeOptionalTimestamp(value: unknown): string | null | undefined {
    if (value === undefined) return undefined;

    return serializeTimestamp(value);
}

function serializeRequiredTimestamp(value: unknown): string | undefined {
    const timestamp = serializeTimestamp(value);
    return typeof timestamp === "string" ? timestamp : undefined;
}

function isNonNegativeInteger(value: unknown): value is number {
    return Number.isSafeInteger(value) && (value as number) >= 0;
}

function toPartialQuestResponse(source: unknown): PartialQuestResponse | undefined {
    if (!isObject(source) || !isValidQuestSnowflake(source.id)) return undefined;

    return {
        id: source.id,
    };
}

function toQuestTaskHeartbeatResponse(source: unknown): QuestTaskHeartbeatResponse | null | undefined {
    if (source === null) return null;
    if (!isObject(source)) return undefined;

    const lastBeatAt = serializeRequiredTimestamp(source.last_beat_at);
    const expiresAt = serializeTimestamp(source.expires_at);
    if (lastBeatAt === undefined || expiresAt === undefined) return undefined;

    return {
        last_beat_at: lastBeatAt,
        expires_at: expiresAt,
    };
}

function toQuestTaskProgressResponse(eventName: string, source: unknown): QuestTaskProgressResponse | undefined {
    if (!isObject(source) || source.event_name !== eventName || !isNonNegativeInteger(source.value)) return undefined;

    const updatedAt = serializeRequiredTimestamp(source.updated_at);
    const completedAt = serializeTimestamp(source.completed_at);
    if (updatedAt === undefined || completedAt === undefined) return undefined;

    const heartbeat = toQuestTaskHeartbeatResponse(source.heartbeat);
    if (source.heartbeat !== undefined && heartbeat === undefined) return undefined;

    return {
        event_name: eventName,
        value: source.value,
        updated_at: updatedAt,
        completed_at: completedAt,
        ...(source.heartbeat !== undefined ? { heartbeat } : {}),
    };
}

function toQuestUserStatusResponse(source: unknown, userId: string, questId: string): QuestUserStatusResponse | null | undefined {
    if (source === null) return null;
    if (!isObject(source) || source.user_id !== userId) return undefined;
    if (source.quest_id !== undefined && (!isValidQuestSnowflake(source.quest_id) || source.quest_id !== questId)) return undefined;

    const enrolledAt = serializeTimestamp(source.enrolled_at);
    const completedAt = serializeTimestamp(source.completed_at);
    const claimedAt = serializeTimestamp(source.claimed_at);
    if (enrolledAt === undefined || completedAt === undefined || claimedAt === undefined) return undefined;

    const progress = isObject(source.progress) ? source.progress : undefined;
    if (!progress) return undefined;

    const progressEntries = Object.entries(progress).map(([eventName, taskProgress]) => [eventName, toQuestTaskProgressResponse(eventName, taskProgress)] as const);
    if (progressEntries.some(([, taskProgress]) => taskProgress === undefined)) return undefined;

    const claimedTier =
        source.claimed_tier === undefined || source.claimed_tier === null ? source.claimed_tier : isNonNegativeInteger(source.claimed_tier) ? source.claimed_tier : undefined;
    if (source.claimed_tier !== undefined && claimedTier === undefined) return undefined;

    const lastStreamHeartbeatAt = serializeOptionalTimestamp(source.last_stream_heartbeat_at);
    if (source.last_stream_heartbeat_at !== undefined && lastStreamHeartbeatAt === undefined) return undefined;
    if (source.stream_progress_seconds !== undefined && !isNonNegativeInteger(source.stream_progress_seconds)) return undefined;
    if (source.dismissed_quest_content !== undefined && !isNonNegativeInteger(source.dismissed_quest_content)) return undefined;

    return {
        user_id: userId,
        ...(source.quest_id !== undefined ? { quest_id: questId } : {}),
        enrolled_at: enrolledAt,
        completed_at: completedAt,
        claimed_at: claimedAt,
        ...(source.claimed_tier !== undefined ? { claimed_tier: claimedTier } : {}),
        ...(source.last_stream_heartbeat_at !== undefined ? { last_stream_heartbeat_at: lastStreamHeartbeatAt } : {}),
        ...(source.stream_progress_seconds !== undefined ? { stream_progress_seconds: source.stream_progress_seconds } : {}),
        ...(source.dismissed_quest_content !== undefined ? { dismissed_quest_content: source.dismissed_quest_content } : {}),
        progress: Object.fromEntries(progressEntries) as QuestUserStatusResponse["progress"],
    };
}

function toQuestResponse(source: unknown, userId: string): QuestResponse | undefined {
    if (!isObject(source) || !isValidQuestSnowflake(source.id) || !isObject(source.config)) return undefined;

    let config: ReturnType<typeof toQuestConfigResponse>;
    try {
        config = toQuestConfigResponse(source.config as unknown as Parameters<typeof toQuestConfigResponse>[0]);
    } catch {
        return undefined;
    }

    if (config.id !== source.id) return undefined;

    const userStatus = toQuestUserStatusResponse(source.user_status, userId, source.id);
    if (userStatus === undefined) return undefined;

    const targetedContent =
        source.targeted_content === null
            ? null
            : Array.isArray(source.targeted_content) && source.targeted_content.every(isNonNegativeInteger)
              ? [...source.targeted_content]
              : undefined;
    if (targetedContent === undefined || typeof source.preview !== "boolean") return undefined;

    return {
        id: source.id,
        config,
        user_status: userStatus,
        targeted_content: targetedContent,
        preview: source.preview,
    };
}

export function toCurrentUserQuestsResponse(source: unknown, userId: string): QuestCurrentUserQuestsResponse {
    if (!isObject(source)) return buildEmptyCurrentUserQuestsResponse();

    const questEnrollmentBlockedUntil = serializeTimestamp(source.quest_enrollment_blocked_until) ?? null;

    return {
        quests: Array.isArray(source.quests) ? source.quests.map((quest) => toQuestResponse(quest, userId)).filter((quest): quest is QuestResponse => quest !== undefined) : [],
        excluded_quests: Array.isArray(source.excluded_quests)
            ? source.excluded_quests.map(toPartialQuestResponse).filter((quest): quest is PartialQuestResponse => quest !== undefined)
            : [],
        quest_enrollment_blocked_until: questEnrollmentBlockedUntil,
    };
}

export async function getCurrentUserQuests(
    userId: string,
    currentUserQuestsProvider: CurrentUserQuestsProvider = getConfiguredCurrentUserQuests,
): Promise<QuestCurrentUserQuestsResponse> {
    const currentUserQuests = await currentUserQuestsProvider(userId);

    return toCurrentUserQuestsResponse(currentUserQuests ?? buildEmptyCurrentUserQuestsResponse(), userId);
}

export function createCurrentUserQuestsRouter(currentUserQuestsProvider: CurrentUserQuestsProvider = getConfiguredCurrentUserQuests) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Current User Quests",
            description:
                "Returns the current user's locally backed quests. Spacebar does not currently persist Discord quest enrollment, progress, or claim state, so the default provider returns the documented empty quest collection instead of fabricating Discord quests.",
            responses: {
                200: {
                    body: "QuestCurrentUserQuestsResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const currentUserQuests = await getCurrentUserQuests(req.user_id, currentUserQuestsProvider);

            return res.status(200).json(currentUserQuests);
        },
    );

    return router;
}

export default createCurrentUserQuestsRouter();
