export const ImageDataUriFormat = "image-data-uri";

export type ParsedImageDataUri = {
    mimetype: "image/jpeg" | "image/png" | "image/gif";
    buffer: Buffer;
};

const Base64Pattern = /^[A-Za-z0-9+/]+={0,2}$/;

export function parseImageDataUri(value: string): ParsedImageDataUri | null {
    const match = /^data:(image\/(?:jpeg|png|gif));base64,([A-Za-z0-9+/=]+)$/.exec(value);
    if (!match) return null;

    const mimetype = match[1] as ParsedImageDataUri["mimetype"];
    const data = match[2];
    if (!Base64Pattern.test(data) || data.length % 4 !== 0) return null;

    const buffer = Buffer.from(data, "base64");
    if (!buffer.length) return null;

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
