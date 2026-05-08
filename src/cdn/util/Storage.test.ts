import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";
import { initializeStorage, storage } from "./Storage";

describe("CDN storage initialization", () => {
    test("does not configure file storage while importing CDN or server modules", async () => {
        const tempRoot = await mkdtemp(path.join(os.tmpdir(), "spacebar-storage-import-"));
        const storageLocation = path.join(tempRoot, "cdn-files");

        try {
            const result = spawnSync(
                process.execPath,
                [
                    "-r",
                    "module-alias/register",
                    "-e",
                    `
                        const assert = require("node:assert/strict");
                        const { existsSync } = require("node:fs");
                        require("./dist/cdn");
                        require("./dist/api/Server");
                        require("./dist/cdn/Server");
                        assert.equal(existsSync(process.env.STORAGE_LOCATION), false);
                    `,
                ],
                {
                    cwd: process.cwd(),
                    env: {
                        ...process.env,
                        STORAGE_PROVIDER: "file",
                        STORAGE_LOCATION: storageLocation,
                    },
                    encoding: "utf8",
                },
            );

            assert.equal(result.status, 0, result.stderr || result.stdout);
            assert.equal(existsSync(storageLocation), false);
        } finally {
            await rm(tempRoot, { recursive: true, force: true });
        }
    });

    test("defers S3 provider validation until explicit startup initialization", () => {
        const result = spawnSync(
            process.execPath,
            [
                "-r",
                "module-alias/register",
                "-e",
                `
                    const assert = require("node:assert/strict");
                    const { initializeStorage } = require("./dist/cdn");
                    require("./dist/api/Server");
                    require("./dist/cdn/Server");
                    assert.throws(
                        () => initializeStorage(),
                        /AWS S3 SDK not installed|provide a region|provide a bucket/,
                    );
                `,
            ],
            {
                cwd: process.cwd(),
                env: {
                    ...process.env,
                    STORAGE_PROVIDER: "s3",
                    STORAGE_REGION: "",
                    STORAGE_BUCKET: "",
                },
                encoding: "utf8",
            },
        );

        assert.equal(result.status, 0, result.stderr || result.stdout);
    });

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

            await assert.rejects(storage.exists("example"), /CDN storage has not been initialized/);

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
