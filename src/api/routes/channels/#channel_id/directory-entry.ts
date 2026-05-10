/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors

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
import { Channel, getPermission } from "@spacebar/util";
import { ChannelType } from "@spacebar/schemas";
import { Request, Router } from "express";
import { HTTPError } from "lambert-server";

const router = Router({ mergeParams: true });

router.get(
    "/:entity_id",
    route({
        responses: {
            200: {
                body: "HubDirectoryEntry",
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
    async (req: Request) => {
        const { channel_id, entity_id } = req.params as { [key: string]: string };
        const channel = await Channel.findOneOrFail({
            where: { id: channel_id },
            select: { guild_id: true, id: true, type: true },
        });
        const permissions = await getPermission(req.user_id, channel.guild_id, channel_id);
        permissions.hasThrow("VIEW_CHANNEL");

        if (!entity_id || channel.type !== ChannelType.GUILD_DIRECTORY) {
            throw new HTTPError("Directory entry not found", 404);
        }

        // Spacebar does not persist directory entries yet; do not synthesize membership from guild state.
        throw new HTTPError("Directory entry not found", 404);
    },
);

export default router;
