import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { GUILD_FEATURES, GuildFeature, VANITY_URL_FEATURE, getVanityUrlFeatureState, setVanityUrlFeature, type GuildFeatureValue } from "./GuildFeatures";

describe("Guild feature helpers", () => {
    test("exports Discord guild feature constants referenced by server behavior", () => {
        assert.equal(GuildFeature.Community, "COMMUNITY");
        assert.equal(GuildFeature.Discoverable, "DISCOVERABLE");
        assert.equal(GuildFeature.InvitesDisabled, "INVITES_DISABLED");
        assert.equal(GuildFeature.RaidAlertsDisabled, "RAID_ALERTS_DISABLED");
        assert.equal(VANITY_URL_FEATURE, GuildFeature.VanityUrl);
        assert.equal(GUILD_FEATURES.includes(GuildFeature.VanityUrl), true);
        assert.equal(GUILD_FEATURES.includes(GuildFeature.EnhancedRoleColors), true);
    });

    test("keeps guild feature arrays open for unknown Discord or Spacebar-specific values", () => {
        const features: GuildFeatureValue[] = [GuildFeature.Community, "SPACEBAR_EXPERIMENT"];

        assert.deepEqual(setVanityUrlFeature(features, false), ["COMMUNITY", "SPACEBAR_EXPERIMENT"]);
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
