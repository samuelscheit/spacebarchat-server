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
import type { AttachmentFalsePositiveReportSchema } from "@spacebar/schemas";
import { ApiError, DiscordApiErrors, getPermission, Message, type Attachment } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";

const router: Router = Router({ mergeParams: true });
const snowflakePattern = /^\d{1,20}$/;

type FalsePositiveMessage = Pick<Message, "id" | "channel_id" | "guild_id" | "author_id" | "embeds"> & {
    attachments?: Pick<Attachment, "id">[] | null;
};

function unknownChannelError() {
    return new ApiError(DiscordApiErrors.UNKNOWN_CHANNEL.message, DiscordApiErrors.UNKNOWN_CHANNEL.code, 404);
}

function unknownMessageError() {
    return new ApiError(DiscordApiErrors.UNKNOWN_MESSAGE.message, DiscordApiErrors.UNKNOWN_MESSAGE.code, 404);
}

function assertSnowflake(value: string, errorFactory: () => ApiError) {
    if (!snowflakePattern.test(value)) throw errorFactory();
}

function assertReportHasTargets(body: AttachmentFalsePositiveReportSchema) {
    if (body.attachment_ids.length === 0 && body.embed_ids.length === 0) {
        throw new HTTPError("At least one attachment or embed must be provided", 400);
    }
}

async function getReportMessage(body: AttachmentFalsePositiveReportSchema): Promise<FalsePositiveMessage> {
    assertSnowflake(body.channel_id, unknownChannelError);
    assertSnowflake(body.message_id, unknownMessageError);

    const message = (await Message.findOne({
        where: {
            id: body.message_id,
            channel_id: body.channel_id,
        },
        relations: {
            attachments: true,
        },
    })) as FalsePositiveMessage | null;

    if (!message) throw unknownMessageError();
    return message;
}

async function assertCanReportMessage(userId: string, message: FalsePositiveMessage) {
    const permissions = await getPermission(userId, message.guild_id, message.channel_id);
    permissions.hasThrow("VIEW_CHANNEL");
    if (message.author_id !== userId) permissions.hasThrow("READ_MESSAGE_HISTORY");
}

function assertReportTargetsBelongToMessage(body: AttachmentFalsePositiveReportSchema, message: FalsePositiveMessage) {
    assertReportHasTargets(body);

    const attachmentIds = new Set((message.attachments ?? []).map((attachment) => attachment.id));
    const unknownAttachmentId = body.attachment_ids.find((attachmentId) => !attachmentIds.has(attachmentId));
    if (unknownAttachmentId) throw new HTTPError("Attachment does not belong to message", 400);

    if (body.embed_ids.length > 0 && (message.embeds?.length ?? 0) === 0) {
        throw new HTTPError("Message does not contain embeds", 400);
    }
}

async function handleExplicitContentFalsePositive(req: Request, res: Response) {
    const body = req.body as AttachmentFalsePositiveReportSchema;
    const message = await getReportMessage(body);

    await assertCanReportMessage(req.user_id, message);
    assertReportTargetsBelongToMessage(body, message);

    // Spacebar does not currently persist explicit-media scan feedback. The
    // compatibility behavior validates that the report refers to visible local
    // message content, then accepts the client signal without fabricating state.
    return res.status(204).send();
}

const reportFalsePositiveResponses = {
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
        requestBody: "AttachmentFalsePositiveReportSchema",
        coerceRequestBody: false,
        summary: "Delete Explicit Content False Positive Report",
        description: "Deletes an explicit content false-positive report when explicit-media feedback persistence is available.",
        responses: reportFalsePositiveResponses,
    }),
    handleExplicitContentFalsePositive,
);

router.post(
    "/",
    route({
        requestBody: "AttachmentFalsePositiveReportSchema",
        coerceRequestBody: false,
        summary: "Report Explicit Content False Positive",
        description: "Reports an explicit content false positive for a message.",
        responses: reportFalsePositiveResponses,
    }),
    handleExplicitContentFalsePositive,
);

export default router;
