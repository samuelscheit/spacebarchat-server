import assert from "node:assert/strict";
import crypto from "node:crypto";
import fsp from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";
import { FileStorage } from "./FileStorage";

async function withStorageRoot(test: (root: string, storage: FileStorage) => Promise<void>) {
    const oldStorageLocation = process.env.STORAGE_LOCATION;
    const root = await fsp.mkdtemp(join(tmpdir(), "spacebar-file-storage-"));
    process.env.STORAGE_LOCATION = root;

    try {
        await test(root, new FileStorage());
    } finally {
        if (oldStorageLocation === undefined) delete process.env.STORAGE_LOCATION;
        else process.env.STORAGE_LOCATION = oldStorageLocation;

        await fsp.rm(root, { recursive: true, force: true });
    }
}

describe("FileStorage", () => {
    it("waits until direct file writes are durable before set resolves", async () => {
        await withStorageRoot(async (_root, storage) => {
            const key = "attachments/channel/message/file.bin";
            const data = crypto.randomBytes(8 * 1024 * 1024);

            await storage.set(key, data);

            const stat = await fsp.stat(storage.getFsPath(key));
            assert.equal(stat.size, data.length);
            assert.deepEqual(await storage.get(key), data);
        });
    });

    it("deletes empty parent directories under the storage root", async () => {
        await withStorageRoot(async (root, storage) => {
            const filePath = join(root, "attachments", "channel", "message", "file.txt");
            await fsp.mkdir(join(root, "attachments", "channel", "message"), { recursive: true });
            await fsp.writeFile(filePath, "data");

            await storage.delete("attachments/channel/message/file.txt");

            assert.equal(existsSync(filePath), false);
            assert.equal(existsSync(join(root, "attachments")), false);
            assert.equal(existsSync(root), true);
        });
    });

    it("keeps non-empty parent directories", async () => {
        await withStorageRoot(async (root, storage) => {
            const directory = join(root, "attachments", "channel", "message");
            await fsp.mkdir(directory, { recursive: true });
            await fsp.writeFile(join(directory, "deleted.txt"), "data");
            await fsp.writeFile(join(directory, "kept.txt"), "data");

            await storage.delete("attachments/channel/message/deleted.txt");

            assert.equal(existsSync(join(directory, "deleted.txt")), false);
            assert.equal(existsSync(join(directory, "kept.txt")), true);
            assert.equal(existsSync(directory), true);
        });
    });

    it("removes empty leaf directories while keeping non-empty ancestors", async () => {
        await withStorageRoot(async (root, storage) => {
            const directory = join(root, "attachments", "channel", "message");
            await fsp.mkdir(directory, { recursive: true });
            await fsp.writeFile(join(directory, "deleted.txt"), "data");
            await fsp.writeFile(join(root, "attachments", "channel", "kept.txt"), "data");

            await storage.delete("attachments/channel/message/deleted.txt");

            assert.equal(existsSync(join(directory, "deleted.txt")), false);
            assert.equal(existsSync(directory), false);
            assert.equal(existsSync(join(root, "attachments", "channel", "kept.txt")), true);
            assert.equal(existsSync(join(root, "attachments", "channel")), true);
        });
    });

    it("does not delete the storage root", async () => {
        await withStorageRoot(async (root, storage) => {
            await fsp.writeFile(join(root, "file.txt"), "data");

            await storage.delete("file.txt");

            assert.equal(existsSync(join(root, "file.txt")), false);
            assert.equal(existsSync(root), true);
        });
    });

    it("rejects paths that escape to storage-root sibling directories", async () => {
        await withStorageRoot(async (root, storage) => {
            const sibling = `${basename(root)}-escape`;

            assert.throws(() => storage.getFsPath(`../${sibling}/file.bin`), /invalid path/);
            assert.throws(() => storage.getFsPath(`nested/../../${sibling}/file.bin`), /invalid path/);
        });
    });

    it("rejects null bytes in storage paths", async () => {
        await withStorageRoot(async (_root, storage) => {
            assert.throws(() => storage.getFsPath("attachments/channel/message/\0file.bin"), /invalid path/);
        });
    });

    it("allows paths with leading-dot names that stay inside the storage root", async () => {
        await withStorageRoot(async (root, storage) => {
            assert.equal(storage.getFsPath("attachments/..visible-file.bin"), join(root, "attachments", "..visible-file.bin"));
        });
    });

    it("allows storage paths whose segment merely starts with dot-dot", async () => {
        await withStorageRoot(async (root, storage) => {
            const filePath = join(root, "..not-traversal", "file.txt");
            await fsp.mkdir(join(root, "..not-traversal"), { recursive: true });
            await fsp.writeFile(filePath, "data");

            assert.equal(storage.getFsPath("..not-traversal/file.txt"), filePath);

            await storage.delete("..not-traversal/file.txt");

            assert.equal(existsSync(filePath), false);
            assert.equal(existsSync(root), true);
        });
    });

    it("rejects paths outside the storage root", async () => {
        await withStorageRoot(async (_root, storage) => {
            assert.throws(() => storage.getFsPath("../outside.txt"), /invalid path/);
        });
    });
});
