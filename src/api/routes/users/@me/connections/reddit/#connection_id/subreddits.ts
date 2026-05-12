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
import type { ConnectedAccountSubredditsResponse } from "@spacebar/schemas";
import { ConnectedAccount, DiscordApiErrors } from "@spacebar/util";
import { type Request, type Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

export const REDDIT_CONNECTION_TYPE = "reddit" as const;

export type RedditSubredditsConnection = Pick<ConnectedAccount, "external_id" | "revoked">;

export function listStoredRedditConnectionSubreddits(_connection: RedditSubredditsConnection): ConnectedAccountSubredditsResponse {
    // Spacebar persists Reddit identity metadata, but not moderated subreddit membership.
    return [];
}

export async function getRedditConnectionSubreddits(userId: string, connectionId: string): Promise<ConnectedAccountSubredditsResponse> {
    const connection = await ConnectedAccount.findOne({
        where: {
            user_id: userId,
            external_id: connectionId,
            type: REDDIT_CONNECTION_TYPE,
        },
        select: {
            external_id: true,
            revoked: true,
        },
    });

    if (!connection) throw DiscordApiErrors.UNKNOWN_CONNECTION;
    if (connection.revoked) throw DiscordApiErrors.CONNECTION_REVOKED;

    return listStoredRedditConnectionSubreddits(connection);
}

router.get(
    "/",
    route({
        summary: "Get User Connection Subreddits",
        description:
            "Returns locally stored subreddits moderated by the linked Reddit account. Spacebar currently persists Reddit identity metadata but not Reddit moderated subreddit membership, so this compatibility endpoint returns an empty subreddit list for valid active Reddit connections instead of calling Reddit or fabricating subreddit data.",
        responses: {
            200: {
                body: "ConnectedAccountSubredditsResponse",
            },
            400: {
                body: "APIErrorResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const { connection_id } = req.params as { connection_id: string };

        res.status(200).json(await getRedditConnectionSubreddits(req.user_id, connection_id));
    },
);

export default router;
