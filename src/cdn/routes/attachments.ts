/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2025 Spacebar and Spacebar Contributors
	
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

import { Config, CloudAttachment, hasValidSignature, NewUrlUserSignatureData, UrlSignResult } from "@spacebar/util";
import { Request, Response, Router } from "express";
import imageSize from "image-size";
import { HTTPError } from "lambert-server";
import { multer } from "../util/multer";
import { storage } from "@spacebar/cdn";
import { fileTypeFromBuffer } from "file-type";
import { cache } from "../util/cache";

const router = Router({ mergeParams: true });

const SANITIZED_CONTENT_TYPE = ["text/html", "text/mhtml", "multipart/related", "application/xhtml+xml"];

router.get("/:channel_id/:message_id/:filename", cache, async (req: Request, res: Response) => {
    const { channel_id, message_id, filename } = req.params as { [key: string]: string };
    // const { format } = req.query;

    const path = `attachments/${channel_id}/${message_id}/${filename}`;

    const fullUrl = (req.headers["x-forwarded-proto"] ?? req.protocol) + "://" + (req.headers["x-forwarded-host"] ?? req.hostname) + req.originalUrl;

    let hasValidAuth = false;
    if (req.headers.signature) {
        hasValidAuth = req.headers.signature !== Config.get().security.requestSignature;
        if (!hasValidAuth) console.warn("[CDN/Attachments] Client sent invalid signature header");
    } else if (!Config.get().security.cdnSignUrls) hasValidAuth = true;
    else {
        hasValidAuth = hasValidSignature(
            new NewUrlUserSignatureData({
                ip: req.ip,
                userAgent: req.headers["user-agent"] as string,
            }),
            UrlSignResult.fromUrl(fullUrl),
        );
        if (!hasValidAuth) console.warn("[CDN/Attachments] Client sent invalid attachment URL signature");
    }

    if (!hasValidAuth) return res.status(404).send("This content is no longer available.");

    const file = await storage.get(path);
    if (!file) throw new HTTPError("File not found");
    const type = await fileTypeFromBuffer(file);
    let content_type = type?.mime || "application/octet-stream";

    if (SANITIZED_CONTENT_TYPE.includes(content_type)) {
        content_type = "application/octet-stream";
    }

    res.set("Content-Type", content_type);

    return res.send(file);
});

// "cloud attachments"
router.put("/:channel_id/:batch_id/:attachment_id/:filename", multer.single("file"), async (req: Request, res: Response) => {
    const { channel_id, batch_id, attachment_id, filename } = req.params as { [key: string]: string };
    const att = await CloudAttachment.findOneOrFail({
        where: {
            uploadFilename: `${channel_id}/${batch_id}/${attachment_id}/${filename}`,
            channelId: channel_id,
            userAttachmentId: attachment_id,
            userFilename: filename,
        },
    });

    const maxLength = Config.get().cdn.maxAttachmentSize;

    console.log("[Cloud Upload] Uploading attachment", att.id, att.userFilename, `Max size: ${maxLength} bytes`);

    const chunks: Buffer[] = [];
    let length = 0;

    req.on("data", (chunk) => {
        console.log(`[Cloud Upload] Received chunk of size ${chunk.length} bytes`);
        chunks.push(chunk);
        length += chunk.length;
        if (length > maxLength) {
            res.status(413).send("File too large");
            req.destroy();
        }
    });
    req.on("end", async () => {
        console.log(`[Cloud Upload] Finished receiving file, total size ${length} bytes`);
        const buffer = Buffer.concat(chunks);
        const path = `attachments/${channel_id}/${batch_id}/${attachment_id}/${filename}`;

        await storage.set(path, buffer);

        let mimeType = att.userOriginalContentType;
        if (att.userOriginalContentType === null) {
            const ft = await fileTypeFromBuffer(buffer);
            mimeType = att.contentType = ft?.mime || "application/octet-stream";
        }

        if (mimeType?.includes("image")) {
            const dimensions = imageSize(buffer);
            if (dimensions) {
                att.width = dimensions.width;
                att.height = dimensions.height;
            }
        }

        att.size = buffer.length;
        await att.save();

        console.log("[Cloud Upload] Saved attachment", att.id, att.userFilename);
        res.status(200).end();
    });
});

export default router;
