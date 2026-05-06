export const ImageDataUriFormat = "image-data-uri";
export const ImageDataUriOrAssetHashFormat = "image-data-uri-or-asset-hash";

export type ParsedDataUri = {
    mimetype: string;
    buffer: Buffer;
};

export type ParsedImageDataUri = ParsedDataUri & {
    mimetype: "image/jpeg" | "image/png" | "image/gif";
};

const Base64Pattern = /^[A-Za-z0-9+/]+={0,2}$/;
const DataUriPattern = /^data:([^;,]+)(?:;[^,]*)?;base64,([A-Za-z0-9+/=]+)$/i;
const AssetHashPattern = /^(?:a_)?[0-9a-f]{32}$/i;

function decodeBase64(data: string): Buffer | null {
    if (!Base64Pattern.test(data) || data.length % 4 !== 0) return null;

    const buffer = Buffer.from(data, "base64");
    if (!buffer.length) return null;

    return buffer;
}

export function parseBase64DataUri(value: string): ParsedDataUri | null {
    const match = DataUriPattern.exec(value);
    if (!match) return null;

    const buffer = decodeBase64(match[2]);
    if (!buffer) return null;

    return {
        mimetype: match[1].toLowerCase(),
        buffer,
    };
}

export function parseImageDataUri(value: string): ParsedImageDataUri | null {
    const dataUri = parseBase64DataUri(value);
    if (!dataUri) return null;

    const mimetype = dataUri.mimetype as ParsedImageDataUri["mimetype"];
    const { buffer } = dataUri;

    if (mimetype === "image/png" && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
        return { mimetype, buffer };
    }

    if (mimetype === "image/jpeg" && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return { mimetype, buffer };
    }

    if (mimetype === "image/gif" && (buffer.subarray(0, 6).equals(Buffer.from("GIF87a")) || buffer.subarray(0, 6).equals(Buffer.from("GIF89a")))) {
        return { mimetype, buffer };
    }

    return null;
}

export function isImageDataUri(value: unknown): value is string {
    return typeof value === "string" && parseImageDataUri(value) !== null;
}

export function isImageDataUriOrAssetHash(value: unknown): value is string {
    if (typeof value !== "string") return false;
    if (value.startsWith("data:")) return isImageDataUri(value);
    return AssetHashPattern.test(value);
}
