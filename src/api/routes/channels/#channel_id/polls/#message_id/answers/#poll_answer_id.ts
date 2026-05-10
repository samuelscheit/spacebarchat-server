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
import type { Poll, PollAnswerVotersResponse } from "@spacebar/schemas";
import { ApiError, getPermission, Message } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";

const router = Router({ mergeParams: true });

const DEFAULT_POLL_ANSWER_VOTERS_LIMIT = 25;
const MAX_POLL_ANSWER_VOTERS_LIMIT = 100;

function firstQueryValue(value: unknown): unknown {
    return Array.isArray(value) ? value[0] : value;
}

export function parsePollAnswerId(value: string): number {
    if (!/^\d+$/.test(value)) throw new HTTPError("poll_answer_id must be a positive integer", 400);

    const answerId = Number(value);
    if (!Number.isSafeInteger(answerId) || answerId < 1) throw new HTTPError("poll_answer_id must be a positive integer", 400);

    return answerId;
}

export function parsePollAnswerVotersLimit(value: unknown): number {
    const rawValue = firstQueryValue(value);
    if (rawValue === undefined) return DEFAULT_POLL_ANSWER_VOTERS_LIMIT;

    const limit = Number(rawValue);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_POLL_ANSWER_VOTERS_LIMIT) throw new HTTPError("limit must be between 1 and 100", 400);

    return limit;
}

export function assertPollAnswerVotersAfter(value: unknown) {
    const rawValue = firstQueryValue(value);
    if (rawValue === undefined) return;
    if (typeof rawValue !== "string" || !/^\d+$/.test(rawValue)) throw new HTTPError("after must be a snowflake", 400);
}

export function hasPollAnswer(poll: Pick<Poll, "answers"> | undefined, answerId: number): boolean {
    return Boolean(poll?.answers?.some((answer) => answer.answer_id === answerId));
}

router.get(
    "/",
    route({
        permission: "VIEW_CHANNEL",
        query: {
            after: {
                type: "string",
                required: false,
                description: "Get users after this user ID.",
            },
            limit: {
                type: "number",
                required: false,
                description: "Max number of users to return (1-100, default 25).",
            },
        },
        responses: {
            200: {
                body: "PollAnswerVotersResponse",
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
            404: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const { channel_id, message_id, poll_answer_id } = req.params as { [key: string]: string };
        const answerId = parsePollAnswerId(poll_answer_id);
        parsePollAnswerVotersLimit(req.query.limit);
        assertPollAnswerVotersAfter(req.query.after);

        const message = await Message.findOneOrFail({
            where: { id: message_id, channel_id },
        });
        if (!message.poll) throw new ApiError("Unknown message", 10008, 404);
        if (!hasPollAnswer(message.poll, answerId)) throw new HTTPError("Poll answer not found", 404);

        if (message.author_id !== req.user_id) {
            const permissions = req.permission ?? (await getPermission(req.user_id, undefined, channel_id));
            permissions.hasThrow("READ_MESSAGE_HISTORY");
        }

        // Spacebar stores poll definitions and aggregate result counts, but not per-answer voter IDs yet.
        return res.json({ users: [] } satisfies PollAnswerVotersResponse);
    },
);

export default router;
