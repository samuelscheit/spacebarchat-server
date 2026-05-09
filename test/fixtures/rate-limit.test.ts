import assert from "node:assert/strict";
import { test } from "node:test";
import { Rights } from "@spacebar/util";
import type { NextFunction, Request, Response } from "express";
import rateLimit from "../../src/api/middlewares/RateLimit";

test("rate limit bypass uses rights already hydrated on the request", async () => {
    const middleware = rateLimit({
        bucket: "fixture-rate-limit-bypass",
        window: 60,
        count: 1,
    });
    const headers = new Map<string, string>();
    const req = {
        user_id: "fixture-user",
        user_bot: false,
        rights: new Rights(Rights.FLAGS.BYPASS_RATE_LIMITS),
        ip: "127.0.0.1",
        originalUrl: "/api/v9/fixture",
        method: "GET",
    } as Request;
    const res = {
        set(name: string, value: string) {
            headers.set(name, value);
            return this;
        },
    } as Response;
    let nextCalls = 0;

    await middleware(req, res, ((error?: unknown) => {
        assert.equal(error, undefined);
        nextCalls++;
    }) as NextFunction);

    assert.equal(nextCalls, 1);
    assert.equal(headers.size, 0);
});
