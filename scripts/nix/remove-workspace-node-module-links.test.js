"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { describe, test } = require("node:test");
const { removeWorkspaceNodeModuleLinks, workspaceNodeModuleLinks } = require("./remove-workspace-node-module-links.js");

function makeTempFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "spacebar-nix-workspace-links-"));
    const nodeModules = path.join(root, "node_modules");
    fs.mkdirSync(path.join(nodeModules, "@spacebar"), { recursive: true });
    fs.mkdirSync(path.join(root, "apps", "admin-dashboard"), { recursive: true });
    fs.mkdirSync(path.join(root, "packages", "automatic-reverse-engineering"), { recursive: true });
    fs.mkdirSync(path.join(root, "external"), { recursive: true });
    fs.mkdirSync(path.join(nodeModules, "normal-package"), { recursive: true });
    fs.mkdirSync(path.join(nodeModules, "@spacebar", "real-directory"), { recursive: true });

    fs.symlinkSync("../../apps/admin-dashboard", path.join(nodeModules, "@spacebar", "admin-dashboard"));
    fs.symlinkSync("../../packages/automatic-reverse-engineering", path.join(nodeModules, "@spacebar", "automatic-reverse-engineering"));
    fs.symlinkSync("../external", path.join(nodeModules, "external-link"));
    fs.symlinkSync("../external", path.join(nodeModules, "unlisted-link"));

    const packageLockPath = path.join(root, "package-lock.json");
    fs.writeFileSync(
        packageLockPath,
        JSON.stringify(
            {
                lockfileVersion: 3,
                packages: {
                    "": {
                        workspaces: ["apps/*", "packages/*"],
                    },
                    "node_modules/@spacebar/admin-dashboard": {
                        resolved: "apps/admin-dashboard",
                        link: true,
                    },
                    "node_modules/@spacebar/automatic-reverse-engineering": {
                        resolved: "packages/automatic-reverse-engineering",
                        link: true,
                    },
                    "node_modules/@spacebar/real-directory": {
                        resolved: "apps/real-directory",
                        link: true,
                    },
                    "node_modules/external-link": {
                        resolved: "../external",
                        link: true,
                    },
                    "node_modules/normal-package": {
                        version: "1.0.0",
                    },
                },
            },
            null,
            4,
        ),
    );

    return { nodeModules, packageLockPath, root };
}

function lstat(file) {
    return fs.lstatSync(file, { throwIfNoEntry: false });
}

describe("removeWorkspaceNodeModuleLinks", () => {
    test("detects only package-lock-declared workspace node_modules links", () => {
        const links = workspaceNodeModuleLinks({
            packages: {
                "node_modules/@spacebar/admin-dashboard": { resolved: "apps/admin-dashboard", link: true },
                "node_modules/@spacebar/automatic-reverse-engineering": { resolved: "packages/automatic-reverse-engineering", link: true },
                "node_modules/external-link": { resolved: "../external", link: true },
                "node_modules/not-a-link": { resolved: "apps/not-a-link" },
                "packages/automatic-reverse-engineering": { link: true },
            },
        });

        assert.deepEqual(links, ["@spacebar/admin-dashboard", "@spacebar/automatic-reverse-engineering"]);
    });

    test("removes workspace symlinks while preserving package directories and unrelated symlinks", () => {
        const { nodeModules, packageLockPath, root } = makeTempFixture();
        try {
            const messages = [];
            const removed = removeWorkspaceNodeModuleLinks({ packageLockPath, nodeModulesPath: nodeModules, log: (message) => messages.push(message) });

            assert.deepEqual(removed, ["@spacebar/admin-dashboard", "@spacebar/automatic-reverse-engineering"]);
            assert.equal(lstat(path.join(nodeModules, "@spacebar", "admin-dashboard")), undefined);
            assert.equal(lstat(path.join(nodeModules, "@spacebar", "automatic-reverse-engineering")), undefined);
            assert.equal(lstat(path.join(nodeModules, "@spacebar", "real-directory"))?.isDirectory(), true);
            assert.equal(lstat(path.join(nodeModules, "normal-package"))?.isDirectory(), true);
            assert.equal(lstat(path.join(nodeModules, "external-link"))?.isSymbolicLink(), true);
            assert.equal(lstat(path.join(nodeModules, "unlisted-link"))?.isSymbolicLink(), true);
            assert.equal(messages.length, 2);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    test("is idempotent and safe when declared links are missing", () => {
        const { nodeModules, packageLockPath, root } = makeTempFixture();
        try {
            assert.equal(removeWorkspaceNodeModuleLinks({ packageLockPath, nodeModulesPath: nodeModules }).length, 2);
            assert.deepEqual(removeWorkspaceNodeModuleLinks({ packageLockPath, nodeModulesPath: nodeModules }), []);

            fs.rmSync(path.join(nodeModules, "@spacebar"), { recursive: true, force: true });
            assert.deepEqual(removeWorkspaceNodeModuleLinks({ packageLockPath, nodeModulesPath: nodeModules }), []);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});
