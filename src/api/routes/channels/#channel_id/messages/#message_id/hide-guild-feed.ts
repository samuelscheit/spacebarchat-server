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
import { ApiError, Channel, DiscordApiErrors, Message, MessageFlags, MessageUpdateEvent, emitEvent, getPermission, messagePublicWithThreadRelations } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });
const snowflakePattern = /^\d{1,20}$/;
const guildFeedHiddenFlag = Number(MessageFlags.FLAGS.GUILD_FEED_HIDDEN);

type GuildFeedChannel = Pick<Channel, "id" | "guild_id">;

function unknownChannelError() {
    return new ApiError(DiscordApiErrors.UNKNOWN_CHANNEL.message, DiscordApiErrors.UNKNOWN_CHANNEL.code, 404);
}

function unknownMessageError() {
    return new ApiError(DiscordApiErrors.UNKNOWN_MESSAGE.message, DiscordApiErrors.UNKNOWN_MESSAGE.code, 404);
}

function assertSnowflake(value: string, errorFactory: () => ApiError) {
    if (!snowflakePattern.test(value)) throw errorFactory();
}

async function getGuildFeedChannel(channelId: string): Promise<GuildFeedChannel> {
    assertSnowflake(channelId, unknownChannelError);

    const channel = await Channel.findOne({
        where: { id: channelId },
        select: {
            id: true,
            guild_id: true,
        },
    });

    if (!channel) throw unknownChannelError();
    if (!channel.guild_id) throw DiscordApiErrors.CANNOT_EXECUTE_ON_THIS_CHANNEL_TYPE;

    return channel;
}

async function getGuildFeedMessage(channelId: string, messageId: string): Promise<Message> {
    assertSnowflake(messageId, unknownMessageError);

    const message = await Message.findOne({
        where: {
            id: messageId,
            channel_id: channelId,
        },
        relations: messagePublicWithThreadRelations,
    });

    if (!message) throw unknownMessageError();
    return message;
}

async function assertCanSetGuildFeedVisibility(req: Request, channel: GuildFeedChannel, message: Message) {
    const permissions = req.permission ?? (await getPermission(req.user_id, channel.guild_id, channel.id));

    if (!req.permission) permissions.hasThrow("VIEW_CHANNEL");
    if (message.author_id !== req.user_id) permissions.hasThrow("MANAGE_MESSAGES");
}

export function setGuildFeedHiddenFlag(flags: number | null | undefined, hidden: boolean): number {
    const currentFlags = flags ?? 0;
    return hidden ? currentFlags | guildFeedHiddenFlag : currentFlags & ~guildFeedHiddenFlag;
}

export async function handleGuildFeedVisibility(req: Request, res: Response, hidden: boolean) {
    const { channel_id, message_id } = req.params as { [key: string]: string };
    const channel = await getGuildFeedChannel(channel_id);
    const message = await getGuildFeedMessage(channel_id, message_id);

    await assertCanSetGuildFeedVisibility(req, channel, message);

    const nextFlags = setGuildFeedHiddenFlag(message.flags, hidden);
    if (nextFlags !== message.flags) {
        message.flags = nextFlags;
        await message.save();
    }

    await emitEvent({
        event: "MESSAGE_UPDATE",
        channel_id,
        data: {
            ...message.toJSON(),
            nonce: undefined,
        },
    } satisfies MessageUpdateEvent);

    return res.sendStatus(204);
}

const guildFeedVisibilityResponses = {
    204: {},
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
};

router.delete(
    "/",
    route({
        permission: "VIEW_CHANNEL",
        summary: "Unhide Message from Guild Feed",
        description: "Unhides a message from the feed of the guild the channel belongs to.",
        event: "MESSAGE_UPDATE",
        responses: guildFeedVisibilityResponses,
    }),
    async (req: Request, res: Response) => handleGuildFeedVisibility(req, res, false),
);

router.post(
    "/",
    route({
        permission: "VIEW_CHANNEL",
        summary: "Hide Message from Guild Feed",
        description: "Hides a message from the feed of the guild the channel belongs to.",
        event: "MESSAGE_UPDATE",
        responses: guildFeedVisibilityResponses,
    }),
    async (req: Request, res: Response) => handleGuildFeedVisibility(req, res, true),
);

export default router;
