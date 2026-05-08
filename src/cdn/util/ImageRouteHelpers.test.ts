import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getCdnImagePath, hashImageBuffer, isAllowedImageMimeType, stripFileExtension } from "./ImageRouteHelpers";

describe("CDN image route helpers", () => {
    test("strips requested file extensions from route params", () => {
        assert.equal(stripFileExtension("123.png"), "123");
        assert.equal(stripFileExtension("123"), "123");
    });

    test("builds CDN storage paths for resource roots and hashes", () => {
        assert.equal(getCdnImagePath("icons", "guild-id.png"), "icons/guild-id");
        assert.equal(getCdnImagePath("icons", "guild-id", "hash.webp"), "icons/guild-id/hash");
    });

    test("prefixes animated image hashes", () => {
        const buffer = Buffer.from("asset");

        assert.match(hashImageBuffer(buffer, "image/gif"), /^a_/);
        assert.doesNotMatch(hashImageBuffer(buffer, "image/png"), /^a_/);
    });

    test("validates allowed image MIME types", () => {
        assert.equal(isAllowedImageMimeType("image/png"), true);
        assert.equal(isAllowedImageMimeType("image/gif"), true);
        assert.equal(isAllowedImageMimeType("text/plain"), false);
        assert.equal(isAllowedImageMimeType(undefined), false);
    });
});
