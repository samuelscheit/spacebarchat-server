import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { CdnConfiguration } from "@spacebar/util";
import {
    assertAnimatedImageUploadAllowed,
    getGuildProfileImageLimits,
    getPremiumStatusForAnimatedImageUpload,
    hasPremiumForAnimatedImageUpload,
    isAnimatedImageMimeType,
} from "./ImageUploadPolicy";

const always = { allowAnimated: "always" as const };
const never = { allowAnimated: "never" as const };
const premium = { allowAnimated: "premium" as const };

describe("CDN image upload policy", () => {
    test("identifies animated image MIME types", () => {
        assert.equal(isAnimatedImageMimeType("image/gif"), true);
        assert.equal(isAnimatedImageMimeType("image/apng"), true);
        assert.equal(isAnimatedImageMimeType("image/png"), false);
        assert.equal(isAnimatedImageMimeType(undefined), false);
    });

    test("allows static images regardless of animated upload policy", () => {
        assert.doesNotThrow(() => assertAnimatedImageUploadAllowed("image/png", never));
        assert.doesNotThrow(() => assertAnimatedImageUploadAllowed("image/png", premium));
    });

    test("allows animated images when configured to always allow them", () => {
        assert.doesNotThrow(() => assertAnimatedImageUploadAllowed("image/gif", always));
    });

    test("rejects animated images when disabled by config", () => {
        assert.throws(() => assertAnimatedImageUploadAllowed("image/gif", never), {
            message: "Animated image uploads are disabled",
            code: 400,
        });
    });

    test("requires premium for animated images when configured", () => {
        assert.throws(() => assertAnimatedImageUploadAllowed("image/gif", premium, { premium: false, premium_type: 0 }), {
            message: "Animated image uploads require premium",
            code: 403,
        });

        assert.doesNotThrow(() => assertAnimatedImageUploadAllowed("image/gif", premium, { premium: true, premium_type: 0 }));
        assert.doesNotThrow(() => assertAnimatedImageUploadAllowed("image/gif", premium, { premium: false, premium_type: 2 }));
    });

    test("maps guild profile avatar and banner uploads to their configured limits", () => {
        const cdn = new CdnConfiguration();
        cdn.limits.guildAvatar.allowAnimated = "never";
        cdn.limits.banner.allowAnimated = "premium";

        assert.equal(getGuildProfileImageLimits("/guilds/1/users/2/avatars", cdn).allowAnimated, "never");
        assert.equal(getGuildProfileImageLimits("/guilds/1/users/2/banners", cdn).allowAnimated, "premium");
    });

    test("only needs premium lookup for animated uploads with premium policy", async () => {
        assert.equal(await getPremiumStatusForAnimatedImageUpload("image/png", premium, "1"), undefined);
        assert.equal(await getPremiumStatusForAnimatedImageUpload("image/gif", always, "1"), undefined);
        assert.equal(await getPremiumStatusForAnimatedImageUpload("image/gif", never, "1"), undefined);
    });

    test("treats boolean premium or positive premium_type as entitlement", () => {
        assert.equal(hasPremiumForAnimatedImageUpload({ premium: true, premium_type: 0 }), true);
        assert.equal(hasPremiumForAnimatedImageUpload({ premium: false, premium_type: 1 }), true);
        assert.equal(hasPremiumForAnimatedImageUpload({ premium: false, premium_type: 0 }), false);
        assert.equal(hasPremiumForAnimatedImageUpload(null), false);
    });
});
