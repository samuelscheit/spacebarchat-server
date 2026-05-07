#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { DEFAULT_MANIFEST_PATH } = require("./lib");

const DEFAULT_SUITE_POLICY_PATH = path.join("testing", "suite-coverage-policy.json");
const DEFAULT_SUITE_MATRIX_PATH = path.join("test", "generated", "suite-coverage.json");
const DEFAULT_SUITE_TEST_PATH = path.join("test", "generated", "suite-coverage.test.js");

function optionValue(args, name, fallback) {
    const index = args.indexOf(name);
    if (index === -1) return fallback;
    return args[index + 1] || fallback;
}

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, "utf8"));
}

function serialize(value) {
    return `${JSON.stringify(value, null, 4)}\n`;
}

function uniqueSorted(values) {
    return [...new Set(values)].sort();
}

function hasPathPrefix(entry, prefix) {
    if (!entry.path) return false;
    if (prefix === "/") return entry.path === "/";
    return entry.path === prefix || entry.path.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`);
}

function selectorMatches(selector, entry) {
    if (selector.manifestId && entry.id !== selector.manifestId) return false;
    if (selector.idPrefix && !entry.id.startsWith(selector.idPrefix)) return false;
    if (selector.service && entry.service !== selector.service) return false;
    if (selector.type && entry.type !== selector.type) return false;
    if (selector.testTier && entry.coverage?.testTier !== selector.testTier) return false;
    if (selector.pathPrefix && !hasPathPrefix(entry, selector.pathPrefix)) return false;
    return true;
}

function expandSuiteManifestIds(suite, entries) {
    const directIds = suite.manifestIds || [];
    const selectedIds = (suite.selectors || []).flatMap((selector) => entries.filter((entry) => selectorMatches(selector, entry)).map((entry) => entry.id));
    return uniqueSorted([...directIds, ...selectedIds]);
}

function validatePolicy(policy, manifest, repoRoot) {
    const errors = [];
    const entryById = new Map(manifest.entries.map((entry) => [entry.id, entry]));
    const groupIds = new Set();
    const suiteIds = new Set();

    if (policy.schemaVersion !== 1) errors.push("suite coverage policy schemaVersion must be 1");
    if (!Array.isArray(policy.groups) || policy.groups.length === 0) errors.push("suite coverage policy has no groups");

    for (const group of policy.groups || []) {
        if (!group.id) errors.push("suite coverage group is missing id");
        if (!group.command) errors.push(`${group.id || "unknown group"} is missing command`);
        if (groupIds.has(group.id)) errors.push(`duplicate suite coverage group id: ${group.id}`);
        groupIds.add(group.id);

        if (!Array.isArray(group.requiredTestTiers) || group.requiredTestTiers.length === 0) {
            errors.push(`${group.id} has no requiredTestTiers`);
        }

        if (!Array.isArray(group.suites) || group.suites.length === 0) {
            errors.push(`${group.id} has no suites`);
            continue;
        }

        const requiredIds = manifest.entries.filter((entry) => group.requiredTestTiers.includes(entry.coverage?.testTier)).map((entry) => entry.id);
        const coveredIds = new Set();

        for (const suite of group.suites) {
            if (!suite.id) errors.push(`${group.id} has a suite without id`);
            const qualifiedSuiteId = `${group.id}:${suite.id}`;
            if (suiteIds.has(qualifiedSuiteId)) errors.push(`duplicate suite id: ${qualifiedSuiteId}`);
            suiteIds.add(qualifiedSuiteId);

            if (!Array.isArray(suite.testFiles) || suite.testFiles.length === 0) {
                errors.push(`${qualifiedSuiteId} has no testFiles`);
            }

            for (const file of suite.testFiles || []) {
                if (!fs.existsSync(path.join(repoRoot, file))) errors.push(`${qualifiedSuiteId} references missing test file ${file}`);
            }

            const manifestIds = expandSuiteManifestIds(suite, manifest.entries);
            if (manifestIds.length === 0) errors.push(`${qualifiedSuiteId} does not resolve to any manifest IDs`);

            for (const id of manifestIds) {
                const entry = entryById.get(id);
                if (!entry) {
                    errors.push(`${qualifiedSuiteId} references unknown manifest id ${id}`);
                    continue;
                }

                coveredIds.add(id);
                if (!group.requiredTestTiers.includes(entry.coverage?.testTier)) {
                    errors.push(`${qualifiedSuiteId} covers ${id} with tier ${entry.coverage?.testTier}, outside ${group.id} required tiers`);
                }
            }
        }

        for (const id of requiredIds) {
            if (!coveredIds.has(id)) errors.push(`${group.id} does not assign required manifest entry ${id} to a suite`);
        }
    }

    return errors;
}

function buildSuiteCoverage(manifest, policy) {
    const entryById = new Map(manifest.entries.map((entry) => [entry.id, entry]));
    const groups = policy.groups.map((group) => {
        const requiredManifestIds = manifest.entries.filter((entry) => group.requiredTestTiers.includes(entry.coverage?.testTier)).map((entry) => entry.id);
        const suites = group.suites.map((suite) => {
            const manifestIds = expandSuiteManifestIds(suite, manifest.entries);
            return {
                id: suite.id,
                title: suite.title,
                kind: suite.kind,
                status: suite.status,
                testFiles: suite.testFiles || [],
                fixtures: suite.fixtures || [],
                checks: suite.checks || [],
                manifestIds,
            };
        });
        const coveredManifestIds = uniqueSorted(suites.flatMap((suite) => suite.manifestIds));

        return {
            id: group.id,
            command: group.command,
            requiredTestTiers: group.requiredTestTiers,
            summary: {
                totalRequiredManifestEntries: requiredManifestIds.length,
                totalCoveredManifestEntries: coveredManifestIds.length,
                totalSuites: suites.length,
            },
            requiredManifestIds,
            coveredManifestIds,
            suites,
        };
    });

    return {
        schemaVersion: 1,
        generatedBy: "scripts/testing-manifest/generate-suite-coverage.js",
        manifestSource: DEFAULT_MANIFEST_PATH,
        policySource: DEFAULT_SUITE_POLICY_PATH,
        summary: {
            totalGroups: groups.length,
            totalSuites: groups.reduce((count, group) => count + group.suites.length, 0),
            totalCoveredManifestEntries: uniqueSorted(groups.flatMap((group) => group.coveredManifestIds)).length,
            byGroup: groups.reduce((acc, group) => {
                acc[group.id] = group.summary;
                return acc;
            }, {}),
            byCoveredTestTier: groups
                .flatMap((group) => group.coveredManifestIds)
                .reduce((acc, id) => {
                    const tier = entryById.get(id)?.coverage?.testTier || "unknown";
                    acc[tier] = (acc[tier] || 0) + 1;
                    return acc;
                }, {}),
        },
        groups,
    };
}

function generatedTestSource() {
    return `"use strict";

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
            assert.ok(packageJson.scripts[group.command], \`missing package script \${group.command}\`);
        }
    });

    test("keeps CI gate order aligned with TESTING.md", () => {
        const expectedOrder = ["test:manifest", "test:contracts", "test:harness", "test:scenarios", "test:protocol", "test:migrations", "bench:test"];
        let previous = -1;

        for (const command of expectedOrder) {
            const index = commandIndex(command);
            assert.notEqual(index, -1, \`test:ci does not include \${command}\`);
            assert.ok(index > previous, \`\${command} appears out of order in test:ci\`);
            previous = index;
        }
    });

    test("assigns every required manifest entry to a suite in its group", () => {
        for (const group of matrix.groups) {
            const covered = new Set(group.coveredManifestIds);
            assert.equal(covered.size, group.coveredManifestIds.length, \`\${group.id} has duplicate covered manifest IDs\`);

            for (const id of group.requiredManifestIds) {
                assert.ok(covered.has(id), \`\${group.id} does not cover \${id}\`);
            }

            assert.equal(group.summary.totalRequiredManifestEntries, group.requiredManifestIds.length);
            assert.equal(group.summary.totalCoveredManifestEntries, group.coveredManifestIds.length);
        }
    });

    test("each suite lists existing test files and concrete manifest IDs", () => {
        for (const group of matrix.groups) {
            for (const suite of group.suites) {
                assert.ok(suite.id, \`\${group.id} has suite without id\`);
                assert.ok(Array.isArray(suite.testFiles) && suite.testFiles.length > 0, \`\${group.id}:\${suite.id} has no test files\`);
                assert.ok(Array.isArray(suite.manifestIds) && suite.manifestIds.length > 0, \`\${group.id}:\${suite.id} has no manifest IDs\`);

                for (const file of suite.testFiles) {
                    assert.ok(fs.existsSync(path.join(repoRoot, file)), \`\${group.id}:\${suite.id} references missing test file \${file}\`);
                }

                for (const id of suite.manifestIds) {
                    const entry = entryById.get(id);
                    assert.ok(entry, \`\${group.id}:\${suite.id} references unknown manifest id \${id}\`);
                    assert.ok(group.requiredTestTiers.includes(entry.coverage?.testTier), \`\${group.id}:\${suite.id} covers \${id} outside required tiers\`);
                }
            }
        }
    });
});
`;
}

function main() {
    const args = process.argv.slice(2);
    const repoRoot = path.resolve(optionValue(args, "--repo-root", path.join(__dirname, "..", "..")));
    const manifestPath = path.resolve(repoRoot, optionValue(args, "--manifest", DEFAULT_MANIFEST_PATH));
    const policyPath = path.resolve(repoRoot, optionValue(args, "--policy", DEFAULT_SUITE_POLICY_PATH));
    const matrixPath = path.resolve(repoRoot, optionValue(args, "--output", DEFAULT_SUITE_MATRIX_PATH));
    const testPath = path.resolve(repoRoot, optionValue(args, "--test-output", DEFAULT_SUITE_TEST_PATH));
    const group = optionValue(args, "--group", undefined);
    const check = args.includes("--check");
    const manifest = readJson(manifestPath);
    const policy = readJson(policyPath);
    const errors = validatePolicy(policy, manifest, repoRoot);

    if (group && !(policy.groups || []).some((candidate) => candidate.id === group)) {
        errors.push(`unknown suite coverage group: ${group}`);
    }

    if (errors.length) {
        console.error(errors.map((error) => `- ${error}`).join("\n"));
        process.exitCode = 1;
        return;
    }

    const matrix = buildSuiteCoverage(manifest, policy);
    const expectedMatrix = serialize(matrix);
    const expectedTest = generatedTestSource();

    if (check) {
        const staleErrors = [];
        if (!fs.existsSync(matrixPath) || fs.readFileSync(matrixPath, "utf8") !== expectedMatrix)
            staleErrors.push(`${path.relative(repoRoot, matrixPath)} is stale. Run npm run generate:suite-coverage.`);
        if (!fs.existsSync(testPath) || fs.readFileSync(testPath, "utf8") !== expectedTest)
            staleErrors.push(`${path.relative(repoRoot, testPath)} is stale. Run npm run generate:suite-coverage.`);

        if (staleErrors.length) {
            console.error(staleErrors.map((error) => `- ${error}`).join("\n"));
            process.exitCode = 1;
            return;
        }

        const selected = group ? matrix.groups.find((candidate) => candidate.id === group) : undefined;
        const suffix = selected ? ` (${selected.summary.totalCoveredManifestEntries}/${selected.summary.totalRequiredManifestEntries} ${group} entries)` : "";
        process.stdout.write(`Generated suite coverage verified${suffix}\n`);
        return;
    }

    fs.mkdirSync(path.dirname(matrixPath), { recursive: true });
    fs.writeFileSync(matrixPath, expectedMatrix);
    fs.writeFileSync(testPath, expectedTest);
    process.stdout.write(
        `Wrote generated suite coverage to ${path.relative(repoRoot, matrixPath)} and ${path.relative(repoRoot, testPath)} (${matrix.summary.totalSuites} suites)\n`,
    );
}

main();
