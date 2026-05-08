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

import { DEFAULT_MESSAGE_DELETE_CHUNK_SIZE, deleteMessagesAndEmitBulkEvents, route } from "@spacebar/api";
import { Channel, Message, getPermission, getRights } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";
import { Between, FindManyOptions, FindOperator, Not, Raw } from "typeorm";
import { isTextChannel, PurgeSchema } from "@spacebar/schemas";

const router: Router = Router({ mergeParams: true });

export default router;

router.post(
    "/",
    route({
        /*body: "PurgeSchema",*/
        responses: {
            204: {},
            400: {
                body: "APIErrorResponse",
            },
            404: {},
            403: {},
        },
    }),
    async (req: Request, res: Response) => {
        const { channel_id } = req.params as { [key: string]: string };
        const channel = await Channel.findOneOrFail({
            where: { id: channel_id },
        });

        if (!channel.guild_id) throw new HTTPError("Can't purge dm channels", 400);
        isTextChannel(channel.type);

        const rights = await getRights(req.user_id);
        if (!rights.has("MANAGE_MESSAGES")) {
            const permissions = await getPermission(req.user_id, channel.guild_id, channel_id);
            permissions.hasThrow("MANAGE_MESSAGES");
            permissions.hasThrow("MANAGE_CHANNELS");
        }

        const { before, after } = req.body as PurgeSchema;

        const query: FindManyOptions<Message> & {
            where: { id?: FindOperator<string> };
        } = {
            order: { id: "ASC" },
            take: DEFAULT_MESSAGE_DELETE_CHUNK_SIZE,
            select: { id: true },
            where: {
                channel_id,
                id: Between(after, before), // the right way around
                author_id: rights.has("SELF_DELETE_MESSAGES") ? undefined : Not(req.user_id),
                // if you lack the right of self-deletion, you can't delete your own messages, even in purges
            },
        };

        let deleted = 0;

        while (true) {
            const messages = await Message.find(query);
            const ids = messages.map((message) => message.id);
            if (ids.length === 0) break;

            deleted += await deleteMessagesAndEmitBulkEvents(
                {
                    ids,
                    channel_id,
                    guild_id: channel.guild_id,
                },
                {
                    chunkSize: DEFAULT_MESSAGE_DELETE_CHUNK_SIZE,
                    deleteMessageIds: async (messageIds) => Message.delete(messageIds),
                },
            );

            const lastDeletedId = ids.at(-1);
            if (!lastDeletedId || ids.length < DEFAULT_MESSAGE_DELETE_CHUNK_SIZE) break;
            query.where.id = Raw((alias) => `${alias} > :lastDeletedId AND ${alias} <= :before`, { lastDeletedId, before });
        }

        if (deleted === 0) {
            res.sendStatus(304);
            return;
        }

        res.sendStatus(204);
    },
);
