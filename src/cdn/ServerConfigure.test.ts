import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";
import { promisify } from "node:util";
import { CDNServer } from "@spacebar/cdn";

const execFileAsync = promisify(execFile);

describe("CDNServer.configureApp", () => {
    test("mounts public CDN routes without startup database initialization", async () => {
        const app = new CDNServer();
        await withoutStartupSideEffects(() => app.configureApp());

        const server = createServer(app.app);
        const port = await listen(server);

        try {
            const avatar = await fetch(`http://127.0.0.1:${port}/embed/avatars/0.png`);
            assert.equal(avatar.status, 200);
            assert.equal(avatar.headers.get("content-type"), "image/png");
            await avatar.arrayBuffer();
        } finally {
            await close(server);
        }
    });

    test("initializes shared file storage safely when services import CDN concurrently", async () => {
        const root = await mkdtemp(path.join(tmpdir(), "spacebar-cdn-storage-race-"));
        const storageRoot = path.join(root, "files");

        try {
            await Promise.all(Array.from({ length: 4 }, () => runFileStorageStartup(storageRoot)));
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });
});

async function listen(server: Server) {
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address();
    assert(address && typeof address === "object");
    return address.port;
}

async function close(server: Server) {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}

async function withoutStartupSideEffects<T>(task: () => Promise<T>) {
    const previousLogRoutes = process.env.LOG_ROUTES;
    const previousDatabase = process.env.DATABASE;
    const previousConfigPath = process.env.CONFIG_PATH;
    process.env.LOG_ROUTES = "false";
    delete process.env.DATABASE;
    delete process.env.CONFIG_PATH;

    try {
        return await task();
    } finally {
        if (previousLogRoutes === undefined) delete process.env.LOG_ROUTES;
        else process.env.LOG_ROUTES = previousLogRoutes;
        if (previousDatabase === undefined) delete process.env.DATABASE;
        else process.env.DATABASE = previousDatabase;
        if (previousConfigPath === undefined) delete process.env.CONFIG_PATH;
        else process.env.CONFIG_PATH = previousConfigPath;
    }
}

async function runFileStorageStartup(storageRoot: string) {
    const script = `
const assert = require("node:assert/strict");
const path = require("node:path");
const { storage } = require("./dist/cdn");

(async () => {
    assert.equal(process.env.STORAGE_LOCATION, path.resolve(${JSON.stringify(storageRoot)}));
    assert.equal(await storage.exists("."), true);
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
`;

    try {
        await execFileAsync(process.execPath, ["-r", "dotenv/config", "-r", "module-alias/register", "--enable-source-maps", "-e", script], {
            cwd: process.cwd(),
            env: {
                ...process.env,
                LOG_ROUTES: "false",
                STORAGE_LOCATION: storageRoot,
                STORAGE_PROVIDER: "file",
            },
            maxBuffer: 10 * 1024 * 1024,
            timeout: 60_000,
        });
    } catch (error) {
        assert.fail(`File storage startup child process failed\n${childProcessErrorDetails(error)}`);
    }
}

function childProcessErrorDetails(error: unknown) {
    if (typeof error !== "object" || error === null) return String(error);
    const details = error as { message?: string; stdout?: string; stderr?: string };
    return [details.message, details.stdout, details.stderr].filter(Boolean).join("\n");
}
