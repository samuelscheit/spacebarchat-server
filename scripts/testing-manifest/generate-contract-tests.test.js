"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdtemp, readFile, rm, writeFile } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const repoRoot = path.join(__dirname, "..", "..");
const generator = path.join(repoRoot, "scripts", "testing-manifest", "generate-contract-tests.js");

test("generated CDN upload contracts use extensionless returned hash paths for role icons", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "spacebar-contract-generator-"));

    try {
        const manifestPath = path.join(tempDir, "manifest.json");
        const matrixPath = path.join(tempDir, "http-contracts.json");
        const contractTestPath = path.join(tempDir, "http-contracts.test.js");
        const runtimeTestPath = path.join(tempDir, "http-auth-runtime-contracts.test.ts");
        await writeFile(
            manifestPath,
            JSON.stringify({
                schemaVersion: 1,
                generatedAt: "2026-05-08T00:00:00.000Z",
                entries: [
                    {
                        id: "cdn:http:POST:/role-icons/:role_id",
                        type: "http-route",
                        service: "cdn",
                        method: "POST",
                        path: "/role-icons/:role_id",
                        sourceFile: "src/cdn/routes/role-icons.ts",
                        line: 6,
                        authMode: "request-signature",
                        coverage: {
                            testTier: "cdn-integration",
                            benchmarkClass: "cdn-hot-path",
                            fixtureRequirements: ["files", "request-signature"],
                            contractChecks: ["upload-download-delete", "mime"],
                        },
                        routeMetadata: { present: false },
                    },
                ],
            }),
        );

        const result = spawnSync(
            process.execPath,
            [generator, "--manifest", manifestPath, "--output", matrixPath, "--test-output", contractTestPath, "--runtime-test-output", runtimeTestPath],
            { cwd: repoRoot, encoding: "utf8" },
        );

        assert.equal(result.status, 0, result.stderr || result.stdout);
        const runtimeSource = await readFile(runtimeTestPath, "utf8");

        assert.doesNotMatch(runtimeSource, /cdn:http:POST:\/role-icons\/:role_id[\s\S]+?\.png/, "role icon uploads should not expect legacy .png storage keys");
        assert.match(runtimeSource, /return `\$\{samplePath\}\/\$\{id\}`;/, "hash image uploads should use the returned extensionless id path");
    } finally {
        await rm(tempDir, { recursive: true, force: true });
    }
});
