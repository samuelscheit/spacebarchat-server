import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const adminApiOutputsPath = path.join(process.cwd(), "extra", "admin-api", "outputs.nix");
const fsckDepsPath = path.join(process.cwd(), "extra", "admin-api", "Utilities", "Spacebar.Cdn.Fsck", "deps.json");

test("admin API Nix outputs qualify dotted srcRoot paths as relative paths", async () => {
    const source = await fs.readFile(adminApiOutputsPath, "utf8");
    const unqualifiedDottedSrcRoots = Array.from(source.matchAll(/\bsrcRoot\s*=\s*([A-Z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)+)\s*;/g), (match) => match[1]);

    assert.deepEqual(unqualifiedDottedSrcRoots, []);
    assert.match(source, /\bsrcRoot\s*=\s*\.\/Spacebar\.Cdn\.Shared\s*;/);
});

test("Spacebar.Cdn.Fsck Nix restore closure includes CDN abstraction transitive inputs", async () => {
    const source = await fs.readFile(adminApiOutputsPath, "utf8");
    const fsckOutputMatch = source.match(/Spacebar-Cdn-Fsck = buildSpacebarDotnetModule \{([\s\S]*?)\n\s{8}\};/);

    assert.ok(fsckOutputMatch);
    assert.match(fsckOutputMatch[1], /\bproj\.Spacebar-Cdn-Shared\b/);

    const fsckDeps = JSON.parse(await fs.readFile(fsckDepsPath, "utf8")) as {
        pname: string;
        version: string;
        hash: string;
    }[];

    assert.ok(fsckDeps.some((dep) => dep.pname === "Magick.NET.Core" && dep.version === "14.12.0" && dep.hash === "sha256-mlOAmFcSL8JzBqwMBpFtWt6+48PIdb1qUc++wPqhBHM="));
});
