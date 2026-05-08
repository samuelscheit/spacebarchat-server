import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_DISCOVERY_CATEGORIES } from "./DefaultDiscoveryCategories";

test("default discovery categories use stable unique ids", () => {
    const ids = DEFAULT_DISCOVERY_CATEGORIES.map((category) => category.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual(
        [...ids].sort((a, b) => a - b),
        ids,
    );
});

test("default discovery categories have complete API-safe values", () => {
    assert.ok(DEFAULT_DISCOVERY_CATEGORIES.length > 0);

    for (const category of DEFAULT_DISCOVERY_CATEGORIES) {
        assert.equal(Number.isInteger(category.id), true);
        assert.ok(category.id >= 0);
        assert.equal(typeof category.name, "string");
        assert.notEqual(category.name.trim(), "");
        assert.equal(typeof category.is_primary, "boolean");
        assert.equal(typeof category.localizations, "object");
        assert.notEqual(category.localizations, null);
        assert.equal(Array.isArray(category.localizations), false);

        for (const [locale, localization] of Object.entries(category.localizations)) {
            assert.notEqual(locale.trim(), "");
            assert.equal(typeof localization, "string");
            assert.notEqual(localization.trim(), "");
        }
    }
});

test("default discovery categories include the expected Discord primary categories", () => {
    const primaryNames = DEFAULT_DISCOVERY_CATEGORIES.filter((category) => category.is_primary).map((category) => category.name);

    assert.deepEqual(primaryNames, [
        "General",
        "Gaming",
        "Music",
        "Entertainment",
        "Creative Arts",
        "Science & Tech",
        "Education",
        "Sports",
        "Fashion & Beauty",
        "Relationships & Identity",
        "Travel & Food",
        "Fitness & Health",
        "Finance",
        "Other",
        "General Chatting",
        "Emoji",
        "Bots",
    ]);
});
