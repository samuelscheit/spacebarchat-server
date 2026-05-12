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
import type { ScheduledMessagesResponse } from "@spacebar/schemas";
import { ApiError, DiscordApiErrors } from "@spacebar/util";
import { Request, Response, Router } from "express";

export interface UserScheduledMessagesDependencies {
    listUserScheduledMessages(userId: string): Promise<ScheduledMessagesResponse>;
}

export const defaultUserScheduledMessagesDependencies: UserScheduledMessagesDependencies = {
    async listUserScheduledMessages() {
        return [];
    },
};

export const USER_SCHEDULED_MESSAGE_UPDATE_UNSUPPORTED_MESSAGE = "User scheduled message updates are not supported on this Spacebar instance.";

const snowflakePattern = /^\d{1,20}$/;

export function parseUserScheduledMessageId(value: string): string {
    if (!snowflakePattern.test(value)) throw DiscordApiErrors.INVALID_FORM_BODY;

    return value;
}

export function createUserScheduledMessageUpdateUnsupportedError(): ApiError {
    return new ApiError(USER_SCHEDULED_MESSAGE_UPDATE_UNSUPPORTED_MESSAGE, 0, 501);
}

export async function getUserScheduledMessages(
    userId: string,
    dependencies: UserScheduledMessagesDependencies = defaultUserScheduledMessagesDependencies,
): Promise<ScheduledMessagesResponse> {
    return dependencies.listUserScheduledMessages(userId);
}

export function updateUserScheduledMessage(userId: string, scheduledMessageId: string): never {
    void userId;
    void scheduledMessageId;

    // Scheduled messages are per-user future-delivery state. Without a durable local
    // model for that state, mutating Message rows would fabricate delivery semantics.
    throw createUserScheduledMessageUpdateUnsupportedError();
}

export function createUserScheduledMessagesRouter(dependencies: UserScheduledMessagesDependencies = defaultUserScheduledMessagesDependencies) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get User Scheduled Messages",
            description:
                "Returns the current user's scheduled messages. Spacebar does not currently persist user scheduled-message state, so the local representation is empty until that backing state exists.",
            responses: {
                200: {
                    body: "ScheduledMessagesResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const scheduledMessages = await getUserScheduledMessages(req.user_id, dependencies);

            return res.status(200).json(scheduledMessages);
        },
    );

    router.patch(
        "/:param",
        route({
            summary: "Update User Scheduled Message",
            description:
                "Discord exposes this client route for mutating a current user's scheduled message. Spacebar does not currently persist user scheduled-message state, so this compatibility endpoint validates the route identifier and fails closed instead of fabricating or mutating message data.",
            responses: {
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
                501: {
                    body: "APIErrorResponse",
                },
            },
        }),
        (req: Request, _res: Response) => {
            updateUserScheduledMessage(req.user_id, parseUserScheduledMessageId(req.params.param as string));
        },
    );

    return router;
}

export default createUserScheduledMessagesRouter();
