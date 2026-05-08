import assert from "node:assert/strict";
import { test } from "node:test";
import { createDiscoveryCategoryFindOptions, parseDiscoveryPrimaryOnly } from "./DiscoveryCategories";

test("parseDiscoveryPrimaryOnly only enables the primary filter for explicit true values", () => {
    assert.equal(parseDiscoveryPrimaryOnly(undefined), false);
    assert.equal(parseDiscoveryPrimaryOnly(""), false);
    assert.equal(parseDiscoveryPrimaryOnly("false"), false);
    assert.equal(parseDiscoveryPrimaryOnly("0"), false);
    assert.equal(parseDiscoveryPrimaryOnly("true"), true);
    assert.equal(parseDiscoveryPrimaryOnly(" TRUE "), true);
    assert.equal(parseDiscoveryPrimaryOnly("1"), true);
    assert.equal(parseDiscoveryPrimaryOnly(["false", "1"]), true);
    assert.equal(parseDiscoveryPrimaryOnly(["false", "0"]), false);
});

test("createDiscoveryCategoryFindOptions always orders categories by stable id", () => {
    assert.deepEqual(createDiscoveryCategoryFindOptions(undefined), { order: { id: "ASC" } });
});

test("createDiscoveryCategoryFindOptions filters primary categories only when requested", () => {
    assert.deepEqual(createDiscoveryCategoryFindOptions("false"), { order: { id: "ASC" } });
    assert.deepEqual(createDiscoveryCategoryFindOptions("true"), { order: { id: "ASC" }, where: { is_primary: true } });
});
