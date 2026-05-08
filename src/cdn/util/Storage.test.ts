import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";
import { initializeStorage, storage } from "./Storage";

describe("CDN storage initialization", () => {
    test("defers file storage setup until explicit startup initialization", async () => {
        const previousProvider = process.env.STORAGE_PROVIDER;
        const previousLocation = process.env.STORAGE_LOCATION;
        const tempRoot = await mkdtemp(path.join(os.tmpdir(), "spacebar-storage-init-"));
        const relativeLocation = path.relative(process.cwd(), path.join(tempRoot, "cdn-files"));
        const expectedLocation = path.resolve(relativeLocation);

        process.env.STORAGE_PROVIDER = "file";
        process.env.STORAGE_LOCATION = relativeLocation;

        try {
            assert.equal(existsSync(expectedLocation), false);
            assert.equal(process.env.STORAGE_LOCATION, relativeLocation);

            assert.throws(() => storage.exists("example"), /CDN storage has not been initialized/);

            const first = initializeStorage();
            assert.equal(existsSync(expectedLocation), true);
            assert.equal(process.env.STORAGE_LOCATION, expectedLocation);
            assert.equal(initializeStorage(), first);

            await storage.set("example", Buffer.from("hello"));
            assert.deepEqual(await storage.get("example"), Buffer.from("hello"));
        } finally {
            if (previousProvider === undefined) delete process.env.STORAGE_PROVIDER;
            else process.env.STORAGE_PROVIDER = previousProvider;

            if (previousLocation === undefined) delete process.env.STORAGE_LOCATION;
            else process.env.STORAGE_LOCATION = previousLocation;

            await rm(tempRoot, { recursive: true, force: true });
        }
    });
});
