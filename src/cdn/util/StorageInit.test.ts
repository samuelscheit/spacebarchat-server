import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fsp from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

test("file storage initialization uses idempotent directory creation", async () => {
    const repoRoot = process.cwd();
    const storageModule = path.join(repoRoot, "dist", "cdn", "util", "Storage.js");
    const cwd = await fsp.mkdtemp(path.join(tmpdir(), "spacebar-storage-init-"));
    const env = { ...process.env };
    delete env.STORAGE_LOCATION;
    delete env.STORAGE_PROVIDER;

    try {
        const result = await runNode(
            [
                "-e",
                `
const fs = require("node:fs");
let sawRecursiveMkdir = false;
fs.existsSync = () => false;
fs.mkdirSync = (_location, options) => {
\tif (options?.recursive === true) {
\t\tsawRecursiveMkdir = true;
\t\treturn undefined;
\t}

\tconst error = new Error("simulated EEXIST from concurrent storage initialization");
\terror.code = "EEXIST";
\tthrow error;
};
require(process.argv[1]);
if (!sawRecursiveMkdir) throw new Error("Storage initialization did not request recursive mkdir");
`,
                storageModule,
            ],
            { cwd, env },
        );

        assert.equal(result.status, 0, result.stderr || result.stdout);
    } finally {
        await fsp.rm(cwd, { recursive: true, force: true });
    }
});

function runNode(args: string[], options: { cwd: string; env: NodeJS.ProcessEnv }) {
    return new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve, reject) => {
        const child = spawn(process.execPath, args, {
            cwd: options.cwd,
            env: options.env,
            stdio: ["ignore", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";

        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", (chunk: string) => {
            stdout += chunk;
        });
        child.stderr.on("data", (chunk: string) => {
            stderr += chunk;
        });
        child.on("error", reject);
        child.on("close", (status) => resolve({ status, stdout, stderr }));
    });
}
