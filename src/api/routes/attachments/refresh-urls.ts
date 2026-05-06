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

import { AttachmentRefreshError, refreshAttachmentUrls, route, type LocalAttachmentUrlParts } from "@spacebar/api";
import { Attachment, Config, getPermission, getUrlSignature, NewUrlSignatureData } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";
import { RefreshUrlsRequestSchema } from "@spacebar/schemas";
const router = Router({ mergeParams: true });

async function authorizeLocalAttachmentUrlForUser(userId: string, attachmentUrl: LocalAttachmentUrlParts) {
    const attachment = await Attachment.findOne({
        where: {
            channel_id: attachmentUrl.channelId,
            filename: attachmentUrl.filename,
            message_id: attachmentUrl.messageId,
        },
        relations: {
            message: true,
        },
    });

    if (!attachment?.message) throw new AttachmentRefreshError(404, "Attachment could not be found");

    const permissions = await getPermission(userId, undefined, attachmentUrl.channelId);
    permissions.hasThrow("VIEW_CHANNEL");
    if (attachment.message.author_id !== userId) permissions.hasThrow("READ_MESSAGE_HISTORY");
}

router.post(
    "/",
    route({
        requestBody: "RefreshUrlsRequestSchema",
        responses: {
            200: {
                body: "RefreshUrlsResponse",
            },
            400: {
                body: "APIErrorResponse",
            },
            403: {
                body: "APIErrorResponse",
            },
            404: {
                body: "APIErrorResponse",
            },
            502: {
                body: "APIErrorResponse",
            },
            503: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const { attachment_urls } = req.body as RefreshUrlsRequestSchema;

        let refreshed_urls;
        try {
            refreshed_urls = await refreshAttachmentUrls({
                attachmentUrls: attachment_urls,
                authorizeLocalAttachmentUrl: (_, attachmentUrl) => authorizeLocalAttachmentUrlForUser(req.user_id, attachmentUrl),
                discordBotToken: Config.get().external.discordAttachmentRefreshBotToken,
                ip: req.ip,
                localCdnEndpoint: Config.get().cdn.endpointPublic,
                signer: (data) => getUrlSignature(new NewUrlSignatureData(data)),
                userAgent: req.headers["user-agent"] as string,
            });
        } catch (error) {
            if (error instanceof AttachmentRefreshError) throw new HTTPError(error.publicMessage, error.statusCode);
            throw error;
        }

        return res.status(200).json({
            refreshed_urls,
        });
    },
);

export default router;
