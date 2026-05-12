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
import type { GravityAttachment, GravityAttachmentsResponse } from "@spacebar/schemas";
import { CloudAttachment, Config, getCloudAttachmentCdnUrl } from "@spacebar/util";
import { Request, Response, Router } from "express";

export type GravityAttachmentSource = Pick<
    CloudAttachment,
    "contentType" | "height" | "id" | "size" | "uploadFilename" | "userAttachmentId" | "userFileSize" | "userFilename" | "userIsClip" | "userOriginalContentType" | "width"
>;

export interface GravityAttachmentsDependencies {
    findCurrentUserAttachments: (userId: string) => Promise<GravityAttachmentSource[]>;
    getCdnEndpoint: () => string | undefined;
}

function optionalNumber(value: number | undefined) {
    return typeof value === "number" ? value : undefined;
}

export function serializeGravityAttachment(attachment: GravityAttachmentSource, cdnEndpoint: string | undefined): GravityAttachment {
    return {
        id: attachment.userAttachmentId || attachment.id,
        filename: attachment.userFilename,
        upload_filename: attachment.uploadFilename,
        upload_url: getCloudAttachmentCdnUrl(cdnEndpoint ?? "", attachment.uploadFilename),
        ...(optionalNumber(attachment.size ?? attachment.userFileSize) !== undefined ? { file_size: attachment.size ?? attachment.userFileSize } : {}),
        ...(attachment.userOriginalContentType ? { original_content_type: attachment.userOriginalContentType } : {}),
        ...(attachment.contentType ? { content_type: attachment.contentType } : {}),
        ...(optionalNumber(attachment.height) !== undefined ? { height: attachment.height } : {}),
        ...(optionalNumber(attachment.width) !== undefined ? { width: attachment.width } : {}),
        ...(typeof attachment.userIsClip === "boolean" ? { is_clip: attachment.userIsClip } : {}),
    };
}

export async function getCurrentUserGravityAttachmentsResponse(userId: string, deps: GravityAttachmentsDependencies): Promise<GravityAttachmentsResponse> {
    const cdnEndpoint = deps.getCdnEndpoint();
    const attachments = await deps.findCurrentUserAttachments(userId);

    return {
        attachments: attachments.map((attachment) => serializeGravityAttachment(attachment, cdnEndpoint)),
    };
}

const defaultDependencies: GravityAttachmentsDependencies = {
    findCurrentUserAttachments: (userId) =>
        CloudAttachment.find({
            where: { userId },
            order: { id: "ASC" },
        }),
    getCdnEndpoint: () => Config.get().cdn.endpointPublic ?? undefined,
};

export function createCurrentUserGravityAttachmentsRouter(deps: GravityAttachmentsDependencies = defaultDependencies) {
    const router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Current User Gravity Attachments",
            description:
                "Returns the current user's locally persisted cloud attachment metadata for Discord gravity attachment compatibility without fabricating recommendation, upload, media, channel, or message state.",
            responses: {
                200: {
                    body: "GravityAttachmentsResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const response = await getCurrentUserGravityAttachmentsResponse(req.user_id, deps);

            return res.status(200).json(response);
        },
    );

    return router;
}

export default createCurrentUserGravityAttachmentsRouter();
