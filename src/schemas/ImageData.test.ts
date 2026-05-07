import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isImageDataUri, isImageDataUriOrAssetHash, parseBase64DataUri, parseImageDataUri } from "./ImageData";

const PngDataUri = "data:image/png;base64,iVBORw0KGgo=";
const JpegDataUri = "data:image/jpeg;base64,/9j/";
const GifDataUri = "data:image/gif;base64,R0lGODlh";
const WebpDataUri = "data:image/webp;base64,UklGRg==";

describe("image data URI validation", () => {
    test("accepts supported image data URI payloads", () => {
        assert.equal(isImageDataUri(PngDataUri), true);
        assert.equal(isImageDataUri(JpegDataUri), true);
        assert.equal(isImageDataUri(GifDataUri), true);
    });

    test("returns parsed mimetype and bytes", () => {
        const parsed = parseImageDataUri(PngDataUri);

        assert.equal(parsed?.mimetype, "image/png");
        assert.equal(parsed?.buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true);
    });

    test("parses generic base64 image data URIs for CDN upload callers", () => {
        const parsed = parseBase64DataUri(WebpDataUri);

        assert.equal(parsed?.mimetype, "image/webp");
        assert.equal(parsed?.buffer.toString("ascii"), "RIFF");
        assert.equal(isImageDataUri(WebpDataUri), false);
    });

    test("accepts strict upload data URIs or asset hashes for hash-preserving update fields", () => {
        assert.equal(isImageDataUriOrAssetHash(PngDataUri), true);
        assert.equal(isImageDataUriOrAssetHash("a_0123456789abcdef0123456789abcdef"), true);
        assert.equal(isImageDataUriOrAssetHash("0123456789abcdef0123456789abcdef"), true);
        assert.equal(isImageDataUriOrAssetHash("not-a-hash"), false);
        assert.equal(isImageDataUriOrAssetHash(WebpDataUri), false);
    });

    test("rejects unsupported or malformed data URI payloads", () => {
        assert.equal(isImageDataUri(WebpDataUri), false);
        assert.equal(isImageDataUri("data:image/png;base64,not valid base64"), false);
        assert.equal(isImageDataUri("data:image/png;base64,/9j/"), false);
        assert.equal(isImageDataUri("https://example.com/avatar.png"), false);
        assert.equal(isImageDataUri(null), false);
    });
});
