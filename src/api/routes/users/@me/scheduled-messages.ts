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
import { Request, Response, Router } from "express";

export interface UserScheduledMessagesDependencies {
    listUserScheduledMessages(userId: string): Promise<ScheduledMessagesResponse>;
}

export const defaultUserScheduledMessagesDependencies: UserScheduledMessagesDependencies = {
    async listUserScheduledMessages() {
        return [];
    },
};

export async function getUserScheduledMessages(
    userId: string,
    dependencies: UserScheduledMessagesDependencies = defaultUserScheduledMessagesDependencies,
): Promise<ScheduledMessagesResponse> {
    return dependencies.listUserScheduledMessages(userId);
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

    return router;
}

export default createUserScheduledMessagesRouter();
