import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { describe, test } from "node:test";
import express, { type NextFunction, type Request, type Response } from "express";
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

    test("keeps read and modify method limits in independent buckets", async () => {
        const bucket = uniqueBucket("method-buckets");
        const middleware = rateLimit({ bucket, count: 10, window: 60, GET: 1, MODIFY: 1, onlyIp: true });

        const firstGet = await runMiddleware(middleware, "GET", bucket);
        const firstPost = await runMiddleware(middleware, "POST", bucket);

        assert.equal(firstGet.nextCalled, true);
        assert.equal(firstGet.res.headers["X-RateLimit-Limit"], "1");
        assert.equal(firstGet.res.headers["X-RateLimit-Bucket"], `${bucket}:GET`);

        assert.equal(firstPost.nextCalled, true);
        assert.equal(firstPost.res.statusCode, 200);
        assert.equal(firstPost.res.headers["X-RateLimit-Limit"], "1");
        assert.equal(firstPost.res.headers["X-RateLimit-Bucket"], `${bucket}:MODIFY`);
    });

    test("blocks repeated requests per method-specific bucket", async () => {
        const bucket = uniqueBucket("method-blocking");
        const middleware = rateLimit({ bucket, count: 10, window: 60, GET: 1, MODIFY: 1, onlyIp: true });

        await runMiddleware(middleware, "GET", bucket);
        const blockedGet = await runMiddleware(middleware, "GET", bucket);
        await runMiddleware(middleware, "POST", bucket);
        const blockedPost = await runMiddleware(middleware, "POST", bucket);

        assert.equal(blockedGet.nextCalled, false);
        assert.equal(blockedGet.res.statusCode, 429);
        assert.equal(blockedGet.res.headers["X-RateLimit-Bucket"], `${bucket}:GET`);
        assert.ok(blockedGet.res.body);
        assert.equal(blockedGet.res.body.message, "You are being rate limited.");

        assert.equal(blockedPost.nextCalled, false);
        assert.equal(blockedPost.res.statusCode, 429);
        assert.equal(blockedPost.res.headers["X-RateLimit-Bucket"], `${bucket}:MODIFY`);
        assert.ok(blockedPost.res.body);
        assert.equal(blockedPost.res.body.message, "You are being rate limited.");
    });

    test("groups read and modifying methods into their configured method buckets", async () => {
        const readBucket = uniqueBucket("read-method-group");
        const readMiddleware = rateLimit({ bucket: readBucket, count: 10, window: 60, GET: 1, onlyIp: true });

        await runMiddleware(readMiddleware, "GET", readBucket);
        const blockedHead = await runMiddleware(readMiddleware, "HEAD", readBucket);

        assert.equal(blockedHead.nextCalled, false);
        assert.equal(blockedHead.res.statusCode, 429);
        assert.equal(blockedHead.res.headers["X-RateLimit-Bucket"], `${readBucket}:GET`);

        const modifyBucket = uniqueBucket("modify-method-group");
        const modifyMiddleware = rateLimit({ bucket: modifyBucket, count: 10, window: 60, MODIFY: 1, onlyIp: true });

        await runMiddleware(modifyMiddleware, "POST", modifyBucket);
        const blockedPatch = await runMiddleware(modifyMiddleware, "PATCH", modifyBucket);

        assert.equal(blockedPatch.nextCalled, false);
        assert.equal(blockedPatch.res.statusCode, 429);
        assert.equal(blockedPatch.res.headers["X-RateLimit-Bucket"], `${modifyBucket}:MODIFY`);
    });

    test("keeps method-specific hits out of the default bucket", async () => {
        const bucket = uniqueBucket("method-default-isolation");
        const middleware = rateLimit({ bucket, count: 1, window: 60, GET: 1, onlyIp: true });

        await runMiddleware(middleware, "GET", bucket);
        const firstPost = await runMiddleware(middleware, "POST", bucket);
        const blockedPost = await runMiddleware(middleware, "POST", bucket);

        assert.equal(firstPost.nextCalled, true);
        assert.equal(firstPost.res.headers["X-RateLimit-Limit"], "1");
        assert.equal(firstPost.res.headers["X-RateLimit-Bucket"], bucket);

        assert.equal(blockedPost.nextCalled, false);
        assert.equal(blockedPost.res.statusCode, 429);
        assert.equal(blockedPost.res.headers["X-RateLimit-Bucket"], bucket);
    });

    test("uses the existing shared bucket when no method-specific limit is configured", async () => {
        const bucket = uniqueBucket("default-shared-bucket");
        const middleware = rateLimit({ bucket, count: 1, window: 60, onlyIp: true });

        await runMiddleware(middleware, "GET", bucket);
        const blockedPost = await runMiddleware(middleware, "POST", bucket);

        assert.equal(blockedPost.nextCalled, false);
        assert.equal(blockedPost.res.statusCode, 429);
        assert.equal(blockedPost.res.headers["X-RateLimit-Bucket"], bucket);
    });
});

function uniqueBucket(name: string) {
    return `unit-test-${name}-${Date.now()}-${Math.random()}`;
}

function mockRequest(method: string, bucket: string) {
    return {
        method,
        originalUrl: `/api/v9/${bucket}`,
        ip: "127.0.0.1",
    } as Request;
}

function mockResponse() {
    const res = {
        statusCode: 200,
        body: undefined as Record<string, unknown> | undefined,
        headers: {} as Record<string, string>,
        set(name: string, value: string) {
            this.headers[name] = value;
            return this;
        },
        status(code: number) {
            this.statusCode = code;
            return this;
        },
        send(body: Record<string, unknown>) {
            this.body = body;
            return this;
        },
        once() {
            return this;
        },
    };

    return res as Response & typeof res;
}

async function runMiddleware(middleware: ReturnType<typeof rateLimit>, method: string, bucket: string) {
    const res = mockResponse();
    let nextCalled = false;

    await middleware(mockRequest(method, bucket), res, (() => {
        nextCalled = true;
    }) as NextFunction);

    return { res, nextCalled };
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
