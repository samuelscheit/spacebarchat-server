const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const outputsPath = path.join(__dirname, "..", "..", "extra", "admin-api", "outputs.nix");

function readOutputs() {
    return fs.readFileSync(outputsPath, "utf8");
}

test("admin-api Nix outputs use a relative source path for the shared CDN project", () => {
    const source = readOutputs();

    assert.match(
        source,
        /Spacebar-Cdn-Shared\s*=\s*buildSpacebarDotnetModule\s*{[\s\S]*?srcRoot\s*=\s*\.\/Spacebar\.Cdn\.Shared;/,
        "Spacebar.Cdn.Shared must be passed as a relative path, not as a dotted Nix identifier",
    );
});

test("admin-api Nix srcRoot entries do not use unqualified dotted identifiers", () => {
    const source = readOutputs();
    const unsafeSrcRoots = [...source.matchAll(/srcRoot\s*=\s*([^;\n]+);/g)]
        .map((match) => match[1].trim())
        .filter((expr) => /^[A-Za-z_][A-Za-z0-9_'-]*(?:\.[A-Za-z0-9_'-]+)+$/.test(expr));

    assert.deepEqual(unsafeSrcRoots, []);
});
