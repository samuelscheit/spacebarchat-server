import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { CdnConfiguration } from "../config/types/CdnConfiguration";
import {
    assertCdnAnimatedImageAllowed,
    assertCdnAnimatedImagePolicy,
    assertCdnFileSizeLimit,
    getCdnFileSizeLimit,
    getCdnImageLimits,
    getConfiguredCdnMultipartFileLimit,
    getConfiguredImageUploadBodyLimit,
    isCdnAnimatedImageAllowed,
} from "./CdnFileLimits";

function createCdnConfig() {
    const cdn = new CdnConfiguration();
    cdn.limits.avatar.maxSize = 1024;
    cdn.limits.banner.maxSize = 2048;
    cdn.limits.guildAvatar.maxSize = 4096;
    cdn.limits.roleIcon.maxSize = 512;
    return cdn;
}

describe("CDN file size limits", () => {
    test("resolves configured avatar and banner limits from upload paths", () => {
        const cdn = createCdnConfig();

        assert.equal(getCdnFileSizeLimit("/avatars/user-id", cdn), 1024);
        assert.equal(getCdnFileSizeLimit("/banners/guild-id", cdn), 2048);
        assert.equal(getCdnFileSizeLimit("/guilds/guild-id/users/user-id/avatars", cdn), 4096);
        assert.equal(getCdnFileSizeLimit("/guilds/guild-id/users/user-id/banners", cdn), 2048);
        assert.equal(getCdnFileSizeLimit("/role-icons/role-id", cdn), 512);
    });

    test("resolves sticker image limits from CDN sticker upload paths", () => {
        const cdn = createCdnConfig();
        cdn.limits.sticker.maxSize = 512;

        assert.equal(getCdnImageLimits("/stickers/sticker-id", cdn), cdn.limits.sticker);
        assert.equal(getCdnFileSizeLimit("/stickers/sticker-id", cdn), 512);
    });

    test("rejects configured avatar uploads that exceed the limit", () => {
        const cdn = createCdnConfig();

        assert.throws(() => assertCdnFileSizeLimit("/avatars/user-id", 1025, cdn), {
            code: 50045,
            message: "File uploaded exceeds the maximum size",
        });
    });

    test("rejects configured role icon uploads that exceed the limit", () => {
        const cdn = createCdnConfig();

        assert.throws(() => assertCdnFileSizeLimit("/role-icons/role-id", 513, cdn), {
            code: 50045,
            message: "File uploaded exceeds the maximum size",
        });
    });

    test("allows upload paths without configured image limits", () => {
        const cdn = createCdnConfig();

        assert.doesNotThrow(() => assertCdnFileSizeLimit("/emojis/emoji-id", Number.MAX_SAFE_INTEGER, cdn));
    });

    test("resolves configured animated image policy from upload paths", () => {
        const cdn = createCdnConfig();

        cdn.limits.banner.allowAnimated = "never";
        assert.equal(isCdnAnimatedImageAllowed("/banners/guild-id", cdn), false);
        assert.equal(isCdnAnimatedImageAllowed("/guilds/guild-id/users/user-id/banners", cdn), false);

        cdn.limits.banner.allowAnimated = "premium";
        assert.equal(isCdnAnimatedImageAllowed("/banners/guild-id", cdn), false);
        assert.equal(isCdnAnimatedImageAllowed("/banners/guild-id", cdn, true), true);

        cdn.limits.banner.allowAnimated = "always";
        assert.equal(isCdnAnimatedImageAllowed("/banners/guild-id", cdn), true);

        assert.equal(isCdnAnimatedImageAllowed("/emojis/emoji-id", cdn), true);
    });

    test("rejects animated uploads when the configured image policy disallows them", () => {
        const cdn = createCdnConfig();
        cdn.limits.banner.allowAnimated = "never";

        assert.throws(() => assertCdnAnimatedImageAllowed("/banners/guild-id", true, cdn), {
            code: 50035,
            message: "Invalid form body (returned for both application/json and multipart/form-data bodies), or invalid Content-Type provided",
        });
        assert.doesNotThrow(() => assertCdnAnimatedImageAllowed("/banners/guild-id", false, cdn));
    });

    test("rejects animated sticker uploads when sticker animation is disabled", () => {
        const cdn = createCdnConfig();
        cdn.limits.sticker.allowAnimated = "never";

        assert.throws(() => assertCdnAnimatedImagePolicy("/stickers/sticker-id", "image/gif", cdn), {
            code: 50046,
            message: "Invalid file uploaded",
        });
    });

    test("allows static stickers and leaves premium-only animation to callers with entitlement context", () => {
        const cdn = createCdnConfig();
        cdn.limits.sticker.allowAnimated = "never";
        assert.doesNotThrow(() => assertCdnAnimatedImagePolicy("/stickers/sticker-id", "image/png", cdn));

        cdn.limits.sticker.allowAnimated = "premium";
        assert.doesNotThrow(() => assertCdnAnimatedImagePolicy("/stickers/sticker-id", "image/gif", cdn));
    });

    test("accounts for base64 expansion when setting JSON upload body limit", () => {
        const cdn = createCdnConfig();

        assert.equal(getConfiguredImageUploadBodyLimit(cdn), 10 * 1024 * 1024);

        cdn.limits.roleIcon.maxSize = 12 * 1024 * 1024;
        assert.equal(getConfiguredImageUploadBodyLimit(cdn), 17 * 1024 * 1024);
    });

    test("sizes CDN multipart uploads from configured attachment and profile image limits", () => {
        const cdn = createCdnConfig();
        cdn.maxAttachmentSize = 25 * 1024 * 1024;

        assert.equal(getConfiguredCdnMultipartFileLimit(cdn), 25 * 1024 * 1024);

        cdn.limits.roleIcon.maxSize = 128 * 1024 * 1024;
        assert.equal(getConfiguredCdnMultipartFileLimit(cdn), 128 * 1024 * 1024);

        cdn.maxAttachmentSize = 256 * 1024 * 1024;
        assert.equal(getConfiguredCdnMultipartFileLimit(cdn), 256 * 1024 * 1024);
    });
});
