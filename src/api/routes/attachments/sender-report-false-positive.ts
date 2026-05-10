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
import type { AttachmentSenderFalsePositiveReportSchema } from "@spacebar/schemas";
import { ApiError, Channel, CloudAttachment, DiscordApiErrors, getPermission } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";
import { In } from "typeorm";

const router: Router = Router({ mergeParams: true });
const snowflakePattern = /^\d{1,20}$/;

type SenderFalsePositiveAttachment = Pick<CloudAttachment, "channelId" | "userId" | "userAttachmentId" | "userFilename">;

function unknownChannelError() {
    return new ApiError(DiscordApiErrors.UNKNOWN_CHANNEL.message, DiscordApiErrors.UNKNOWN_CHANNEL.code, 404);
}

function assertSnowflake(value: string, errorFactory: () => ApiError) {
    if (!snowflakePattern.test(value)) throw errorFactory();
}

function assertSenderReportHasTargets(body: AttachmentSenderFalsePositiveReportSchema) {
    if (body.attachment_ids.length === 0 || body.filenames.length === 0) {
        throw new HTTPError("At least one attachment and filename must be provided", 400);
    }

    if (body.attachment_ids.length !== body.filenames.length) {
        throw new HTTPError("Attachment IDs and filenames must have matching lengths", 400);
    }

    const seenAttachmentIds = new Set<string>();
    for (const attachmentId of body.attachment_ids) {
        if (seenAttachmentIds.has(attachmentId)) throw new HTTPError(`Duplicate attachment ID: ${attachmentId}`, 400);
        seenAttachmentIds.add(attachmentId);
    }
}

async function assertCanReportInChannel(userId: string, channelId: string) {
    assertSnowflake(channelId, unknownChannelError);

    const channel = await Channel.findOne({
        where: {
            id: channelId,
        },
        select: {
            id: true,
            guild_id: true,
        },
    });

    if (!channel) throw unknownChannelError();

    const permissions = await getPermission(userId, channel.guild_id, channel.id);
    permissions.hasThrow("VIEW_CHANNEL");
    permissions.hasThrow("ATTACH_FILES");
}

function attachmentsByRequestedId(attachments: SenderFalsePositiveAttachment[]) {
    const byRequestedId = new Map<string, SenderFalsePositiveAttachment[]>();
    for (const attachment of attachments) {
        if (!attachment.userAttachmentId) continue;

        const candidates = byRequestedId.get(attachment.userAttachmentId);
        if (candidates) candidates.push(attachment);
        else byRequestedId.set(attachment.userAttachmentId, [attachment]);
    }

    return byRequestedId;
}

async function assertReportedAttachmentsBelongToSender(userId: string, body: AttachmentSenderFalsePositiveReportSchema) {
    const attachments = (await CloudAttachment.find({
        where: {
            channelId: body.channel_id,
            userAttachmentId: In(body.attachment_ids),
        },
    })) as SenderFalsePositiveAttachment[];
    const attachmentsById = attachmentsByRequestedId(attachments);

    body.attachment_ids.forEach((attachmentId, index) => {
        const candidates = attachmentsById.get(attachmentId) ?? [];
        if (candidates.length === 0) throw new HTTPError("Attachment does not belong to this channel", 400);

        const senderAttachment = candidates.find((attachment) => attachment.userId === userId && attachment.userFilename === body.filenames[index]);
        if (senderAttachment) return;

        if (!candidates.some((attachment) => attachment.userId === userId)) throw new HTTPError("You do not own this attachment", 403);
        throw new HTTPError("Attachment filename does not match uploaded attachment", 400);
    });
}

async function handleSentExplicitContentFalsePositive(req: Request, res: Response) {
    const body = req.body as AttachmentSenderFalsePositiveReportSchema;

    assertSenderReportHasTargets(body);
    assertSnowflake(body.message_id, () => new ApiError(DiscordApiErrors.UNKNOWN_MESSAGE.message, DiscordApiErrors.UNKNOWN_MESSAGE.code, 404));
    await assertCanReportInChannel(req.user_id, body.channel_id);
    await assertReportedAttachmentsBelongToSender(req.user_id, body);

    // Spacebar does not currently persist explicit-media scan feedback. The
    // compatibility behavior validates that the report refers to local uploaded
    // attachments owned by the sender, then accepts the client signal.
    return res.status(204).send();
}

const senderReportFalsePositiveResponses = {
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
        requestBody: "AttachmentSenderFalsePositiveReportSchema",
        coerceRequestBody: false,
        summary: "Delete Sent Explicit Content False Positive Report",
        description: "Deletes a sent explicit content false-positive report when explicit-media feedback persistence is available.",
        responses: senderReportFalsePositiveResponses,
    }),
    handleSentExplicitContentFalsePositive,
);

router.post(
    "/",
    route({
        requestBody: "AttachmentSenderFalsePositiveReportSchema",
        coerceRequestBody: false,
        summary: "Report Sent Explicit Content False Positive",
        description: "Reports an explicit content false positive for uploaded attachments after a send failure.",
        responses: senderReportFalsePositiveResponses,
    }),
    handleSentExplicitContentFalsePositive,
);

export default router;
