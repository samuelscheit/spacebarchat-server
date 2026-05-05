import { Config, Snowflake } from "@spacebar/util";
import { Request, Response, Router } from "express";
import imageSize from "image-size";
import { HTTPError } from "lambert-server";
import { multer } from "../../../util/multer";
import { storage } from "@spacebar/cdn";

const router = Router({ mergeParams: true });

router.post("/:channel_id/:message_id", multer.single("file"), async (req: Request, res: Response) => {
    if (req.headers.signature !== Config.get().security.requestSignature)
        throw new HTTPError(`Invalid request signature, expected '${Config.get().security.requestSignature}', got ${req.headers.signature}`);

    if (!req.file) throw new HTTPError("file missing");

    const { buffer, mimetype, size, originalname } = req.file;
    const { channel_id, message_id } = req.params as { [key: string]: string };
    const filename = originalname.replaceAll(" ", "_").replace(/[^a-zA-Z0-9._]+/g, "");
    const path = `attachments/${channel_id}/${message_id}/${filename}`;

    const endpoint = Config.get()?.cdn.endpointPublic;

    await storage.set(path, buffer);
    let width;
    let height;
    if (mimetype.includes("image")) {
        const dimensions = imageSize(buffer);
        if (dimensions) {
            width = dimensions.width;
            height = dimensions.height;
        }
    }

    const finalUrl = `${endpoint}/${path}`;

    const file = {
        id: Snowflake.generate(),
        channel_id,
        message_id,
        content_type: mimetype,
        filename: filename,
        size,
        url: finalUrl,
        path,
        width,
        height,
    };

    return res.json(file);
});

router.delete("/:channel_id/:message_id/:filename", async (req: Request, res: Response) => {
    if (req.headers.signature !== Config.get().security.requestSignature) throw new HTTPError("Invalid request signature");

    const { channel_id, message_id, filename } = req.params as { [key: string]: string };
    const path = `attachments/${channel_id}/${message_id}/${filename}`;

    await storage.delete(path);

    return res.send({ success: true });
});

export default router;
