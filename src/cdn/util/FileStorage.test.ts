import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { FileStorage } from "./FileStorage";

const withStorage = async (callback: (storage: FileStorage, dir: string) => Promise<void>) => {
    const previousLocation = process.env.STORAGE_LOCATION;
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "spacebar-file-storage-test-"));
    process.env.STORAGE_LOCATION = dir;

    try {
        await callback(new FileStorage(), dir);
    } finally {
        if (previousLocation == null) delete process.env.STORAGE_LOCATION;
        else process.env.STORAGE_LOCATION = previousLocation;
        await fs.rm(dir, { force: true, recursive: true });
    }
};

describe("FileStorage", () => {
    it("waits until direct file writes are durable before set resolves", async () => {
        await withStorage(async (storage) => {
            const key = "attachments/channel/message/file.bin";
            const data = crypto.randomBytes(8 * 1024 * 1024);

            await storage.set(key, data);

            const stat = await fs.stat(storage.getFsPath(key));
            assert.equal(stat.size, data.length);
            assert.deepEqual(await storage.get(key), data);
        });
    });

    it("rejects paths that escape to storage-root sibling directories", async () => {
        await withStorage(async (storage, dir) => {
            const sibling = `${path.basename(dir)}-escape`;

            assert.throws(() => storage.getFsPath(`../${sibling}/file.bin`), /invalid path/);
            assert.throws(() => storage.getFsPath(`nested/../../${sibling}/file.bin`), /invalid path/);
        });
    });

    it("rejects null bytes in storage paths", async () => {
        await withStorage(async (storage) => {
            assert.throws(() => storage.getFsPath("attachments/channel/message/\0file.bin"), /invalid path/);
        });
    });

    it("allows paths with leading-dot names that stay inside the storage root", async () => {
        await withStorage(async (storage, dir) => {
            assert.equal(storage.getFsPath("attachments/..visible-file.bin"), path.join(dir, "attachments", "..visible-file.bin"));
        });
    });
});
