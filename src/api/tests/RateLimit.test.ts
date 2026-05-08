import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { NextFunction, Request, Response } from "express";
import rateLimit from "../middlewares/RateLimit";

function request(method: string, bucket: string) {
    return {
        method,
        originalUrl: `/api/v9/${bucket}`,
        ip: "127.0.0.1",
    } as Request;
}

function response() {
    const res = {
        statusCode: 200,
        body: undefined as unknown,
        headers: {} as Record<string, string>,
        set(name: string, value: string) {
            this.headers[name] = value;
            return this;
        },
        status(code: number) {
            this.statusCode = code;
            return this;
        },
        send(body: unknown) {
            this.body = body;
            return this;
        },
        once() {
            return this;
        },
    };

    return res as Response & typeof res;
}

async function run(middleware: ReturnType<typeof rateLimit>, method: string, bucket: string) {
    const res = response();
    let nextCalled = false;

    await middleware(request(method, bucket), res, (() => {
        nextCalled = true;
    }) as NextFunction);

    return { res, nextCalled };
}

describe("rateLimit", () => {
    test("keeps read and modify method limits in independent buckets", async () => {
        const bucket = "rate-limit-method-buckets";
        const middleware = rateLimit({ bucket, count: 10, window: 60, GET: 1, MODIFY: 1, onlyIp: true });

        const firstGet = await run(middleware, "GET", bucket);
        const firstPost = await run(middleware, "POST", bucket);

        assert.equal(firstGet.nextCalled, true);
        assert.equal(firstGet.res.headers["X-RateLimit-Limit"], "1");
        assert.equal(firstGet.res.headers["X-RateLimit-Bucket"], `${bucket}:GET`);

        assert.equal(firstPost.nextCalled, true);
        assert.equal(firstPost.res.statusCode, 200);
        assert.equal(firstPost.res.headers["X-RateLimit-Limit"], "1");
        assert.equal(firstPost.res.headers["X-RateLimit-Bucket"], `${bucket}:MODIFY`);
    });

    test("blocks repeated requests per method-specific bucket", async () => {
        const bucket = "rate-limit-method-blocking";
        const middleware = rateLimit({ bucket, count: 10, window: 60, GET: 1, MODIFY: 1, onlyIp: true });

        await run(middleware, "GET", bucket);
        const blockedGet = await run(middleware, "GET", bucket);
        await run(middleware, "POST", bucket);
        const blockedPost = await run(middleware, "POST", bucket);

        assert.equal(blockedGet.nextCalled, false);
        assert.equal(blockedGet.res.statusCode, 429);
        assert.equal(blockedGet.res.headers["X-RateLimit-Bucket"], `${bucket}:GET`);

        assert.equal(blockedPost.nextCalled, false);
        assert.equal(blockedPost.res.statusCode, 429);
        assert.equal(blockedPost.res.headers["X-RateLimit-Bucket"], `${bucket}:MODIFY`);
    });
});
