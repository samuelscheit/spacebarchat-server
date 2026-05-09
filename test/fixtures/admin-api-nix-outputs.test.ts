import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const outputsPath = join(process.cwd(), "extra", "admin-api", "outputs.nix");
const fsckDepsPath = join(process.cwd(), "extra", "admin-api", "Utilities", "Spacebar.Cdn.Fsck", "deps.json");

test("admin-api Nix output project roots use relative paths", async () => {
    const outputs = await readFile(outputsPath, "utf8");

    assert.match(
        outputs,
        /Spacebar-Cdn-Shared\s*=\s*buildSpacebarDotnetModule\s*\{[\s\S]*?srcRoot\s*=\s*\.\/Spacebar\.Cdn\.Shared;/,
        "Spacebar.Cdn.Shared must be referenced as a relative path, not as a bare Nix identifier",
    );

    const bareDottedSrcRoots = [...outputs.matchAll(/^\s*srcRoot\s*=\s*(?!\.\/|\/|[A-Za-z]+\/)([A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)+);/gm)].map((match) => match[1]);

    assert.deepEqual(bareDottedSrcRoots, []);
});

test("admin-api Nix output provides Fsck transitive CDN restore inputs", async () => {
    const [outputs, fsckDepsRaw] = await Promise.all([readFile(outputsPath, "utf8"), readFile(fsckDepsPath, "utf8")]);
    const fsckDeps = JSON.parse(fsckDepsRaw) as Array<{ pname?: string }>;

    assert.match(
        outputs,
        /Spacebar-Cdn-Fsck\s*=\s*buildSpacebarDotnetModule\s*\{[\s\S]*?projectReferences\s*=\s*\[[\s\S]*?proj\.Spacebar-Cdn-Shared[\s\S]*?\]/,
        "Spacebar.Cdn.Fsck restores Spacebar.Cdn.Shared through Spacebar.Interop.Cdn.Abstractions and must expose it as a Nix project reference",
    );
    assert.ok(
        fsckDeps.some((dependency) => dependency.pname === "Magick.NET.Core"),
        "Spacebar.Cdn.Fsck restores Magick.NET.Core through Spacebar.Interop.Cdn.Abstractions and must include it in deps.json",
    );
});
