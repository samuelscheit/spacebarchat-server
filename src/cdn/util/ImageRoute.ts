import { storage } from "@spacebar/cdn";
import { Config } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { fileTypeFromBuffer } from "file-type";
import { HTTPError } from "lambert-server";
import { cache, cacheNotFound } from "./cache";
import { multer } from "./multer";
import { DEFAULT_IMAGE_MIME_TYPES, getCdnImageHashPaths, getCdnImagePath, hashImageBuffer, isAllowedImageMimeType, parseCdnImageSize, resizeCdnImage } from "./ImageRouteHelpers";

export interface ImageRouteOptions {
    pathPrefix: string;
    resourceParam: string;
    allowedMimeTypes?: string[];
    legacyHashExtensions?: string[];
    resize?: boolean;
}

function getRouteParam(req: Request, name: string) {
    const value = req.params[name];
    return Array.isArray(value) ? value[0] : value;
}

function isMissingStorageObjectError(error: unknown) {
    if (!error || typeof error !== "object") return false;
    if ("code" in error && String(error.code) === "ENOENT") return true;
    if ("name" in error && ["NoSuchKey", "NotFound"].includes(String(error.name))) return true;
    return false;
}

export function createHashImageRouter({ pathPrefix, resourceParam, allowedMimeTypes = DEFAULT_IMAGE_MIME_TYPES, legacyHashExtensions = [], resize = false }: ImageRouteOptions) {
    const router = Router({ mergeParams: true });

    router.post(`/:${resourceParam}`, multer.single("file"), async (req: Request, res: Response) => {
        if (req.headers.signature !== Config.get().security.requestSignature) throw new HTTPError("Invalid request signature");
        if (!req.file) throw new HTTPError("Missing file");

        const { buffer, size } = req.file;
        const resourceId = getRouteParam(req, resourceParam);
        const type = await fileTypeFromBuffer(buffer);

        if (!isAllowedImageMimeType(type?.mime, allowedMimeTypes)) throw new HTTPError("Invalid file type");

        const hash = hashImageBuffer(buffer, type!.mime);
        const path = getCdnImagePath(pathPrefix, resourceId, hash);
        const endpoint = Config.get().cdn.endpointPublic;

        await storage.set(path, buffer);

        return res.json({
            id: hash,
            content_type: type!.mime,
            size,
            url: `${endpoint}${req.baseUrl}/${resourceId}/${hash}`,
        });
    });

    router.get(`/:${resourceParam}`, cache, async (req: Request, res: Response) => {
        const path = getCdnImagePath(pathPrefix, getRouteParam(req, resourceParam));

        const file = await storage.get(path);
        if (!file) return cacheNotFound(req, res);
        const type = await fileTypeFromBuffer(file);

        res.set("Content-Type", type?.mime);

        const body = resize ? await resizeCdnImage(file, type?.mime, parseCdnImageSize(req.query.size)) : file;

        return res.send(body);
    });

    router.get(`/:${resourceParam}/:hash`, cache, async (req: Request, res: Response) => {
        let file: Buffer | null = null;
        const paths = getCdnImageHashPaths(pathPrefix, getRouteParam(req, resourceParam), getRouteParam(req, "hash"), legacyHashExtensions);

        for (const path of paths) {
            file = await storage.get(path);
            if (file) break;
        }

        if (!file) return cacheNotFound(req, res);
        const type = await fileTypeFromBuffer(file);

        res.set("Content-Type", type?.mime);

        const body = resize ? await resizeCdnImage(file, type?.mime, parseCdnImageSize(req.query.size)) : file;

        return res.send(body);
    });

    router.delete(`/:${resourceParam}/:id`, async (req: Request, res: Response) => {
        if (req.headers.signature !== Config.get().security.requestSignature) throw new HTTPError("Invalid request signature");

        const paths = getCdnImageHashPaths(pathPrefix, getRouteParam(req, resourceParam), getRouteParam(req, "id"), legacyHashExtensions);
        let firstError: unknown;
        let deleted = false;

        for (const path of paths) {
            try {
                await storage.delete(path);
                deleted = true;
            } catch (error) {
                if (!isMissingStorageObjectError(error)) throw error;
                firstError ??= error;
            }
        }

        if (!deleted && firstError) throw firstError;

        return res.send({ success: true });
    });

    return router;
}
