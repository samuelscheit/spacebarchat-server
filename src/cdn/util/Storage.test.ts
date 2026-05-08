import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { ensureFileStorageDirectory } from "./Storage";

test("ensureFileStorageDirectory creates nested directories and tolerates existing storage directories", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "spacebar-storage-"));
    const storageRoot = path.join(root, "missing", "storage");

    try {
        ensureFileStorageDirectory(storageRoot);
        ensureFileStorageDirectory(storageRoot);

        assert.equal(fs.statSync(storageRoot).isDirectory(), true);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
