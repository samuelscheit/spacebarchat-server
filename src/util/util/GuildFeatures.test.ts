import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { PATCH_MUTABLE_GUILD_FEATURES, canPatchGuildFeature, getVanityUrlFeatureState, setVanityUrlFeature } from "./GuildFeatures";

describe("Guild feature helpers", () => {
    test("removes VANITY_URL when a guild has no vanity URL", () => {
        assert.deepEqual(setVanityUrlFeature(["COMMUNITY", "VANITY_URL"], false), ["COMMUNITY"]);
    });

    test("adds VANITY_URL once when a guild has a vanity URL", () => {
        assert.deepEqual(setVanityUrlFeature(["COMMUNITY", "VANITY_URL"], true), ["COMMUNITY", "VANITY_URL"]);
    });

    test("deduplicates VANITY_URL while preserving unrelated feature order", () => {
        assert.deepEqual(setVanityUrlFeature(["COMMUNITY", "VANITY_URL", "NEWS", "VANITY_URL"], true), ["COMMUNITY", "NEWS", "VANITY_URL"]);
    });

    test("handles missing stored features", () => {
        assert.deepEqual(setVanityUrlFeature(undefined, true), ["VANITY_URL"]);
        assert.deepEqual(setVanityUrlFeature(null, false), []);
    });

    test("reports a change when a vanity URL is created for a guild without the feature", () => {
        assert.deepEqual(getVanityUrlFeatureState(["COMMUNITY"], true), {
            features: ["COMMUNITY", "VANITY_URL"],
            changed: true,
        });
    });

    test("reports no change when deleting one of multiple vanity URLs keeps another vanity URL", () => {
        assert.deepEqual(getVanityUrlFeatureState(["COMMUNITY", "VANITY_URL"], true), {
            features: ["COMMUNITY", "VANITY_URL"],
            changed: false,
        });
    });

    test("reports a change when deleting or expiring the last vanity URL", () => {
        assert.deepEqual(getVanityUrlFeatureState(["COMMUNITY", "VANITY_URL"], false), {
            features: ["COMMUNITY"],
            changed: true,
        });
    });

    test("reports no change when a guild already has no vanity URL state", () => {
        assert.deepEqual(getVanityUrlFeatureState(["COMMUNITY"], false), {
            features: ["COMMUNITY"],
            changed: false,
        });
    });

    test("identifies guild features that the guild update route may patch", () => {
        assert.deepEqual(PATCH_MUTABLE_GUILD_FEATURES, ["COMMUNITY", "INVITES_DISABLED", "DISCOVERABLE"]);

        for (const feature of PATCH_MUTABLE_GUILD_FEATURES) {
            assert.equal(canPatchGuildFeature(feature), true, `${feature} should be patch-mutable`);
        }
    });

    test("keeps privileged and derived guild features immutable through guild updates", () => {
        assert.equal(canPatchGuildFeature("VANITY_URL"), false);
        assert.equal(canPatchGuildFeature("NEWS"), false);
        assert.equal(canPatchGuildFeature(""), false);
    });
});
