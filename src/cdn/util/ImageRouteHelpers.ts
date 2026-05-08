import crypto from "node:crypto";
import sharp from "sharp";

export const ANIMATED_IMAGE_MIME_TYPES = ["image/apng", "image/gif", "image/gifv"];
export const RASTER_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const STATIC_IMAGE_MIME_TYPES = [...RASTER_IMAGE_MIME_TYPES, "image/svg+xml", "image/svg"];
export const DEFAULT_IMAGE_MIME_TYPES = [...ANIMATED_IMAGE_MIME_TYPES, ...STATIC_IMAGE_MIME_TYPES];
export const CDN_IMAGE_SIZES = [16, 32, 64, 128, 256, 512, 1024, 2048, 4096];

export function stripFileExtension(value: string) {
    return value.split(".")[0];
}

export function hashImageBuffer(buffer: Buffer, mimeType: string) {
    const hash = crypto.createHash("md5").update(buffer).digest("hex");
    return ANIMATED_IMAGE_MIME_TYPES.includes(mimeType) ? `a_${hash}` : hash;
}

export function isAllowedImageMimeType(mimeType: string | undefined, allowedMimeTypes: string[] = DEFAULT_IMAGE_MIME_TYPES) {
    return !!mimeType && allowedMimeTypes.includes(mimeType);
}

export function getCdnImagePath(pathPrefix: string, resourceId: string, hash?: string) {
    return hash ? `${pathPrefix}/${resourceId}/${stripFileExtension(hash)}` : `${pathPrefix}/${stripFileExtension(resourceId)}`;
}

export function parseCdnImageSize(rawSize: unknown) {
    const size = Array.isArray(rawSize) ? rawSize[0] : rawSize;
    if (size === undefined) return undefined;
    if (typeof size !== "string" || !/^\d+$/.test(size)) return undefined;

    const parsed = Number(size);
    return CDN_IMAGE_SIZES.includes(parsed) ? parsed : undefined;
}

export function canResizeImageMimeType(mimeType: string | undefined) {
    return !!mimeType && RASTER_IMAGE_MIME_TYPES.includes(mimeType);
}

export async function resizeCdnImage(buffer: Buffer, mimeType: string | undefined, size: number | undefined) {
    if (!size || !canResizeImageMimeType(mimeType)) return buffer;

    return sharp(buffer).resize(size, size, { fit: "cover" }).toBuffer();
}
