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
import type { SavedMessagesResponse } from "@spacebar/schemas";
import { Request, Response, Router } from "express";

export interface UserSavedMessagesDependencies {
    listUserSavedMessages(userId: string): Promise<SavedMessagesResponse>;
}

export const defaultUserSavedMessagesDependencies: UserSavedMessagesDependencies = {
    async listUserSavedMessages() {
        return { results: [] };
    },
};

export async function getUserSavedMessages(userId: string, dependencies: UserSavedMessagesDependencies = defaultUserSavedMessagesDependencies): Promise<SavedMessagesResponse> {
    return dependencies.listUserSavedMessages(userId);
}

export function createUserSavedMessagesRouter(dependencies: UserSavedMessagesDependencies = defaultUserSavedMessagesDependencies) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Saved Messages",
            description:
                "Returns the current user's saved message bookmarks and reminders. Spacebar does not currently persist saved-message state, so the local representation is empty until that backing state exists.",
            responses: {
                200: {
                    body: "SavedMessagesResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const savedMessages = await getUserSavedMessages(req.user_id, dependencies);

            return res.status(200).json(savedMessages);
        },
    );

    return router;
}

export default createUserSavedMessagesRouter();
