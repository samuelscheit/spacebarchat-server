"use strict";

const fs = require("node:fs");
const path = require("node:path");

const NODE_MODULES_PREFIX = "node_modules/";
const WORKSPACE_PREFIXES = ["apps/", "packages/"];

function toPosix(value) {
    return value.split(path.sep).join(path.posix.sep);
}

function isSafeRelativePosix(value) {
    if (!value || path.posix.isAbsolute(value)) return false;
    const normalized = path.posix.normalize(value);
    return normalized !== "." && !normalized.startsWith("../") && normalized !== "..";
}

function isWorkspaceTarget(resolved) {
    if (typeof resolved !== "string" || !isSafeRelativePosix(resolved)) return false;
    const normalized = path.posix.normalize(resolved);
    return WORKSPACE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function packagePathToNodeModulesRelative(packagePath) {
    if (typeof packagePath !== "string" || !packagePath.startsWith(NODE_MODULES_PREFIX)) return undefined;

    const relativePath = packagePath.slice(NODE_MODULES_PREFIX.length);
    if (!isSafeRelativePosix(relativePath)) return undefined;

    return relativePath;
}

function workspaceNodeModuleLinks(packageLock) {
    const packages = packageLock?.packages;
    if (!packages || typeof packages !== "object") return [];

    return Object.entries(packages)
        .filter(([, metadata]) => metadata?.link === true && isWorkspaceTarget(metadata.resolved))
        .map(([packagePath]) => packagePathToNodeModulesRelative(packagePath))
        .filter(Boolean)
        .sort();
}

function isPathInside(parent, child) {
    const relative = path.relative(parent, child);
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function removeWorkspaceNodeModuleLinks({ packageLockPath = "package-lock.json", nodeModulesPath = "node_modules", log = () => {} } = {}) {
    const packageLock = JSON.parse(fs.readFileSync(packageLockPath, "utf8"));
    const absoluteNodeModules = path.resolve(nodeModulesPath);
    const removed = [];

    for (const relativeLinkPath of workspaceNodeModuleLinks(packageLock)) {
        const absoluteLinkPath = path.resolve(absoluteNodeModules, ...relativeLinkPath.split("/"));
        if (!isPathInside(absoluteNodeModules, absoluteLinkPath)) continue;

        const stat = fs.lstatSync(absoluteLinkPath, { throwIfNoEntry: false });
        if (!stat?.isSymbolicLink()) continue;

        fs.rmSync(absoluteLinkPath);
        removed.push(toPosix(path.relative(absoluteNodeModules, absoluteLinkPath)));
        log(`Removing npm workspace symlink: ${absoluteLinkPath}`);
    }

    return removed;
}

function parseArgs(argv) {
    const options = {};

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === "--package-lock") {
            options.packageLockPath = argv[++index];
        } else if (arg === "--node-modules") {
            options.nodeModulesPath = argv[++index];
        } else {
            throw new Error(`Unknown argument: ${arg}`);
        }
    }

    return options;
}

if (require.main === module) {
    removeWorkspaceNodeModuleLinks({ ...parseArgs(process.argv.slice(2)), log: console.log });
}

module.exports = {
    removeWorkspaceNodeModuleLinks,
    workspaceNodeModuleLinks,
};
