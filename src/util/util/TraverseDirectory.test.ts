import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { registerRoutes } from "./TraverseDirectory";

describe("route registration traversal", () => {
    test("does not register compiled test files as runtime routes", async () => {
        const root = await mkdtemp(path.join(os.tmpdir(), "spacebar-routes-"));

        try {
            await writeFile(path.join(root, "attachments.js"), "export default null;");
            await writeFile(path.join(root, "attachments.test.js"), "throw new Error('test file should not be registered');");
            await writeFile(path.join(root, "attachments.d.js"), "export default null;");
            await mkdir(path.join(root, "nested"));
            await writeFile(path.join(root, "nested", "cloud.js"), "export default null;");
            await writeFile(path.join(root, "nested", "cloud.test.js"), "throw new Error('nested test file should not be registered');");

            const registered: string[] = [];
            const server = {
                registerRoute(base: string, file: string) {
                    registered.push(path.relative(base, file));
                    return file;
                },
            };

            await registerRoutes(server as never, `${root}/`);

            assert.deepEqual(registered.sort(), ["attachments.js", path.join("nested", "cloud.js")]);
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });
});
