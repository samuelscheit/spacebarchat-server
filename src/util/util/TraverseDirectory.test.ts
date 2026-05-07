import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Server } from "lambert-server";
import { registerRoutes } from "./TraverseDirectory";

describe("registerRoutes", () => {
    test("keeps nested underscore directories in registered route paths", async () => {
        const root = await mkdtemp(path.join(os.tmpdir(), "spacebar-routes-"));
        try {
            const routeDir = path.join(root, "_spacebar", "cdn");
            await mkdir(routeDir, { recursive: true });
            await writeFile(path.join(routeDir, "attachments.js"), `module.exports = function router() {};\n`);

            const server = new Server({ serverInitLogging: false });
            const registeredPaths: string[] = [];
            (server.app as unknown as { use: (routePath: string, router: unknown) => unknown }).use = (routePath: string) => {
                registeredPaths.push(routePath);
                return server.app;
            };

            await registerRoutes(server, `${root}${path.sep}`);

            assert.deepEqual(registeredPaths, ["/_spacebar/cdn/attachments"]);
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });

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
