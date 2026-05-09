import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { describe, test } from "node:test";
import express from "express";
import rateLimit from "./RateLimit";

describe("rateLimit middleware", () => {
    test("tracks hits in memory and blocks after the configured limit", async () => {
        const app = express();
        app.use(rateLimit({ bucket: `unit-test-${Date.now()}`, window: 60, count: 2 }));
        app.get("/limited", (_req, res) => res.json({ ok: true }));

        const server = createServer(app);
        const port = await listen(server);

        try {
            const first = await fetch(`http://127.0.0.1:${port}/limited`);
            const second = await fetch(`http://127.0.0.1:${port}/limited`);
            const third = await fetch(`http://127.0.0.1:${port}/limited`);

            assert.equal(first.status, 200);
            assert.equal(first.headers.get("x-ratelimit-bucket")?.startsWith("unit-test-"), true);
            assert.equal(second.status, 200);
            assert.equal(third.status, 429);
            assert.equal(third.headers.get("x-ratelimit-remaining"), "0");
            assert.deepEqual(await third.json(), {
                message: "You are being rate limited.",
                retry_after: 120,
                global: false,
            });
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
