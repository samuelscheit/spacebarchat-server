import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const repoRoot = process.cwd();
const adminApiOutputsPath = path.join(repoRoot, "extra/admin-api/outputs.nix");
const fsckDepsPath = path.join(repoRoot, "extra/admin-api/Utilities/Spacebar.Cdn.Fsck/deps.json");

function getPackageBlock(outputs: string, packageName: string) {
    const escapedPackageName = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const packageBlockMatch = outputs.match(new RegExp(`${escapedPackageName} = buildSpacebarDotnetModule \\{[\\s\\S]*?\\n {8}\\};`));

    assert(packageBlockMatch, `Expected ${packageName} package block in outputs.nix`);

    return packageBlockMatch[0];
}

test("Admin API Nix outputs keep Spacebar.Cdn.Shared srcRoot as a relative path", () => {
    const outputs = readFileSync(adminApiOutputsPath, "utf8");
    const packageBlock = getPackageBlock(outputs, "Spacebar-Cdn-Shared");

    assert.match(packageBlock, /srcRoot = \.\/Spacebar\.Cdn\.Shared;/);
    assert.doesNotMatch(packageBlock, /srcRoot = Spacebar\.Cdn\.Shared;/);
});

test("Admin API Nix outputs expose Spacebar.Cdn.Fsck transitive restore inputs", () => {
    const outputs = readFileSync(adminApiOutputsPath, "utf8");
    const packageBlock = getPackageBlock(outputs, "Spacebar-Cdn-Fsck");

    assert.match(packageBlock, /projectReferences = \[[\s\S]*proj\.Spacebar-Cdn-Shared[\s\S]*proj\.Spacebar-Interop-Cdn-Abstractions[\s\S]*\];/);

    const deps = JSON.parse(readFileSync(fsckDepsPath, "utf8")) as Array<{
        pname?: string;
        version?: string;
        hash?: string;
    }>;

    assert.deepEqual(
        deps.find((dep) => dep.pname === "Magick.NET.Core" && dep.version === "14.12.0"),
        {
            pname: "Magick.NET.Core",
            version: "14.12.0",
            hash: "sha256-mlOAmFcSL8JzBqwMBpFtWt6+48PIdb1qUc++wPqhBHM=",
        },
    );
});
