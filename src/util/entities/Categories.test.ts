import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

test("Categories entity does not carry the orphaned default discovery category TODO sample", () => {
    const source = readFileSync(join(process.cwd(), "src/util/entities/Categories.ts"), "utf8");

    assert.doesNotMatch(source, /TODO:\s*categories:/);
    assert.doesNotMatch(source, /"default":\s*"Anime & Manga"/);
    assert.doesNotMatch(source, /Also populate discord default categories/);
});
