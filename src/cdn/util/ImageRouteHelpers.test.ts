import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, test } from "node:test";
import imageSize from "image-size";
import {
    CDN_IMAGE_SIZES,
    canResizeImageMimeType,
    getCdnImagePath,
    hashImageBuffer,
    isAllowedImageMimeType,
    parseCdnImageSize,
    resizeCdnImage,
    stripFileExtension,
} from "./ImageRouteHelpers";

const requireFromTest = createRequire(__filename);
const sharpModulePath = requireFromTest.resolve("sharp");
const testPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEklEQVR4nGP4z8DwHxkzkC4AADxAH+HggXe0AAAAAElFTkSuQmCC", "base64");

function isSharpLoaded() {
    return requireFromTest.cache[sharpModulePath] !== undefined;
}

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

    test("parses supported CDN image size query values", () => {
        for (const size of CDN_IMAGE_SIZES) {
            assert.equal(parseCdnImageSize(String(size)), size);
        }

        assert.equal(parseCdnImageSize(["64", "128"]), 64);
        assert.equal(parseCdnImageSize(undefined), undefined);
        assert.equal(parseCdnImageSize("0"), undefined);
        assert.equal(parseCdnImageSize("15"), undefined);
        assert.equal(parseCdnImageSize("17"), undefined);
        assert.equal(parseCdnImageSize("8192"), undefined);
        assert.equal(parseCdnImageSize("64px"), undefined);
    });

    test("identifies static raster image types as resizable", () => {
        assert.equal(canResizeImageMimeType("image/png"), true);
        assert.equal(canResizeImageMimeType("image/jpeg"), true);
        assert.equal(canResizeImageMimeType("image/webp"), true);
        assert.equal(canResizeImageMimeType("image/svg+xml"), false);
        assert.equal(canResizeImageMimeType("image/gif"), false);
        assert.equal(canResizeImageMimeType(undefined), false);
    });

    test("loads sharp lazily only when an actual raster resize is requested", async () => {
        const original = Buffer.from("asset");

        assert.equal(isSharpLoaded(), false);
        assert.equal(await resizeCdnImage(original, "image/png", undefined), original);
        assert.equal(await resizeCdnImage(original, "image/svg+xml", 16), original);
        assert.equal(isSharpLoaded(), false);

        await resizeCdnImage(testPng, "image/png", 16);

        assert.equal(isSharpLoaded(), true);
    });

    test("resizes raster images when a supported size is requested", async () => {
        const resized = await resizeCdnImage(testPng, "image/png", 16);
        const dimensions = imageSize(resized);

        assert.equal(dimensions.width, 16);
        assert.equal(dimensions.height, 16);
    });

    test("does not resize when no supported size or raster MIME type is present", async () => {
        const original = Buffer.from("asset");

        assert.equal(await resizeCdnImage(original, "image/png", undefined), original);
        assert.equal(await resizeCdnImage(original, "image/svg+xml", 16), original);
    });
});
