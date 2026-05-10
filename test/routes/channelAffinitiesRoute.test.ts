import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { describe, test } from "node:test";
import express from "express";
import channelAffinitiesRouter from "../../src/api/routes/users/@me/affinities/channels";

describe("GET /users/@me/affinities/channels", () => {
    test("returns the Discord-compatible empty channel affinities payload", async () => {
        const app = express();
        app.use("/users/@me/affinities/channels", channelAffinitiesRouter);

        const { server, baseUrl } = await listen(app);
        try {
            const response = await fetch(`${baseUrl}/users/@me/affinities/channels`);

            assert.equal(response.status, 200);
            assert.deepEqual(await response.json(), { channel_affinities: [] });
        } finally {
            await close(server);
        }
    });

    test("does not keep a stale implementation TODO", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "users", "@me", "affinities", "channels.ts"), "utf-8");

        assert.doesNotMatch(routeSource, /TODO/);
    });
});

async function listen(app: express.Express) {
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.once("listening", () => resolve());
    });

    const address = server.address();
    assert(address && typeof address === "object");

    return {
        server,
        baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}`,
    };
}

async function close(server: Server) {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}
