import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { GUILD_FEATURES, GuildFeature, MUTABLE_GUILD_FEATURES, VANITY_URL_FEATURE, getVanityUrlFeatureState, setVanityUrlFeature, type GuildFeatureValue } from "./GuildFeatures";

const documentedDiscordGuildFeatures = [
    "ANIMATED_BANNER",
    "ANIMATED_ICON",
    "APPLICATION_COMMAND_PERMISSIONS_V2",
    "AUTO_MODERATION",
    "BANNER",
    "COMMUNITY",
    "CREATOR_MONETIZABLE_PROVISIONAL",
    "CREATOR_STORE_PAGE",
    "DEVELOPER_SUPPORT_SERVER",
    "DISCOVERABLE",
    "ENHANCED_ROLE_COLORS",
    "FEATURABLE",
    "GUESTS_ENABLED",
    "GUILD_TAGS",
    "INVITES_DISABLED",
    "INVITE_SPLASH",
    "MEMBER_VERIFICATION_GATE_ENABLED",
    "MORE_SOUNDBOARD",
    "MORE_STICKERS",
    "NEWS",
    "PARTNERED",
    "PREVIEW_ENABLED",
    "RAID_ALERTS_DISABLED",
    "ROLE_ICONS",
    "ROLE_SUBSCRIPTIONS_AVAILABLE_FOR_PURCHASE",
    "ROLE_SUBSCRIPTIONS_ENABLED",
    "SOUNDBOARD",
    "TICKETED_EVENTS_ENABLED",
    "VANITY_URL",
    "VERIFIED",
    "VIP_REGIONS",
    "WELCOME_SCREEN_ENABLED",
] as const;

describe("Guild feature helpers", () => {
    test("exports the documented Discord guild feature catalog without duplicates", () => {
        assert.deepEqual([...GUILD_FEATURES].sort(), [...documentedDiscordGuildFeatures].sort());
        assert.equal(new Set(GUILD_FEATURES).size, GUILD_FEATURES.length);
        assert.equal(VANITY_URL_FEATURE, GuildFeature.VanityUrl);
    });

    test("exports the documented mutable Discord guild feature subset", () => {
        assert.deepEqual(
            [...MUTABLE_GUILD_FEATURES].sort(),
            [GuildFeature.Community, GuildFeature.Discoverable, GuildFeature.InvitesDisabled, GuildFeature.RaidAlertsDisabled].sort(),
        );
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
