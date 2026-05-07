"use strict";

const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const manifest = require("../../assets/testing-manifest.json");
const matrix = require("./suite-coverage.json");
const packageJson = require("../../package.json");

const repoRoot = path.join(__dirname, "..", "..");
const entryById = new Map(manifest.entries.map((entry) => [entry.id, entry]));

function commandIndex(command) {
    const script = packageJson.scripts["test:ci"] || "";
    return script.indexOf(command);
}

describe("generated suite coverage matrix", () => {
    test("declares runnable package commands for every suite group", () => {
        assert.ok(packageJson.scripts["test:suite-coverage"], "missing test:suite-coverage package script");

        for (const group of matrix.groups) {
            assert.ok(packageJson.scripts[group.command], `missing package script ${group.command}`);
        }
    });

    test("keeps CI gate order aligned with TESTING.md", () => {
        const expectedOrder = ["test:manifest", "test:contracts", "test:harness", "test:scenarios", "test:protocol", "test:migrations", "bench:test"];
        let previous = -1;

        for (const command of expectedOrder) {
            const index = commandIndex(command);
            assert.notEqual(index, -1, `test:ci does not include ${command}`);
            assert.ok(index > previous, `${command} appears out of order in test:ci`);
            previous = index;
        }
    });

    test("assigns every required manifest entry to a suite in its group", () => {
        for (const group of matrix.groups) {
            const covered = new Set(group.coveredManifestIds);
            assert.equal(covered.size, group.coveredManifestIds.length, `${group.id} has duplicate covered manifest IDs`);

            for (const id of group.requiredManifestIds) {
                assert.ok(covered.has(id), `${group.id} does not cover ${id}`);
            }

            assert.equal(group.summary.totalRequiredManifestEntries, group.requiredManifestIds.length);
            assert.equal(group.summary.totalCoveredManifestEntries, group.coveredManifestIds.length);
            assert.equal(group.summary.totalCoveredRequiredManifestEntries, group.coveredManifestIds.filter((id) => group.requiredManifestIds.includes(id)).length);
        }
    });

    test("each suite lists existing test files and concrete manifest IDs", () => {
        for (const group of matrix.groups) {
            for (const suite of group.suites) {
                assert.ok(suite.id, `${group.id} has suite without id`);
                assert.ok(Array.isArray(suite.testFiles) && suite.testFiles.length > 0, `${group.id}:${suite.id} has no test files`);
                assert.ok(Array.isArray(suite.manifestIds) && suite.manifestIds.length > 0, `${group.id}:${suite.id} has no manifest IDs`);

                for (const file of suite.testFiles) {
                    assert.ok(fs.existsSync(path.join(repoRoot, file)), `${group.id}:${suite.id} references missing test file ${file}`);
                }

                for (const id of suite.manifestIds) {
                    const entry = entryById.get(id);
                    assert.ok(entry, `${group.id}:${suite.id} references unknown manifest id ${id}`);
                    assert.ok(group.requiredManifestIds.includes(id), `${group.id}:${suite.id} covers ${id} outside required manifest entries`);
                }
            }
        }
    });
});
