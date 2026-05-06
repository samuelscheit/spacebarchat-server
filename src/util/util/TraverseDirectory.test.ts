import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Server } from "lambert-server";
import { registerRoutes } from "./TraverseDirectory";

describe("registerRoutes", () => {
    it("should skip test and spec files when auto-registering routes", async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), "spacebar-routes-"));
        const routesRoot = `${root}${path.sep}`;
        const registeredFiles: string[] = [];
        const server = {
            registerRoute: (_root: string, file: string) => {
                registeredFiles.push(path.basename(file));
            },
        } as unknown as Server;

        try {
            await Promise.all([
                fs.writeFile(path.join(root, "index.js"), "module.exports = {};"),
                fs.writeFile(path.join(root, "mentions.test.js"), "throw new Error('test file loaded as route');"),
                fs.writeFile(path.join(root, "mentions.spec.js"), "throw new Error('spec file loaded as route');"),
                fs.writeFile(path.join(root, "types.d.js"), "throw new Error('declaration file loaded as route');"),
            ]);

            await registerRoutes(server, routesRoot);

            assert.deepEqual(registeredFiles, ["index.js"]);
        } finally {
            await fs.rm(root, { recursive: true, force: true });
        }
    });
});
