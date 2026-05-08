import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { ensureFileStorageDirectory } from "@spacebar/cdn";
import { createCdnObject, createUploadFile, withFileStorage } from "./files";

test("file storage directory initialization is idempotent", async () => {
    await withFileStorage(async ({ root }) => {
        const existingNestedDirectory = join(root, "already", "created");

        ensureFileStorageDirectory(existingNestedDirectory);

        assert.doesNotThrow(() => ensureFileStorageDirectory(existingNestedDirectory));
        assert.equal((await fs.stat(existingNestedDirectory)).isDirectory(), true);
    });
});

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
