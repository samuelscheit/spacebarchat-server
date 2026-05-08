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
import { Channel, Member, OrmUtils } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { UserGuildSettingsSchema } from "@spacebar/schemas";
import { EntityNotFoundError, In } from "typeorm";

const router = Router({ mergeParams: true });

export async function assertChannelOverridesExist(channel_overrides: NonNullable<UserGuildSettingsSchema["channel_overrides"]>) {
    const channelIds = Object.keys(channel_overrides);
    if (!channelIds.length) return;

    const channels = await Channel.find({
        where: { id: In(channelIds) },
        select: { id: true },
    });
    if (channels.length === channelIds.length) return;

    const foundChannelIds = new Set(channels.map((channel) => channel.id));
    const missingChannelId = channelIds.find((channelId) => !foundChannelIds.has(channelId));
    throw new EntityNotFoundError(Channel, { id: missingChannelId });
}

// GET doesn't exist on discord.com
router.get(
    "/",
    route({
        responses: {
            200: {},
            404: {},
        },
    }),
    async (req: Request, res: Response) => {
        const user = await Member.findOneOrFail({
            where: { id: req.user_id, guild_id: req.params.guild_id as string },
            select: { settings: true },
        });
        return res.json(user.settings);
    },
);

router.patch(
    "/",
    route({
        requestBody: "UserGuildSettingsSchema",
        responses: {
            200: {},
            400: {
                body: "APIErrorResponse",
            },
            404: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const body = req.body as UserGuildSettingsSchema;

        if (body.channel_overrides) {
            await assertChannelOverridesExist(body.channel_overrides);
        }

        const user = await Member.findOneOrFail({
            where: { id: req.user_id, guild_id: req.params.guild_id as string },
            select: { settings: true },
        });
        OrmUtils.mergeDeep(user.settings || {}, body);
        await user.save();

        res.json(user.settings);
    },
);

export default router;
