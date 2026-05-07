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

function main() {
    const args = process.argv.slice(2);
    const repoRoot = path.resolve(optionValue(args, "--repo-root", path.join(__dirname, "..", "..")));
    const policyPath = path.resolve(repoRoot, optionValue(args, "--policy", DEFAULT_POLICY_PATH));
    const outputPath = path.resolve(repoRoot, optionValue(args, "--output", DEFAULT_MANIFEST_PATH));

    const manifest = generateManifest(repoRoot, policyPath);
    const errors = validateManifest(manifest, repoRoot);
    if (errors.length) {
        console.error(errors.map((error) => `- ${error}`).join("\n"));
        process.exitCode = 1;
        return;
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, serializeManifest(manifest));
    process.stdout.write(`Wrote testing manifest to ${path.relative(repoRoot, outputPath)} (${manifest.summary.totalEntries} entries)\n`);
}

main();
