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

import { randomUUID } from "node:crypto";
import { route } from "@spacebar/api";
import type { QuestDecisionResponse } from "@spacebar/schemas";
import { FieldErrors } from "@spacebar/util";
import { Request, Response, Router } from "express";

export const QUEST_DECISION_RESPONSE_TTL_SECONDS = 1800;
export const QUEST_DECISION_PLACEMENT_AREAS = [1, 2] as const;

export type QuestDecisionPlacementArea = (typeof QUEST_DECISION_PLACEMENT_AREAS)[number];

export interface QuestDecisionQuery {
    placement: QuestDecisionPlacementArea;
    client_heartbeat_session_id?: string;
}

export type QuestDecisionRequestIdFactory = () => string;

function firstQueryValue(value: unknown): string | undefined {
    if (Array.isArray(value)) return firstQueryValue(value[0]);
    if (typeof value === "string") return value;

    return undefined;
}

function isQuestDecisionPlacementArea(value: number): value is QuestDecisionPlacementArea {
    return QUEST_DECISION_PLACEMENT_AREAS.includes(value as QuestDecisionPlacementArea);
}

function questDecisionQueryError(field: string, code: string, message: string): never {
    throw FieldErrors({
        [field]: {
            code,
            message,
        },
    });
}

export function parseQuestDecisionQuery(query: Request["query"]): QuestDecisionQuery {
    const placementValue = firstQueryValue(query.placement)?.trim();
    if (!placementValue) questDecisionQueryError("placement", "BASE_TYPE_REQUIRED", "placement is required");
    if (!/^\d+$/.test(placementValue)) questDecisionQueryError("placement", "BASE_TYPE_INVALID", "placement must be 1 or 2");

    const placement = Number.parseInt(placementValue, 10);
    if (!Number.isSafeInteger(placement) || !isQuestDecisionPlacementArea(placement)) {
        questDecisionQueryError("placement", "BASE_TYPE_INVALID", "placement must be 1 or 2");
    }

    const clientHeartbeatSessionId = firstQueryValue(query.client_heartbeat_session_id)?.trim();

    return {
        placement,
        ...(clientHeartbeatSessionId ? { client_heartbeat_session_id: clientHeartbeatSessionId } : {}),
    };
}

export function buildQuestDecisionResponse(_userId: string, _query: QuestDecisionQuery, requestId: string = randomUUID()): QuestDecisionResponse {
    return {
        request_id: requestId,
        quest: null,
        ad_identifiers: null,
        ad_context: null,
        metadata_raw: null,
        metadata_sealed: null,
        traffic_metadata_raw: null,
        traffic_metadata_sealed: null,
        creative: null,
        response_ttl_seconds: QUEST_DECISION_RESPONSE_TTL_SECONDS,
    };
}

export function createQuestDecisionRouter(requestIdFactory: QuestDecisionRequestIdFactory = randomUUID) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Quest Placement",
            description:
                "Returns the sponsored quest that should be shown to the current user in a specific placement. Spacebar does not persist durable quest decision or advertisement delivery state yet, so this compatibility endpoint returns no quest and no ad metadata.",
            query: {
                placement: {
                    type: "integer",
                    required: true,
                    description: "Quest placement area to get the quest for: 1 for desktop account panel, 2 for mobile home dock.",
                    values: ["1", "2"],
                },
                client_heartbeat_session_id: {
                    type: "string",
                    description: "Client-generated UUID representing the current persisted analytics heartbeat.",
                },
            },
            responses: {
                200: {
                    body: "QuestDecisionResponse",
                },
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        (req: Request, res: Response) => {
            const query = parseQuestDecisionQuery(req.query);
            return res.status(200).json(buildQuestDecisionResponse(req.user_id, query, requestIdFactory()));
        },
    );

    return router;
}

export default createQuestDecisionRouter();
