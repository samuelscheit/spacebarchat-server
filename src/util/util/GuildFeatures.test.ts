import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getVanityUrlFeatureState, GuildFeature, hasGuildFeature, setVanityUrlFeature, VANITY_URL_FEATURE, VIP_REGIONS_FEATURE } from "./GuildFeatures";

describe("Guild feature helpers", () => {
    test("exports named guild feature enum values with compatibility aliases", () => {
        assert.equal(GuildFeature.VanityUrl, "VANITY_URL");
        assert.equal(GuildFeature.VipRegions, "VIP_REGIONS");
        assert.equal(VANITY_URL_FEATURE, GuildFeature.VanityUrl);
        assert.equal(VIP_REGIONS_FEATURE, GuildFeature.VipRegions);
    });

    test("detects enum-backed guild feature membership", () => {
        assert.equal(hasGuildFeature(["COMMUNITY", GuildFeature.VipRegions], GuildFeature.VipRegions), true);
        assert.equal(hasGuildFeature(["COMMUNITY", "VIP_REGIONS_DISABLED"], GuildFeature.VipRegions), false);
        assert.equal(hasGuildFeature(undefined, GuildFeature.VipRegions), false);
        assert.equal(hasGuildFeature(null, GuildFeature.VipRegions), false);
    });

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
});
