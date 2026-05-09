import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const outputsPath = join(process.cwd(), "extra", "admin-api", "outputs.nix");

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
