import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { describe, test } from "node:test";
import { CDNServer } from "./Server";

describe("CDNServer.configureApp", () => {
    test("mounts public CDN routes without startup database initialization", async () => {
        const app = new CDNServer();
        await withoutStartupSideEffects(() => app.configureApp());

        const server = createServer(app.app);
        const port = await listen(server);

        try {
            const response = await fetch(`http://127.0.0.1:${port}/ping/`);
            assert.equal(response.status, 200);
            assert.equal(await response.text(), "pong");

            const avatar = await fetch(`http://127.0.0.1:${port}/embed/avatars/0.png`);
            assert.equal(avatar.status, 200);
            assert.equal(avatar.headers.get("content-type"), "image/png");
            await avatar.arrayBuffer();
        } finally {
            await close(server);
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
