import "reflect-metadata";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { getMetadataArgsStorage } from "typeorm";
import { Categories } from "./Categories";

test("Categories.id keeps discovery category ids as integers instead of snowflakes", () => {
    const idColumn = getMetadataArgsStorage().columns.find((column) => column.target === Categories && column.propertyName === "id");

    assert.ok(idColumn);
    assert.equal(idColumn.options.type, "int");

    const acceptsNumericCategoryId = (_value: number) => undefined;
    acceptsNumericCategoryId(undefined as unknown as Categories["id"]);
    // @ts-expect-error discovery category ids are numeric ids, not snowflake strings.
    const rejectsSnowflakeString: Categories["id"] = "5";
    void rejectsSnowflakeString;
});

test("Categories entity does not carry the orphaned default discovery category TODO sample", () => {
    const source = readFileSync(join(process.cwd(), "src/util/entities/Categories.ts"), "utf8");

    assert.doesNotMatch(source, /TODO:\s*categories:/);
    assert.doesNotMatch(source, /"default":\s*"Anime & Manga"/);
    assert.doesNotMatch(source, /Also populate discord default categories/);
});
