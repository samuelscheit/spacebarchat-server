import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { describe, test } from "node:test";
import express, { type Request } from "express";
import rateLimit from "./RateLimit";

describe("rateLimit middleware", () => {
    test("uses the default translated rate-limit message", async () => {
        const app = express();
        app.use(rateLimit({ bucket: "test-default", window: 60, count: 1 }));
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
        app.use(rateLimit({ bucket: "test-translated", window: 60, count: 1 }));
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
