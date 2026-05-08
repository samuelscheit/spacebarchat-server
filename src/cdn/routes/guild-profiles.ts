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

import { assertCdnFileSizeLimit, Config } from "@spacebar/util";
import crypto from "node:crypto";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";
import { multer } from "../util/multer";
import { storage } from "@spacebar/cdn";
import { fileTypeFromBuffer } from "file-type";
import { cache } from "../util/cache";
import { assertAnimatedImageUploadAllowed, getGuildProfileImageLimits, getPremiumStatusForAnimatedImageUpload } from "../util/ImageUploadPolicy";

// TODO: generate different sizes of icon
// TODO: generate different image types of icon
// TODO: delete old icons

const ANIMATED_MIME_TYPES = ["image/apng", "image/gif", "image/gifv"];
const STATIC_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/svg"];
const ALLOWED_MIME_TYPES = [...ANIMATED_MIME_TYPES, ...STATIC_MIME_TYPES];

const router = Router({ mergeParams: true });

function getProfileUploadPath(req: Request, hash?: string) {
    const { guild_id, user_id } = req.params as { [key: string]: string | undefined };
    if (!guild_id || !user_id) return `guild-profiles${hash ? `/${hash}` : ""}`;

    const cleanUserId = user_id.split(".")[0];
    const assetType = req.baseUrl.includes("/banners") ? "banners" : "avatars";
    return `guilds/${guild_id}/users/${cleanUserId}/${assetType}${hash ? `/${hash}` : ""}`;
}

router.post("/", multer.single("file"), async (req: Request, res: Response) => {
    if (req.headers.signature !== Config.get().security.requestSignature) throw new HTTPError("Invalid request signature");
    if (!req.file) throw new HTTPError("Missing file");
    const { buffer, size } = req.file;
    assertCdnFileSizeLimit(`/${getProfileUploadPath(req)}`, size, Config.get().cdn);

    let hash = crypto.createHash("md5").update(buffer).digest("hex");

    const type = await fileTypeFromBuffer(buffer);
    if (!type || !ALLOWED_MIME_TYPES.includes(type.mime)) throw new HTTPError("Invalid file type");

    const imageLimits = getGuildProfileImageLimits(req.baseUrl);
    const premiumStatus = await getPremiumStatusForAnimatedImageUpload(type.mime, imageLimits, user_id);
    assertAnimatedImageUploadAllowed(type.mime, imageLimits, premiumStatus);

    if (ANIMATED_MIME_TYPES.includes(type.mime)) hash = `a_${hash}`; // animated icons have a_ infront of the hash

    const path = getProfileUploadPath(req, hash);
    const endpoint = Config.get().cdn.endpointPublic;

    await storage.set(path, buffer);

    return res.json({
        id: hash,
        content_type: type.mime,
        size,
        url: `${endpoint}${req.baseUrl.replace(/\/$/, "")}/${hash}`,
    });
});

router.get("/", cache, async (req: Request, res: Response) => {
    const path = getProfileUploadPath(req);

    const file = await storage.get(path);
    if (!file) throw new HTTPError("not found", 404);
    const type = await fileTypeFromBuffer(file);

    res.set("Content-Type", type?.mime);

    return res.send(file);
});

router.get("/:hash", cache, async (req: Request, res: Response) => {
    let { hash } = req.params as { [key: string]: string };
    hash = hash.split(".")[0]; // remove .file extension
    const path = getProfileUploadPath(req, hash);

    const file = await storage.get(path);
    if (!file) throw new HTTPError("not found", 404);
    const type = await fileTypeFromBuffer(file);

    res.set("Content-Type", type?.mime);

    return res.send(file);
});

router.delete("/:id", async (req: Request, res: Response) => {
    if (req.headers.signature !== Config.get().security.requestSignature) throw new HTTPError("Invalid request signature");
    const { id } = req.params as { [key: string]: string };
    const path = getProfileUploadPath(req, id);

    await storage.delete(path);

    return res.send({ success: true });
});

export default router;
