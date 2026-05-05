import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { setVanityUrlFeature } from "./GuildFeatures";

describe("Guild feature helpers", () => {
    test("removes VANITY_URL when a guild has no vanity URL", () => {
        assert.deepEqual(setVanityUrlFeature(["COMMUNITY", "VANITY_URL"], false), ["COMMUNITY"]);
    });

    test("adds VANITY_URL once when a guild has a vanity URL", () => {
        assert.deepEqual(setVanityUrlFeature(["COMMUNITY", "VANITY_URL"], true), ["COMMUNITY", "VANITY_URL"]);
    });

    test("handles missing stored features", () => {
        assert.deepEqual(setVanityUrlFeature(undefined, true), ["VANITY_URL"]);
        assert.deepEqual(setVanityUrlFeature(null, false), []);
    });
});
