import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

test("file storage startup tolerates an existing storage directory", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "spacebar-storage-startup-"));

    try {
        const script = `
const assert = require("node:assert/strict");
require("./dist/cdn/util/Storage.js");
assert.equal(process.env.STORAGE_LOCATION, ${JSON.stringify(root)});
`;

        await execFileAsync(process.execPath, ["-r", "dotenv/config", "-r", "module-alias/register", "--enable-source-maps", "-e", script], {
            cwd: process.cwd(),
            env: {
                ...process.env,
                STORAGE_LOCATION: root,
                STORAGE_PROVIDER: "file",
            },
            maxBuffer: 1024 * 1024,
            timeout: 30_000,
        });
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
