import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { describe, test } from "node:test";
import { getS3CopySource, S3Storage } from "./S3Storage";

class FakeS3Client {
    calls: { method: string; input: unknown }[] = [];
    getObjectBody: unknown = Readable.from(Buffer.from("stored object"));
    headObjectError: unknown;

    async putObject(input: unknown) {
        this.calls.push({ method: "putObject", input });
    }

    async copyObject(input: unknown) {
        this.calls.push({ method: "copyObject", input });
    }

    async getObject(input: unknown) {
        this.calls.push({ method: "getObject", input });
        return { Body: this.getObjectBody };
    }

    async deleteObject(input: unknown) {
        this.calls.push({ method: "deleteObject", input });
    }

    async headObject(input: unknown) {
        this.calls.push({ method: "headObject", input });
        if (this.headObjectError) throw this.headObjectError;
    }
}

const createStorage = (client: FakeS3Client, basePath = "cdn-root/") => new S3Storage("test-region", "assets-bucket", "https://s3.example.test", true, basePath, client);

describe("getS3CopySource", () => {
    test("preserves slash path separators", () => {
        assert.equal(getS3CopySource("bucket", "base/attachments/channel/message/file.png"), "bucket/base/attachments/channel/message/file.png");
    });

    test("encodes characters that are unsafe in the x-amz-copy-source header", () => {
        assert.equal(getS3CopySource("bucket.with.dots", "prefix/file name #1?.png"), "bucket.with.dots/prefix/file%20name%20%231%3F.png");
    });

    test("encodes unicode object key segments", () => {
        assert.equal(getS3CopySource("bucket", "avatars/üñî/文件.png"), "bucket/avatars/%C3%BC%C3%B1%C3%AE/%E6%96%87%E4%BB%B6.png");
    });

    test("encodes percent signs from literal object keys", () => {
        assert.equal(getS3CopySource("bucket", "prefix/a%20b.png"), "bucket/prefix/a%2520b.png");
    });
});

describe("S3Storage", () => {
    test("builds URL-encoded CopyObject sources and raw destination keys with the configured base path", async () => {
        const client = new FakeS3Client();
        const storage = createStorage(client, "tenant uploads/");

        await storage.clone("avatars/user 1/hash#v1.png", "avatars/user 1/hash#v2.png");

        assert.deepEqual(client.calls, [
            {
                method: "copyObject",
                input: {
                    Bucket: "assets-bucket",
                    CopySource: "assets-bucket/tenant%20uploads/avatars/user%201/hash%23v1.png",
                    Key: "tenant uploads/avatars/user 1/hash#v2.png",
                },
            },
        ]);
    });

    test("uses the same base path key construction for object operations", async () => {
        const client = new FakeS3Client();
        const storage = createStorage(client);
        const data = Buffer.from("new object");

        await storage.set("attachments/channel/file.txt", data);
        assert.deepEqual(await storage.get("attachments/channel/file.txt"), Buffer.from("stored object"));
        await storage.delete("attachments/channel/file.txt");
        assert.equal(await storage.exists("attachments/channel/file.txt"), true);

        assert.deepEqual(client.calls, [
            {
                method: "putObject",
                input: {
                    Bucket: "assets-bucket",
                    Key: "cdn-root/attachments/channel/file.txt",
                    Body: data,
                },
            },
            {
                method: "getObject",
                input: {
                    Bucket: "assets-bucket",
                    Key: "cdn-root/attachments/channel/file.txt",
                },
            },
            {
                method: "deleteObject",
                input: {
                    Bucket: "assets-bucket",
                    Key: "cdn-root/attachments/channel/file.txt",
                },
            },
            {
                method: "headObject",
                input: {
                    Bucket: "assets-bucket",
                    Key: "cdn-root/attachments/channel/file.txt",
                },
            },
        ]);
    });

    test("reports NotFound headObject errors as missing objects", async () => {
        const client = new FakeS3Client();
        client.headObjectError = Object.assign(new Error("not found"), { name: "NotFound" });
        const storage = createStorage(client);

        assert.equal(await storage.exists("missing.png"), false);
    });
});
