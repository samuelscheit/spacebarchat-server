import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const adminApiOutputsPath = path.join(process.cwd(), "extra", "admin-api", "outputs.nix");

test("admin API Nix outputs qualify dotted srcRoot paths as relative paths", async () => {
    const source = await fs.readFile(adminApiOutputsPath, "utf8");
    const unqualifiedDottedSrcRoots = Array.from(source.matchAll(/\bsrcRoot\s*=\s*([A-Z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)+)\s*;/g), (match) => match[1]);

    assert.deepEqual(unqualifiedDottedSrcRoots, []);
    assert.match(source, /\bsrcRoot\s*=\s*\.\/Spacebar\.Cdn\.Shared\s*;/);
});
