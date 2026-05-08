import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { STATIC_IMAGE_MIME_TYPES, getCdnImageHashPaths, getCdnImagePath, hashImageBuffer, isAllowedImageMimeType, stripFileExtension } from "./ImageRouteHelpers";

describe("CDN image route helpers", () => {
    test("strips requested file extensions from route params", () => {
        assert.equal(stripFileExtension("123.png"), "123");
        assert.equal(stripFileExtension("123"), "123");
    });

    test("builds CDN storage paths for resource roots and hashes", () => {
        assert.equal(getCdnImagePath("icons", "guild-id.png"), "icons/guild-id");
        assert.equal(getCdnImagePath("icons", "guild-id", "hash.webp"), "icons/guild-id/hash");
    });

    test("keeps emoji replacement uploads on the same storage key", () => {
        const firstHash = hashImageBuffer(Buffer.from("old emoji"), "image/png");
        const replacementHash = hashImageBuffer(Buffer.from("replacement emoji"), "image/png");
        const firstUploadPath = getCdnImagePath("emojis", "emoji-id");
        const replacementUploadPath = getCdnImagePath("emojis", "emoji-id");

        assert.notEqual(firstHash, replacementHash);
        assert.equal(firstUploadPath, "emojis/emoji-id");
        assert.equal(replacementUploadPath, firstUploadPath);
        assert.equal(getCdnImagePath("emojis", "emoji-id.png"), "emojis/emoji-id");
        assert.notEqual(getCdnImagePath("emojis", "emoji-id", firstHash), "emojis/emoji-id");
        assert.notEqual(getCdnImagePath("emojis", "emoji-id", replacementHash), "emojis/emoji-id");
    });

    test("builds extensionless CDN hash paths with optional legacy extension fallbacks", () => {
        assert.deepEqual(getCdnImageHashPaths("role-icons", "role-id", "hash.webp"), ["role-icons/role-id/hash"]);
        assert.deepEqual(getCdnImageHashPaths("role-icons", "role-id", "hash.webp", ["png", "webp"]), [
            "role-icons/role-id/hash",
            "role-icons/role-id/hash.webp",
            "role-icons/role-id/hash.png",
        ]);
        assert.deepEqual(getCdnImageHashPaths("role-icons", "role-id", "hash", [".png", "webp", "png"]), [
            "role-icons/role-id/hash",
            "role-icons/role-id/hash.png",
            "role-icons/role-id/hash.webp",
        ]);
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

    test("supports static-only image policies for role icons", () => {
        assert.equal(isAllowedImageMimeType("image/png", STATIC_IMAGE_MIME_TYPES), true);
        assert.equal(isAllowedImageMimeType("image/jpeg", STATIC_IMAGE_MIME_TYPES), true);
        assert.equal(isAllowedImageMimeType("image/webp", STATIC_IMAGE_MIME_TYPES), true);
        assert.equal(isAllowedImageMimeType("image/gif", STATIC_IMAGE_MIME_TYPES), false);
    });
});
