import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { HTTPError } from "lambert-server";
import { assertAnimatedAvatarUploadAllowed, isAnimatedAvatarMimeType, isPremiumUser } from "./AvatarUploadPolicy";

const lookupPremium = async () => ({ premium: true, premium_type: 0 });
const lookupPremiumType = async () => ({ premium: false, premium_type: 2 });
const lookupFree = async () => ({ premium: false, premium_type: 0 });

describe("avatar upload animated-image policy", () => {
    test("identifies animated avatar MIME types", () => {
        assert.equal(isAnimatedAvatarMimeType("image/gif"), true);
        assert.equal(isAnimatedAvatarMimeType("image/apng"), true);
        assert.equal(isAnimatedAvatarMimeType("image/png"), false);
        assert.equal(isAnimatedAvatarMimeType(undefined), false);
    });

    test("treats premium flag or premium type as premium", () => {
        assert.equal(isPremiumUser({ premium: true, premium_type: 0 }), true);
        assert.equal(isPremiumUser({ premium: false, premium_type: 2 }), true);
        assert.equal(isPremiumUser({ premium: false, premium_type: 0 }), false);
        assert.equal(isPremiumUser(null), false);
    });

    test("allows static avatars without a user lookup", async () => {
        let called = false;
        await assertAnimatedAvatarUploadAllowed({
            allowAnimated: "never",
            mimeType: "image/png",
            lookupUser: async () => {
                called = true;
                return null;
            },
        });
        assert.equal(called, false);
    });

    test("allows animated avatars when configured to always allow them", async () => {
        await assertAnimatedAvatarUploadAllowed({
            allowAnimated: "always",
            mimeType: "image/gif",
            userId: "user-id",
            lookupUser: lookupFree,
        });
    });

    test("allows generic animated avatar storage in premium mode without a user lookup", async () => {
        let called = false;
        await assertAnimatedAvatarUploadAllowed({
            allowAnimated: "premium",
            mimeType: "image/gif",
            lookupUser: async () => {
                called = true;
                return null;
            },
        });
        assert.equal(called, false);
    });

    test("rejects animated avatars when configured to never allow them", async () => {
        await assert.rejects(
            assertAnimatedAvatarUploadAllowed({
                allowAnimated: "never",
                mimeType: "image/gif",
                userId: "user-id",
                lookupUser: lookupPremium,
            }),
            (error) => error instanceof HTTPError && error.message === "Animated avatars are disabled",
        );
    });

    test("allows animated avatars for premium users in premium mode", async () => {
        await assertAnimatedAvatarUploadAllowed({
            allowAnimated: "premium",
            mimeType: "image/gif",
            userId: "premium-user",
            lookupUser: lookupPremium,
        });
        await assertAnimatedAvatarUploadAllowed({
            allowAnimated: "premium",
            mimeType: "image/gif",
            userId: "premium-type-user",
            lookupUser: lookupPremiumType,
        });
    });

    test("rejects animated user avatars for non-premium or missing users in premium mode", async () => {
        for (const lookupUser of [lookupFree, async () => null]) {
            await assert.rejects(
                assertAnimatedAvatarUploadAllowed({
                    allowAnimated: "premium",
                    mimeType: "image/gif",
                    userId: "free-user",
                    lookupUser,
                }),
                (error) => error instanceof HTTPError && error.message === "Animated avatars require premium",
            );
        }
    });
});
