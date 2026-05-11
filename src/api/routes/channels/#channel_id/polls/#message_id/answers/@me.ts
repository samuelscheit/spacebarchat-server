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
import type { PollAnswersResponse } from "@spacebar/schemas";
import { ApiError, getPermission, Message } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router = Router({ mergeParams: true });

router.get(
    "/",
    route({
        permission: "VIEW_CHANNEL",
        responses: {
            200: {
                body: "PollAnswersResponse",
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
        const { channel_id, message_id } = req.params as { [key: string]: string };

        const message = await Message.findOneOrFail({
            where: { id: message_id, channel_id },
        });
        if (!message.poll) throw new ApiError("Unknown message", 10008, 404);

        if (message.author_id !== req.user_id) {
            const permissions = req.permission ?? (await getPermission(req.user_id, undefined, channel_id));
            permissions.hasThrow("READ_MESSAGE_HISTORY");
        }

        // Spacebar stores poll definitions and aggregate counts, but not durable per-user poll votes yet.
        return res.json({ answer_ids: [] } satisfies PollAnswersResponse);
    },
);

export default router;
