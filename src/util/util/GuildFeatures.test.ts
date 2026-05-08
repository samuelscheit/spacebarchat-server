import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { GuildFeature, getVanityUrlFeatureState, setVanityUrlFeature } from "./GuildFeatures";

describe("Guild feature helpers", () => {
    test("keeps enum values compatible with stored guild feature strings", () => {
        assert.equal(GuildFeature.Discoverable, "DISCOVERABLE");
        assert.equal(GuildFeature.VanityUrl, "VANITY_URL");
    });

    test("covers every public guild feature string in the feature manifest", () => {
        const publicFeatures = JSON.parse(fs.readFileSync(path.join(process.cwd(), "assets", "public", "features.json"), "utf8")) as string[];
        const enumValues = new Set(Object.values(GuildFeature));

        assert.deepEqual(
            publicFeatures.filter((feature) => !enumValues.has(feature as GuildFeature)),
            [],
        );
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
