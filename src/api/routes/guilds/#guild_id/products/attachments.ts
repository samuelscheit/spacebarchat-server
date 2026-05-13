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

import { randomString, route } from "@spacebar/api";
import { CloudAttachment, Config, getCloudAttachmentCdnUrl, Guild } from "@spacebar/util";
import type { UploadAttachmentRequest, UploadAttachmentRequestSchema, UploadAttachmentResponseSchema } from "@spacebar/schemas";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

export function sanitizeGuildProductAttachmentFilename(filename: string) {
    return filename.replaceAll(" ", "_").replace(/[^a-zA-Z0-9._]+/g, "");
}

function assertUniqueAttachmentIds(files: readonly UploadAttachmentRequest[]) {
    const seenIds: (string | undefined)[] = [];

    for (const file of files) {
        if (seenIds.includes(file.id)) {
            return `Duplicate attachment ID: ${file.id}`;
        }

        seenIds.push(file.id);
    }

    return undefined;
}

router.post(
    "/",
    route({
        summary: "Create Guild Product Attachment Upload",
        description:
            "Creates CDN upload reservations for guild product assets. The uploaded blobs are persisted as local cloud attachments owned by the authenticated user and scoped by guild product upload path.",
        requestBody: "UploadAttachmentRequestSchema",
        permission: "MANAGE_GUILD",
        responses: {
            200: {
                body: "UploadAttachmentResponseSchema",
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
        const payload = req.body as UploadAttachmentRequestSchema;
        const { guild_id } = req.params as { guild_id: string };

        await Guild.findOneOrFail({
            where: { id: guild_id },
            select: { id: true },
        });

        const duplicateAttachmentIdMessage = assertUniqueAttachmentIds(payload.files);
        if (duplicateAttachmentIdMessage) {
            return res.status(400).json({
                code: 400,
                message: duplicateAttachmentIdMessage,
            });
        }

        const cdnUrl = Config.get().cdn.endpointPublic!;
        const batchId = `CLOUD_${req.user.id}_${randomString(128)}`;
        const attachments = await Promise.all(
            payload.files.map(async (attachment) => {
                const filename = sanitizeGuildProductAttachmentFilename(attachment.filename);
                const uploadFilename = `${guild_id}/products/${batchId}/${attachment.id ?? "0"}/${filename}`;
                const newAttachment = CloudAttachment.create({
                    user: req.user,
                    uploadFilename,
                    userAttachmentId: attachment.id ?? "0",
                    userFilename: filename,
                    userFileSize: attachment.file_size,
                    userIsClip: attachment.is_clip,
                    userOriginalContentType: attachment.original_content_type,
                });

                await newAttachment.save();

                return newAttachment;
            }),
        );

        res.status(200).json({
            attachments: attachments.map((attachment) => ({
                id: attachment.userAttachmentId,
                upload_filename: attachment.uploadFilename,
                upload_url: getCloudAttachmentCdnUrl(cdnUrl, attachment.uploadFilename),
                original_content_type: attachment.userOriginalContentType,
            })),
        } as UploadAttachmentResponseSchema);
    },
);

export default router;
