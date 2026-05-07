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

import FormData from "form-data";
import { HTTPError } from "lambert-server";
import { Attachment } from "../entities";
import { Config } from "./Config";
import { parseBase64DataUri } from "../../schemas/ImageData";
import { getCdnMutationUrl } from "./InternalCdnRoutes";

export async function uploadFile(
    path: string,
    // These are the only props we use, don't need to enforce the full type.
    file?: Pick<Express.Multer.File, "mimetype" | "originalname" | "buffer">,
): Promise<Attachment> {
    if (!file?.buffer) throw new HTTPError("Missing file in body");

    const form = new FormData();
    form.append("file", file.buffer, {
        contentType: file.mimetype,
        filename: file.originalname,
    });

    const response = await fetch(getCdnMutationUrl(Config.get().cdn.endpointPrivate!, path), {
        headers: {
            signature: Config.get().security.requestSignature,
            ...form.getHeaders(),
        },
        method: "POST",
        body: form.getBuffer(),
    });
    const result = (await response.json()) as Attachment;

    if (response.status !== 200) throw result;
    return result;
}

export async function handleFile(path: string, body?: string): Promise<string | undefined> {
    if (!body || !body.startsWith("data:")) return undefined;
    try {
        const image = parseBase64DataUri(body);
        if (!image || !image.mimetype.startsWith("image/")) throw new Error("Invalid image data URI");

        const { id } = await uploadFile(path, {
            buffer: image.buffer,
            mimetype: image.mimetype,
            originalname: "banner",
        });
        return id;
    } catch (error) {
        console.error(error);
        throw new HTTPError("Invalid " + path);
    }
}

export async function deleteFile(path: string) {
    const response = await fetch(getCdnMutationUrl(Config.get().cdn.endpointPrivate!, path), {
        headers: {
            signature: Config.get().security.requestSignature,
        },
        method: "DELETE",
    });
    const result = await response.json();

    if (response.status !== 200) throw result;
    return result;
}
