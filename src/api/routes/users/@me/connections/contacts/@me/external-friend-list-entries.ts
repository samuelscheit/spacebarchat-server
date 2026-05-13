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
import type { ConnectionSyncExternalFriendListEntriesPutSchema, ConnectionSyncExternalFriendListEntriesResponse } from "@spacebar/schemas";
import { ApiError } from "@spacebar/util";
import { Request, Response, Router } from "express";

export const CONTACT_SYNC_EXTERNAL_FRIEND_LIST_ENTRIES_UNSUPPORTED_MESSAGE = "Contact sync external friend list entries are not supported on this Spacebar instance.";

export interface ContactSyncExternalFriendListEntriesDependencies {
    syncExternalFriendListEntries(userId: string, body: ConnectionSyncExternalFriendListEntriesPutSchema): Promise<ConnectionSyncExternalFriendListEntriesResponse>;
}

export function createContactSyncExternalFriendListEntriesUnsupportedError(): ApiError {
    return new ApiError(CONTACT_SYNC_EXTERNAL_FRIEND_LIST_ENTRIES_UNSUPPORTED_MESSAGE, 0, 501);
}

const defaultContactSyncExternalFriendListEntriesDependencies: ContactSyncExternalFriendListEntriesDependencies = {
    async syncExternalFriendListEntries() {
        // This route uploads device contacts and can create provider-backed friend
        // suggestions. Spacebar has no durable contact-sync friend-list model or
        // matching provider, so the default implementation fails closed.
        throw createContactSyncExternalFriendListEntriesUnsupportedError();
    },
};

export function createContactSyncExternalFriendListEntriesRouter(
    dependencies: ContactSyncExternalFriendListEntriesDependencies = defaultContactSyncExternalFriendListEntriesDependencies,
) {
    const router: Router = Router({ mergeParams: true });

    router.put(
        "/",
        route({
            summary: "Update Contact Sync External Friend List Entries",
            description:
                "Syncs device contacts for the current user's contact-sync connection when a real contact matching backend is configured. The default Spacebar instance has no durable contact-sync friend-list state or provider-backed suggestion model, so it fails closed with 501 instead of fabricating matches, friend suggestions, or bulk-add tokens.",
            requestBody: "ConnectionSyncExternalFriendListEntriesPutSchema",
            coerceRequestBody: false,
            responses: {
                200: {
                    body: "ConnectionSyncExternalFriendListEntriesResponse",
                },
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
        async (req: Request, res: Response) => {
            const body = req.body as ConnectionSyncExternalFriendListEntriesPutSchema;
            const response = await dependencies.syncExternalFriendListEntries(req.user_id, body);

            return res.status(200).json(response);
        },
    );

    return router;
}

export default createContactSyncExternalFriendListEntriesRouter();
