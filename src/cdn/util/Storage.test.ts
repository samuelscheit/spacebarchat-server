import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { test } from "node:test";

const execFileAsync = promisify(execFile);

test("file storage startup is safe when another importer creates the storage directory first", async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), "spacebar-storage-startup-"));

    try {
        const script = `
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const storageRoot = path.resolve(process.env.STORAGE_LOCATION);
const existsSync = fs.existsSync;

fs.existsSync = (value) => {
    if (path.resolve(String(value)) === storageRoot) return false;
    return existsSync(value);
};

require("./dist/cdn/util/Storage.js");

assert.equal(process.env.STORAGE_LOCATION, storageRoot);
assert.equal(existsSync(storageRoot), true);
`;

        await execFileAsync(process.execPath, ["-e", script], {
            cwd: process.cwd(),
            env: {
                ...process.env,
                STORAGE_LOCATION: storageRoot,
                STORAGE_PROVIDER: "file",
            },
        });
    } finally {
        await rm(storageRoot, { recursive: true, force: true });
    }
});
