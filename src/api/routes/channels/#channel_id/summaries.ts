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
import { isTextChannel, type ConversationSummariesResponse, type ConversationSummaryResponse } from "@spacebar/schemas";
import { ApiError, Channel, ConversationSummary, DiscordApiErrors, emitEvent, getPermission, type ConversationSummaryUpdateEvent } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });
const snowflakePattern = /^\d{1,20}$/;

function unknownChannelError() {
    return new ApiError(DiscordApiErrors.UNKNOWN_CHANNEL.message, DiscordApiErrors.UNKNOWN_CHANNEL.code, 404);
}

function assertValidChannelId(channelId: string) {
    if (!snowflakePattern.test(channelId)) throw unknownChannelError();
}

function unknownConversationSummaryError() {
    return new ApiError("Unknown conversation summary", 404, 404);
}

function assertValidSummaryId(summaryId: string) {
    if (!snowflakePattern.test(summaryId)) throw unknownConversationSummaryError();
}

export function toConversationSummaryResponse(summary: ConversationSummary): ConversationSummaryResponse {
    return {
        id: summary.id,
        topic: summary.topic,
        summ_short: summary.summ_short,
        message_ids: summary.message_ids,
        people: summary.people,
        unsafe: summary.unsafe,
        start_id: summary.start_id,
        end_id: summary.end_id,
        count: summary.count,
        source: summary.source,
        type: summary.type,
    };
}

export async function getChannelConversationSummaries(userId: string, channelId: string): Promise<ConversationSummariesResponse> {
    const channel = await Channel.findOneOrFail({
        where: { id: channelId },
    });

    isTextChannel(channel.type);

    const permissions = await getPermission(userId, channel.guild_id, channelId);
    permissions.hasThrow("VIEW_CHANNEL");
    permissions.hasThrow("READ_MESSAGE_HISTORY");

    const summaries = await ConversationSummary.find({
        where: { channel_id: channelId },
        order: { id: "DESC" },
        take: 50,
    });

    return {
        summaries: summaries.map(toConversationSummaryResponse),
    };
}

export async function deleteChannelConversationSummary(userId: string, channelId: string, summaryId: string): Promise<void> {
    assertValidChannelId(channelId);
    assertValidSummaryId(summaryId);

    const channel = await Channel.findOne({
        where: { id: channelId },
        select: {
            id: true,
            guild_id: true,
            type: true,
        },
    });
    if (!channel) throw unknownChannelError();

    isTextChannel(channel.type);

    const permissions = await getPermission(userId, channel.guild_id, channelId);
    permissions.hasThrow("MANAGE_MESSAGES");

    const deletion = await ConversationSummary.delete({
        id: summaryId,
        channel_id: channelId,
    });
    if (!deletion.affected) throw unknownConversationSummaryError();

    await emitEvent({
        event: "CONVERSATION_SUMMARY_UPDATE",
        guild_id: channel.guild_id,
        channel_id: channelId,
        data: {
            guild_id: channel.guild_id,
            channel_id: channelId,
            summaries: [],
        },
    } satisfies ConversationSummaryUpdateEvent);
}

router.get(
    "/",
    route({
        responses: {
            200: {
                body: "ConversationSummariesResponse",
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
        const response = await getChannelConversationSummaries(req.user_id, channel_id);

        return res.json(response);
    },
);

router.delete(
    "/:summary_id",
    route({
        summary: "Delete Conversation Summary",
        description: "Deletes a persisted conversation summary. Summary generation is not implemented by Spacebar.",
        event: "CONVERSATION_SUMMARY_UPDATE",
        responses: {
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
        },
    }),
    async (req: Request, res: Response) => {
        const { channel_id, summary_id } = req.params as { [key: string]: string };
        await deleteChannelConversationSummary(req.user_id, channel_id, summary_id);

        return res.sendStatus(204);
    },
);

export default router;
