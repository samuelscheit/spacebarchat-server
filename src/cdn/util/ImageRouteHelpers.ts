import crypto from "node:crypto";

export const ANIMATED_IMAGE_MIME_TYPES = ["image/apng", "image/gif", "image/gifv"];
export const STATIC_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/svg"];
export const DEFAULT_IMAGE_MIME_TYPES = [...ANIMATED_IMAGE_MIME_TYPES, ...STATIC_IMAGE_MIME_TYPES];

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

export function getCdnImageHashPaths(pathPrefix: string, resourceId: string, hash: string, legacyExtensions: string[] = []) {
    const basePath = getCdnImagePath(pathPrefix, resourceId, hash);
    const paths = [basePath];

    for (const extension of legacyExtensions) {
        const normalizedExtension = extension.replace(/^\./, "");
        if (normalizedExtension) paths.push(`${basePath}.${normalizedExtension}`);
    }

    return [...new Set(paths)];
}
