import assert from "node:assert/strict";
import { test } from "node:test";
import { FindOperator } from "typeorm";
import { createDiscoverableGuildCategoryFilter, parseDiscoverableGuildCategoryIds } from "./DiscoverableGuildCategories";

test("parseDiscoverableGuildCategoryIds supports repeated and comma-separated values", () => {
    assert.deepEqual(parseDiscoverableGuildCategoryIds(undefined), []);
    assert.deepEqual(parseDiscoverableGuildCategoryIds("1"), ["1"]);
    assert.deepEqual(parseDiscoverableGuildCategoryIds("1,2, 3 "), ["1", "2", "3"]);
    assert.deepEqual(parseDiscoverableGuildCategoryIds(["1", "2,3", " 2 "]), ["1", "2", "3"]);
    assert.deepEqual(parseDiscoverableGuildCategoryIds({ category: "1" }), []);
});

test("createDiscoverableGuildCategoryFilter omits empty categories", () => {
    assert.equal(createDiscoverableGuildCategoryFilter(undefined), undefined);
    assert.equal(createDiscoverableGuildCategoryFilter(""), undefined);
    assert.equal(createDiscoverableGuildCategoryFilter(["", "  "]), undefined);
});

test("createDiscoverableGuildCategoryFilter uses equality for one category", () => {
    assert.equal(createDiscoverableGuildCategoryFilter("42"), "42");
});

test("createDiscoverableGuildCategoryFilter uses IN for multiple categories", () => {
    const filter = createDiscoverableGuildCategoryFilter(["1", "2,3"]);

    assert.ok(filter instanceof FindOperator);
    assert.equal(filter.type, "in");
    assert.deepEqual(filter.value, ["1", "2", "3"]);
    assert.equal(filter.multipleParameters, true);
});
