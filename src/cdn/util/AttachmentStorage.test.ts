import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Storage } from "./Storage";
import { attachmentStoragePath, deleteStoragePathIfExists, getAttachmentFileFromStorage, legacyAttachmentStoragePath } from "./AttachmentStorage";

class MemoryStorage implements Storage {
    files = new Map<string, Buffer>();
    moveHandler?: (path: string, newPath: string) => Promise<void>;

    async set(path: string, data: Buffer) {
        this.files.set(path, data);
    }

    async clone(path: string, newPath: string) {
        const file = this.files.get(path);
        if (!file) throw new Error("missing file");
        this.files.set(newPath, file);
    }

    async get(path: string) {
        return this.files.get(path) ?? null;
    }

    async delete(path: string) {
        this.files.delete(path);
    }

    async exists(path: string) {
        return this.files.has(path);
    }

    async isFile(path: string) {
        return this.files.has(path);
    }

    async move(path: string, newPath: string) {
        if (this.moveHandler) return this.moveHandler(path, newPath);

        const file = this.files.get(path);
        if (!file) throw new Error("missing file");
        this.files.set(newPath, file);
        this.files.delete(path);
    }
}

describe("attachment storage paths", () => {
    it("uses message ids for current attachment storage paths", () => {
        assert.equal(
            attachmentStoragePath({
                channelId: "channel",
                messageId: "message",
                filename: "file.png",
            }),
            "attachments/channel/message/file.png",
        );
    });

    it("can address the legacy attachment-id storage layout", () => {
        assert.equal(
            legacyAttachmentStoragePath({
                channelId: "channel",
                attachmentId: "attachment",
                filename: "file.png",
            }),
            "attachments/channel/attachment/file.png",
        );
    });

    it("serves the current message-id path before looking up legacy rows", async () => {
        const storage = new MemoryStorage();
        const file = Buffer.from("current");
        await storage.set("attachments/channel/message/file.png", file);

        const result = await getAttachmentFileFromStorage({
            storage,
            channelId: "channel",
            messageId: "message",
            filename: "file.png",
            findAttachment: async () => {
                throw new Error("legacy lookup should not run");
            },
        });

        assert.deepEqual(result, file);
    });

    it("finds and moves legacy attachment-id files through the database row", async () => {
        const storage = new MemoryStorage();
        const file = Buffer.from("legacy");
        await storage.set("attachments/channel/attachment/file.png", file);

        const result = await getAttachmentFileFromStorage({
            storage,
            channelId: "channel",
            messageId: "message",
            filename: "file.png",
            findAttachment: async () => ({ id: "attachment" }),
        });

        assert.deepEqual(result, file);
        assert.equal(await storage.exists("attachments/channel/attachment/file.png"), false);
        assert.equal(await storage.exists("attachments/channel/message/file.png"), true);
    });

    it("does not migrate legacy files without a matching database row", async () => {
        const storage = new MemoryStorage();
        await storage.set("attachments/channel/attachment/file.png", Buffer.from("legacy"));

        const result = await getAttachmentFileFromStorage({
            storage,
            channelId: "channel",
            messageId: "message",
            filename: "file.png",
            findAttachment: async () => null,
        });

        assert.equal(result, null);
        assert.equal(await storage.exists("attachments/channel/attachment/file.png"), true);
        assert.equal(await storage.exists("attachments/channel/message/file.png"), false);
    });

    it("returns null when the matching legacy file is missing", async () => {
        const storage = new MemoryStorage();

        const result = await getAttachmentFileFromStorage({
            storage,
            channelId: "channel",
            messageId: "message",
            filename: "file.png",
            findAttachment: async () => ({ id: "attachment" }),
        });

        assert.equal(result, null);
    });

    it("deletes storage paths idempotently for post-commit cleanup", async () => {
        const storage = new MemoryStorage();
        await storage.set("attachments/channel/message/file.png", Buffer.from("delete me"));

        assert.equal(await deleteStoragePathIfExists(storage, "attachments/channel/message/file.png"), true);
        assert.equal(await storage.exists("attachments/channel/message/file.png"), false);
        assert.equal(await deleteStoragePathIfExists(storage, "attachments/channel/message/file.png"), false);
    });

    it("re-reads the current file when another migrator wins the legacy move race", async () => {
        const storage = new MemoryStorage();
        const file = Buffer.from("raced");
        await storage.set("attachments/channel/attachment/file.png", file);
        storage.moveHandler = async (path, newPath) => {
            const moved = storage.files.get(path);
            assert.deepEqual(moved, file);
            storage.files.delete(path);
            storage.files.set(newPath, file);
            throw new Error("legacy source disappeared");
        };

        const result = await getAttachmentFileFromStorage({
            storage,
            channelId: "channel",
            messageId: "message",
            filename: "file.png",
            findAttachment: async () => ({ id: "attachment" }),
        });

        assert.deepEqual(result, file);
        assert.equal(await storage.exists("attachments/channel/attachment/file.png"), false);
        assert.equal(await storage.exists("attachments/channel/message/file.png"), true);
    });
});
