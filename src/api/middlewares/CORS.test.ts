import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { NextFunction, Request, Response } from "express";
import { Config, ConfigValue } from "@spacebar/util";
import { CORS } from "./CORS";

type HeaderMap = Record<string, string>;

const accessControlHeaders = [
    "Access-Control-Allow-Credentials",
    "Access-Control-Allow-Origin",
    "Access-Control-Allow-Headers",
    "Access-Control-Allow-Methods",
    "Access-Control-Max-Age",
];

function runCors(config: ConfigValue, options: { method?: string; headers?: HeaderMap } = {}) {
    const originalConfigGet = Config.get;
    const requestHeaders = Object.fromEntries(Object.entries(options.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]));
    const responseHeaders = new Map<string, string>();
    let statusCode: number | undefined;
    let ended = false;
    let nextCalled = false;

    const req = {
        method: options.method ?? "GET",
        header(name: string) {
            return requestHeaders[name.toLowerCase()];
        },
    } as Request;

    const res = {
        set(name: string, value: string) {
            responseHeaders.set(name, value);
            return this;
        },
        status(code: number) {
            statusCode = code;
            return this;
        },
        end() {
            ended = true;
            return this;
        },
    } as Response;

    try {
        (Config as unknown as { get: () => ConfigValue }).get = () => config;
        CORS(req, res, (() => {
            nextCalled = true;
        }) as NextFunction);
    } finally {
        (Config as unknown as { get: typeof originalConfigGet }).get = originalConfigGet;
    }

    return { responseHeaders, statusCode, ended, nextCalled };
}

function assertNoCorsHeaders(responseHeaders: Map<string, string>) {
    for (const header of accessControlHeaders) {
        assert.equal(responseHeaders.has(header), false, `${header} should not be set`);
    }
}

describe("CORS middleware", () => {
    test("uses permissive defaults matching the historical reflected-origin behavior", () => {
        const config = new ConfigValue();

        const result = runCors(config, {
            headers: {
                Origin: "https://client.example",
                "Access-Control-Request-Headers": "authorization, content-type",
                "Access-Control-Request-Method": "PATCH",
            },
        });

        assert.equal(result.responseHeaders.get("Access-Control-Allow-Credentials"), "true");
        assert.equal(result.responseHeaders.get("Access-Control-Allow-Origin"), "https://client.example");
        assert.equal(result.responseHeaders.get("Access-Control-Allow-Headers"), "authorization, content-type");
        assert.equal(result.responseHeaders.get("Access-Control-Allow-Methods"), "PATCH");
        assert.equal(result.responseHeaders.get("Access-Control-Max-Age"), "60");
        assert.equal(result.nextCalled, true);
        assert.equal(result.ended, false);
    });

    test("falls back to wildcard defaults when no CORS request headers are present", () => {
        const config = new ConfigValue();

        const result = runCors(config);

        assert.equal(result.responseHeaders.get("Access-Control-Allow-Credentials"), "true");
        assert.equal(result.responseHeaders.get("Access-Control-Allow-Origin"), "*");
        assert.equal(result.responseHeaders.get("Access-Control-Allow-Headers"), "*");
        assert.equal(result.responseHeaders.get("Access-Control-Allow-Methods"), "*");
        assert.equal(result.responseHeaders.get("Access-Control-Max-Age"), "60");
        assert.equal(result.nextCalled, true);
        assert.equal(result.ended, false);
    });

    test("does not emit CORS headers when an explicit allow-list rejects the origin", () => {
        const config = new ConfigValue();
        config.cors.allowedOrigins = ["https://allowed.example"];

        const result = runCors(config, {
            headers: {
                Origin: "https://blocked.example",
                "Access-Control-Request-Headers": "authorization",
                "Access-Control-Request-Method": "POST",
            },
        });

        assertNoCorsHeaders(result.responseHeaders);
        assert.equal(result.nextCalled, true);
    });

    test("does not emit CORS headers when CORS is disabled", () => {
        const config = new ConfigValue();
        config.cors.enabled = false;

        const result = runCors(config, {
            headers: {
                Origin: "https://client.example",
                "Access-Control-Request-Headers": "authorization",
                "Access-Control-Request-Method": "POST",
            },
        });

        assertNoCorsHeaders(result.responseHeaders);
        assert.equal(result.responseHeaders.has("Content-security-policy"), true);
        assert.equal(result.nextCalled, true);
        assert.equal(result.ended, false);
    });

    test("uses configured CORS headers for allow-listed origins", () => {
        const config = new ConfigValue();
        config.cors.allowedOrigins = ["https://allowed.example"];
        config.cors.allowCredentials = false;
        config.cors.allowedHeaders = ["authorization", "content-type"];
        config.cors.allowedMethods = ["GET", "POST"];
        config.cors.maxAgeSeconds = 120;

        const result = runCors(config, {
            headers: {
                Origin: "https://allowed.example",
                "Access-Control-Request-Headers": "x-not-used",
                "Access-Control-Request-Method": "PATCH",
            },
        });

        assert.equal(result.responseHeaders.has("Access-Control-Allow-Credentials"), false);
        assert.equal(result.responseHeaders.get("Access-Control-Allow-Origin"), "https://allowed.example");
        assert.equal(result.responseHeaders.get("Access-Control-Allow-Headers"), "authorization, content-type");
        assert.equal(result.responseHeaders.get("Access-Control-Allow-Methods"), "GET, POST");
        assert.equal(result.responseHeaders.get("Access-Control-Max-Age"), "120");
    });

    test("terminates preflight requests without calling next", () => {
        const config = new ConfigValue();

        const result = runCors(config, {
            method: "OPTIONS",
            headers: {
                Origin: "https://client.example",
            },
        });

        assert.equal(result.statusCode, 204);
        assert.equal(result.ended, true);
        assert.equal(result.nextCalled, false);
    });

    test("terminates rejected preflight requests without emitting CORS headers", () => {
        const config = new ConfigValue();
        config.cors.allowedOrigins = ["https://allowed.example"];

        const result = runCors(config, {
            method: "OPTIONS",
            headers: {
                Origin: "https://blocked.example",
                "Access-Control-Request-Headers": "authorization",
                "Access-Control-Request-Method": "POST",
            },
        });

        assertNoCorsHeaders(result.responseHeaders);
        assert.equal(result.statusCode, 204);
        assert.equal(result.ended, true);
        assert.equal(result.nextCalled, false);
    });
});
