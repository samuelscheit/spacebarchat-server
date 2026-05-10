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
import { Channel, Member, Webhook } from "@spacebar/util";
import { WebhookType } from "@spacebar/schemas";
import { Request, Response, Router } from "express";
import { In } from "typeorm";
import { assertChannelSupportsFollowerStats, createChannelFollowerStatsResponse, getChannelFollowerStatsGuildIds } from "../../../util/utility/ChannelFollowers";

const router: Router = Router({ mergeParams: true });

router.get(
    "/",
    route({
        permission: "VIEW_CHANNEL",
        responses: {
            200: {
                body: "ChannelFollowerStatsResponse",
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
        const { channel_id } = req.params as { [key: string]: string };
        const channel = await Channel.findOneOrFail({
            where: { id: channel_id },
            select: {
                id: true,
                guild_id: true,
                type: true,
            },
        });
        assertChannelSupportsFollowerStats(channel);

        const followerWebhooks = await Webhook.find({
            where: {
                source_channel_id: channel_id,
                type: WebhookType.ChannelFollower,
            },
            select: {
                channel_id: true,
                guild_id: true,
            },
        });
        const guildIds = getChannelFollowerStatsGuildIds(followerWebhooks);
        const guildMembers = guildIds.length ? await Member.count({ where: { guild_id: In(guildIds) } }) : 0;

        return res.json(createChannelFollowerStatsResponse(followerWebhooks, guildMembers));
    },
);

export default router;
