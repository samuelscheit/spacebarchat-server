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
import { Channel, Member, Message, messagePublicWithThreadRelations, ThreadMember } from "@spacebar/util";
import { PostDataSchema, PublicMessage } from "@spacebar/schemas";

import { Request, Response, Router } from "express";
import { messageUpload } from "./messages";
import { In } from "typeorm";
import {
    createPostDataOwnerMemberWhere,
    createPostDataThreadWhere,
    filterPostDataThreadsForViewer,
    findPostDataOwner,
    uniquePostDataThreadIds,
} from "../../../util/utility/PostData";

const router = Router({ mergeParams: true });

router.post(
    "/",
    messageUpload.any(),
    (req, res, next) => {
        if (req.body.payload_json) {
            req.body = JSON.parse(req.body.payload_json);
        }

        next();
    },
    route({
        requestBody: "PostDataSchema",
        permission: "VIEW_CHANNEL",
        responses: {
            200: {},
            403: {},
        },
    }),
    async (req: Request, res: Response) => {
        const { channel_id } = req.params as { [key: string]: string };
        const body = uniquePostDataThreadIds((req.body as PostDataSchema).thread_ids);
        if (!body.length) return res.json({ threads: {} });

        const requestedThreads = await Channel.find({
            where: createPostDataThreadWhere(channel_id, body),
        });
        if (!requestedThreads.length) return res.json({ threads: {} });

        const threadMembers = await ThreadMember.find({
            where: {
                id: In(requestedThreads.map(({ id }) => id)),
                member: { id: req.user_id },
            },
            relations: { member: true },
        });
        const threads = filterPostDataThreadsForViewer(requestedThreads, threadMembers, req.user_id, req.permission!);
        if (!threads.length) return res.json({ threads: {} });

        const ownerMemberWhere = createPostDataOwnerMemberWhere(threads);
        const [messages, members] = await Promise.all([
            Message.find({
                where: {
                    id: In(threads.map(({ id }) => id)),
                },
                relations: messagePublicWithThreadRelations,
            }),
            ownerMemberWhere.length
                ? Member.find({
                      where: ownerMemberWhere,
                  })
                : Promise.resolve([]),
        ]);
        await Message.fillReplies(messages);
        const objRet: { threads: Record<string, { first_message: null | PublicMessage; owner: null | Member }> } = { threads: {} };
        for (const thread of threads) {
            const owner = findPostDataOwner(members, thread)?.toJSON() || null;
            const first_message = messages.find(({ channel_id }) => channel_id === thread.id)?.toJSON() || null;
            objRet.threads[thread.id] = {
                owner,
                first_message,
            };
        }
        return res.json(objRet);
    },
);

export default router;
