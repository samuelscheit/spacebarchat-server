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

    test("groups read and modifying methods into their configured method buckets", async () => {
        const readBucket = "rate-limit-read-method-group";
        const readMiddleware = rateLimit({ bucket: readBucket, count: 10, window: 60, GET: 1, onlyIp: true });

        await run(readMiddleware, "GET", readBucket);
        const blockedHead = await run(readMiddleware, "HEAD", readBucket);

        assert.equal(blockedHead.nextCalled, false);
        assert.equal(blockedHead.res.statusCode, 429);
        assert.equal(blockedHead.res.headers["X-RateLimit-Bucket"], `${readBucket}:GET`);

        const modifyBucket = "rate-limit-modify-method-group";
        const modifyMiddleware = rateLimit({ bucket: modifyBucket, count: 10, window: 60, MODIFY: 1, onlyIp: true });

        await run(modifyMiddleware, "POST", modifyBucket);
        const blockedPatch = await run(modifyMiddleware, "PATCH", modifyBucket);

        assert.equal(blockedPatch.nextCalled, false);
        assert.equal(blockedPatch.res.statusCode, 429);
        assert.equal(blockedPatch.res.headers["X-RateLimit-Bucket"], `${modifyBucket}:MODIFY`);
    });

    test("keeps method-specific hits out of the default bucket", async () => {
        const bucket = "rate-limit-method-default-isolation";
        const middleware = rateLimit({ bucket, count: 1, window: 60, GET: 1, onlyIp: true });

        await run(middleware, "GET", bucket);
        const firstPost = await run(middleware, "POST", bucket);
        const blockedPost = await run(middleware, "POST", bucket);

        assert.equal(firstPost.nextCalled, true);
        assert.equal(firstPost.res.headers["X-RateLimit-Limit"], "1");
        assert.equal(firstPost.res.headers["X-RateLimit-Bucket"], bucket);

        assert.equal(blockedPost.nextCalled, false);
        assert.equal(blockedPost.res.statusCode, 429);
        assert.equal(blockedPost.res.headers["X-RateLimit-Bucket"], bucket);
    });

    test("uses the existing shared bucket when no method-specific limit is configured", async () => {
        const bucket = "rate-limit-default-shared-bucket";
        const middleware = rateLimit({ bucket, count: 1, window: 60, onlyIp: true });

        await run(middleware, "GET", bucket);
        const blockedPost = await run(middleware, "POST", bucket);

        assert.equal(blockedPost.nextCalled, false);
        assert.equal(blockedPost.res.statusCode, 429);
        assert.equal(blockedPost.res.headers["X-RateLimit-Bucket"], bucket);
    });
});
