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

import { getMessageHistoryQueryOrder, hydrateInteractionMetadataUsers, route, toPublicReactions } from "@spacebar/api";
import { Application, Channel, DiscordApiErrors, getPermission, Message, messagePublicWithThreadRelations, NewUrlUserSignatureData, User } from "@spacebar/util";
import { ChannelType, GameAnnouncementsResponse, PartialUser, PublicMessage } from "@spacebar/schemas";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";

const router: Router = Router({ mergeParams: true });
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 50;

type GameAnnouncementApplication = Pick<Application, "id" | "guild_id" | "announcements_channel_id">;
type GameAnnouncementChannel = Pick<Channel, "id" | "guild_id" | "type">;

export function parseGameAnnouncementLimit(value: unknown): number {
    if (value === undefined || value === null || value === "") return DEFAULT_LIMIT;

    const limit = Number(value);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
        throw new HTTPError("limit must be between 1 and 50", 422);
    }

    return limit;
}

export function canUseGameAnnouncementChannel(application: GameAnnouncementApplication, channel: GameAnnouncementChannel | null): channel is GameAnnouncementChannel {
    if (!channel?.guild_id) return false;
    if (channel.type !== ChannelType.GUILD_NEWS) return false;
    if (application.guild_id && application.guild_id !== channel.guild_id) return false;

    return true;
}

export async function serializeGameAnnouncementMessages(messages: Message[], req: Request): Promise<PublicMessage[]> {
    await Message.fillReplies(messages);

    const serialized = messages.map((message) => {
        const publicMessage = message.toJSON();

        publicMessage.reactions = toPublicReactions(message.reactions, req.user_id);
        if (!publicMessage.author) {
            publicMessage.author = {
                id: "4",
                discriminator: "0000",
                username: "Spacebar Ghost",
                public_flags: 0,
                avatar: null,
            } as PartialUser;
        }

        return Message.prototype.withSignedAttachments.call(
            publicMessage,
            new NewUrlUserSignatureData({
                ip: req.ip,
                userAgent: req.headers["user-agent"] as string,
            }),
        ) as PublicMessage;
    });

    await hydrateInteractionMetadataUsers(serialized, (userId) => User.getPublicUser(userId));

    return serialized;
}

router.get(
    "/",
    route({
        summary: "Get Game Announcements",
        query: {
            limit: {
                type: "number",
                description: "Max number of messages to return (1-50, default 50)",
            },
        },
        responses: {
            200: {
                body: "GameAnnouncementsResponse",
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
            422: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const { game_id } = req.params as { game_id: string };
        const limit = parseGameAnnouncementLimit(req.query.limit);
        const application = await Application.findOne({
            where: { id: game_id },
            select: {
                id: true,
                guild_id: true,
                announcements_channel_id: true,
            },
        });

        if (!application) throw DiscordApiErrors.UNKNOWN_APPLICATION;
        if (!application.announcements_channel_id) {
            return res.json({ messages: [] } satisfies GameAnnouncementsResponse);
        }

        const channel = await Channel.findOne({
            where: { id: application.announcements_channel_id },
            select: {
                id: true,
                guild_id: true,
                type: true,
            },
        });

        if (!canUseGameAnnouncementChannel(application, channel)) {
            return res.json({ messages: [] } satisfies GameAnnouncementsResponse);
        }

        const permissions = await getPermission(req.user_id, channel.guild_id, channel.id);
        permissions.hasThrow("VIEW_CHANNEL");

        const response: GameAnnouncementsResponse = {
            guild_id: channel.guild_id,
            channel_id: channel.id,
            messages: [],
        };

        if (!permissions.has("READ_MESSAGE_HISTORY")) {
            return res.json(response);
        }

        const messages = await Message.find({
            relationLoadStrategy: "query",
            order: getMessageHistoryQueryOrder({}),
            take: limit,
            where: { channel_id: channel.id },
            relations: messagePublicWithThreadRelations,
        });

        response.messages = await serializeGameAnnouncementMessages(messages, req);

        return res.json(response);
    },
);

export default router;
