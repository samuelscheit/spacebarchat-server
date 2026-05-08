import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
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
    test("keeps known feature values compatible with stored guild feature strings", () => {
        assert.equal(GuildFeature.Discoverable, "DISCOVERABLE");
        assert.equal(GuildFeature.VanityUrl, "VANITY_URL");
        assert.equal(GuildFeature.AllowUnnamedChannels, "ALLOW_UNNAMED_CHANNELS");
    });

    test("exports documented and public guild feature strings without duplicates", () => {
        const publicFeatures = JSON.parse(fs.readFileSync(path.join(process.cwd(), "assets", "public", "features.json"), "utf8")) as string[];
        const featureSet = new Set<string>(GUILD_FEATURES);

        assert.equal(featureSet.size, GUILD_FEATURES.length);
        assert.deepEqual(
            documentedDiscordGuildFeatures.filter((feature) => !featureSet.has(feature)),
            [],
        );
        assert.deepEqual(
            publicFeatures.filter((feature) => !featureSet.has(feature)),
            [],
        );
        assert.equal(VANITY_URL_FEATURE, GuildFeature.VanityUrl);
    });

    test("exports the mutable guild feature subset", () => {
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
        assert.deepEqual(setVanityUrlFeature([GuildFeature.Community, GuildFeature.VanityUrl], false), [GuildFeature.Community]);
    });

    test("adds VANITY_URL once when a guild has a vanity URL", () => {
        assert.deepEqual(setVanityUrlFeature([GuildFeature.Community, GuildFeature.VanityUrl], true), [GuildFeature.Community, GuildFeature.VanityUrl]);
    });

    test("deduplicates VANITY_URL while preserving unrelated feature order", () => {
        assert.deepEqual(setVanityUrlFeature([GuildFeature.Community, GuildFeature.VanityUrl, GuildFeature.News, GuildFeature.VanityUrl], true), [
            GuildFeature.Community,
            GuildFeature.News,
            GuildFeature.VanityUrl,
        ]);
    });

    test("handles missing stored features", () => {
        assert.deepEqual(setVanityUrlFeature(undefined, true), [GuildFeature.VanityUrl]);
        assert.deepEqual(setVanityUrlFeature(null, false), []);
    });

    test("reports a change when a vanity URL is created for a guild without the feature", () => {
        assert.deepEqual(getVanityUrlFeatureState([GuildFeature.Community], true), {
            features: [GuildFeature.Community, GuildFeature.VanityUrl],
            changed: true,
        });
    });

    test("reports no change when deleting one of multiple vanity URLs keeps another vanity URL", () => {
        assert.deepEqual(getVanityUrlFeatureState([GuildFeature.Community, GuildFeature.VanityUrl], true), {
            features: [GuildFeature.Community, GuildFeature.VanityUrl],
            changed: false,
        });
    });

    test("reports a change when deleting or expiring the last vanity URL", () => {
        assert.deepEqual(getVanityUrlFeatureState([GuildFeature.Community, GuildFeature.VanityUrl], false), {
            features: [GuildFeature.Community],
            changed: true,
        });
    });

    test("reports no change when a guild already has no vanity URL state", () => {
        assert.deepEqual(getVanityUrlFeatureState([GuildFeature.Community], false), {
            features: [GuildFeature.Community],
            changed: false,
        });
    });
});
