import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const repoRoot = process.cwd();
const adminApiOutputsPath = path.join(repoRoot, "extra/admin-api/outputs.nix");

test("Admin API Nix outputs keep Spacebar.Cdn.Shared srcRoot as a relative path", () => {
    const outputs = readFileSync(adminApiOutputsPath, "utf8");
    const packageBlockMatch = outputs.match(/Spacebar-Cdn-Shared = buildSpacebarDotnetModule \{[\s\S]*?\n {8}\};/);

    assert(packageBlockMatch, "Expected Spacebar-Cdn-Shared package block in outputs.nix");

    const packageBlock = packageBlockMatch[0];
    assert.match(packageBlock, /srcRoot = \.\/Spacebar\.Cdn\.Shared;/);
    assert.doesNotMatch(packageBlock, /srcRoot = Spacebar\.Cdn\.Shared;/);
});
