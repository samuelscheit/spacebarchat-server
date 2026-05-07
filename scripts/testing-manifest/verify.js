#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { DEFAULT_MANIFEST_PATH, DEFAULT_POLICY_PATH, generateManifest, serializeManifest, validateManifest } = require("./lib");

function optionValue(args, name, fallback) {
    const index = args.indexOf(name);
    if (index === -1) return fallback;
    return args[index + 1] || fallback;
}

function loadBenchmarkSuites(repoRoot) {
    const suiteDir = path.join(repoRoot, "benchmarks", "suites");
    return fs
        .readdirSync(suiteDir)
        .filter((file) => file.endsWith(".js"))
        .sort()
        .map((file) => ({
            file: path.join("benchmarks", "suites", file),
            suite: require(path.join(suiteDir, file)),
        }));
}

function validateBenchmarkSuites(repoRoot) {
    const errors = [];
    for (const { file, suite } of loadBenchmarkSuites(repoRoot)) {
        if (!suite || typeof suite !== "object") {
            errors.push(`${file} must export a benchmark suite object`);
            continue;
        }

        if (!suite.name || typeof suite.name !== "string") errors.push(`${file} is missing stable suite name`);
        if (!suite.tier || typeof suite.tier !== "object") errors.push(`${file} is missing tier metadata`);
        if (suite.tier) {
            if (!suite.tier.id || typeof suite.tier.id !== "string") errors.push(`${file} tier is missing id`);
            if (typeof suite.tier.default !== "boolean") errors.push(`${file} tier is missing boolean default`);
            if (!Array.isArray(suite.tier.requires)) errors.push(`${file} tier is missing requires array`);
            if (!Array.isArray(suite.tier.services)) errors.push(`${file} tier is missing services array`);
            if (suite.kind === "fullstack" && suite.tier.default !== false) errors.push(`${file} fullstack suite must not be in the default PR tier`);
            if (suite.kind === "fullstack" && !suite.tier.services.includes("postgres")) errors.push(`${file} fullstack suite must declare postgres service requirement`);
        }

        if (!suite.metrics || typeof suite.metrics !== "object") {
            errors.push(`${file} is missing metric declarations`);
        } else {
            for (const [metricId, metric] of Object.entries(suite.metrics)) {
                if (metric.direction !== "higher" && metric.direction !== "lower") errors.push(`${file} metric ${metricId} must declare direction higher/lower`);
                if (!Number.isFinite(Number(metric.regressionThreshold))) errors.push(`${file} metric ${metricId} must declare regressionThreshold`);
            }
        }
    }
    return errors;
}

function main() {
    const args = process.argv.slice(2);
    const repoRoot = path.resolve(optionValue(args, "--repo-root", path.join(__dirname, "..", "..")));
    const policyPath = path.resolve(repoRoot, optionValue(args, "--policy", DEFAULT_POLICY_PATH));
    const manifestPath = path.resolve(repoRoot, optionValue(args, "--manifest", DEFAULT_MANIFEST_PATH));
    const manifest = generateManifest(repoRoot, policyPath);
    const expected = serializeManifest(manifest);
    const errors = [...validateManifest(manifest, repoRoot), ...validateBenchmarkSuites(repoRoot)];

    if (!fs.existsSync(manifestPath)) {
        errors.push(`${path.relative(repoRoot, manifestPath)} does not exist. Run npm run generate:testing-manifest.`);
    } else {
        const actual = fs.readFileSync(manifestPath, "utf8");
        if (actual !== expected) errors.push(`${path.relative(repoRoot, manifestPath)} is stale. Run npm run generate:testing-manifest.`);
    }

    if (errors.length) {
        console.error(errors.map((error) => `- ${error}`).join("\n"));
        process.exitCode = 1;
        return;
    }

    process.stdout.write(`Testing manifest verified (${manifest.summary.totalEntries} entries)\n`);
}

main();
