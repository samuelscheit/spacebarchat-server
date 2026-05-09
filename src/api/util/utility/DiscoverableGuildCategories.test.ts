import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { FindOperator } from "typeorm";
import { createDiscoverableGuildCategoryFilter, parseDiscoverableGuildCategoryIds } from "./DiscoverableGuildCategories";

test("parseDiscoverableGuildCategoryIds supports repeated and comma-separated values", () => {
    assert.deepEqual(parseDiscoverableGuildCategoryIds(undefined), []);
    assert.deepEqual(parseDiscoverableGuildCategoryIds("1"), [1]);
    assert.deepEqual(parseDiscoverableGuildCategoryIds("1,2, 3 "), [1, 2, 3]);
    assert.deepEqual(parseDiscoverableGuildCategoryIds(["1", "2,3", " 2 "]), [1, 2, 3]);
    assert.deepEqual(parseDiscoverableGuildCategoryIds([" 1 ", "1", "2,, "]), [1, 2]);
    assert.deepEqual(parseDiscoverableGuildCategoryIds({ category: "1" }), []);
});

test("parseDiscoverableGuildCategoryIds ignores invalid integer ids", () => {
    assert.deepEqual(parseDiscoverableGuildCategoryIds("1,not-a-number,-2,3.5,2147483648,4"), [1, 4]);
});

test("createDiscoverableGuildCategoryFilter omits empty categories", () => {
    assert.equal(createDiscoverableGuildCategoryFilter(undefined), undefined);
    assert.equal(createDiscoverableGuildCategoryFilter(""), undefined);
    assert.equal(createDiscoverableGuildCategoryFilter(["", "  ", "invalid"]), undefined);
});

test("createDiscoverableGuildCategoryFilter uses equality for one category", () => {
    assert.equal(createDiscoverableGuildCategoryFilter("42"), 42);
});

test("createDiscoverableGuildCategoryFilter uses IN for multiple categories", () => {
    const filter = createDiscoverableGuildCategoryFilter(["1", "2,3"]);

    assert.ok(filter instanceof FindOperator);
    assert.equal(filter.type, "in");
    assert.deepEqual(filter.value, [1, 2, 3]);
    assert.equal(filter.multipleParameters, true);
});

test("discoverable guild category query parameters are documented in OpenAPI", async () => {
    const openapi = JSON.parse(await readFile("assets/openapi.json", "utf8")) as {
        paths: Record<string, Record<string, { parameters?: { name: string; in: string; description?: string }[] }>>;
    };

    const parameters = openapi.paths["/discoverable-guilds/"]?.get?.parameters ?? [];

    assert.ok(parameters.some((parameter) => parameter.in === "query" && parameter.name === "offset"));
    assert.ok(parameters.some((parameter) => parameter.in === "query" && parameter.name === "limit"));
    assert.ok(parameters.some((parameter) => parameter.in === "query" && parameter.name === "categories" && parameter.description?.includes("repeated or comma-separated")));
});
