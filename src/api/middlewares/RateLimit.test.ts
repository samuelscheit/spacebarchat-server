import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { describe, test } from "node:test";
import express, { type Request } from "express";
import rateLimit from "./RateLimit";

describe("rateLimit middleware", () => {
    test("tracks hits in memory and blocks after the configured limit", async () => {
        const app = express();
        app.use(rateLimit({ bucket: uniqueBucket("hits"), window: 60, count: 2 }));
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

    test("uses the default translated rate-limit message", async () => {
        const app = express();
        app.use(rateLimit({ bucket: uniqueBucket("default-message"), window: 60, count: 1 }));
        app.get("/limited", (_req, res) => res.json({ ok: true }));

        const server = createServer(app);
        const port = await listen(server);

        try {
            await request(port, "/limited");
            const response = await request(port, "/limited");

            assert.equal(response.status, 429);
            assert.equal(response.body.message, "You are being rate limited.");
        } finally {
            await close(server);
        }
    });

    test("uses request translation for blocked rate-limit responses", async () => {
        const app = express();
        app.use((req, _res, next) => {
            req.t = ((key: string) => (key === "common:ratelimit.MESSAGE" ? "Translated rate limit." : key)) as Request["t"];
            next();
        });
        app.use(rateLimit({ bucket: uniqueBucket("translated-message"), window: 60, count: 1 }));
        app.get("/limited", (_req, res) => res.json({ ok: true }));

        const server = createServer(app);
        const port = await listen(server);

        try {
            await request(port, "/limited");
            const response = await request(port, "/limited");

            assert.equal(response.status, 429);
            assert.equal(response.body.message, "Translated rate limit.");
            assert.equal(response.body.global, false);
            assert.equal(typeof response.body.retry_after, "number");
        } finally {
            await close(server);
        }
    });
});

function uniqueBucket(name: string) {
    return `unit-test-${name}-${Date.now()}-${Math.random()}`;
}

async function request(port: number, path: string) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`);

    return {
        status: response.status,
        body: (await response.json()) as Record<string, unknown>,
    };
}

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
