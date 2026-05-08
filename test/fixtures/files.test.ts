import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { createCdnObject, createUploadFile, withFileStorage } from "./files";

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

test("CDN storage bootstrap creates nested storage directories", async () => {
    await withFileStorage(async ({ root }) => {
        const storageLocation = join(root, "nested", "storage");
        const result = spawnSync(process.execPath, ["-r", "module-alias/register", "--enable-source-maps", "-e", "require('@spacebar/cdn')"], {
            cwd: process.cwd(),
            encoding: "utf8",
            env: {
                ...process.env,
                STORAGE_LOCATION: storageLocation,
            },
        });

        assert.equal(result.status, 0, result.stderr || result.stdout);
        assert.equal((await fs.stat(storageLocation)).isDirectory(), true);
    });
});
