import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { createCdnObject, createUploadFile, withFileStorage } from "./files";

const execFileAsync = promisify(execFile);

test("withFileStorage provides isolated file-backed CDN storage", async () => {
    const previousLocation = process.env.STORAGE_LOCATION;
    let fixtureRoot = "";

    await withFileStorage(async ({ root, storage }) => {
        fixtureRoot = root;
        const data = Buffer.from("cdn bytes");
        const object = await createCdnObject(storage, "avatars/user.png", data);

        assert.equal(process.env.STORAGE_LOCATION, root);
        assert.deepEqual(await storage.get(object.path), data);
        assert.equal((await fs.stat(object.fsPath)).isFile(), true);

        const upload = createUploadFile("avatar.png", "image/png", data);
        assert.equal(upload.size, data.length);
        assert.equal(upload.originalname, "avatar.png");
    });

    assert.equal(process.env.STORAGE_LOCATION, previousLocation);
    await assert.rejects(fs.stat(fixtureRoot));
});

test("file storage startup tolerates concurrent creation of the same root", async () => {
    const parent = await fs.mkdtemp(join(tmpdir(), "spacebar-cdn-startup-"));
    const root = join(parent, "files");
    const script = `
const assert = require("node:assert/strict");
const { initializeStorage, storage } = require("./dist/cdn");

(async () => {
    initializeStorage();
    assert.equal(await storage.exists("."), true);
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
`;

    try {
        await Promise.all(
            Array.from({ length: 8 }, () =>
                execFileAsync(process.execPath, ["-r", "dotenv/config", "-r", "module-alias/register", "--enable-source-maps", "-e", script], {
                    cwd: process.cwd(),
                    env: {
                        ...process.env,
                        LOG_ROUTES: "false",
                        STORAGE_LOCATION: root,
                        STORAGE_PROVIDER: "file",
                    },
                    timeout: 30_000,
                }),
            ),
        );

        assert.equal((await fs.stat(root)).isDirectory(), true);
    } finally {
        await fs.rm(parent, { force: true, recursive: true });
    }
});
