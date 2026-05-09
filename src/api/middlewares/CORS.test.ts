import assert from "node:assert/strict";
import http, { type Server } from "node:http";
import { AddressInfo } from "node:net";
import { describe, test } from "node:test";
import express, { type NextFunction, type Request, type Response } from "express";
import { Config, ConfigValue } from "@spacebar/util";
import { buildDefaultContentSecurityPolicy, CORS, getConfiguredContentSecurityPolicy } from "./CORS";

type HeaderMap = Record<string, string>;
type TestContext = { after(fn: () => void | Promise<void>): void };

const accessControlHeaders = [
    "Access-Control-Allow-Credentials",
    "Access-Control-Allow-Origin",
    "Access-Control-Allow-Headers",
    "Access-Control-Allow-Methods",
    "Access-Control-Max-Age",
];

function testConfig() {
    const config = new ConfigValue();
    config.admin.endpointPublic = "https://admin.spacebar.example/app";
    config.api.endpointPublic = "https://api.spacebar.example/api/v9";
    config.cdn.endpointPublic = "https://cdn.spacebar.example/assets";
    config.gateway.endpointPublic = "wss://gateway.spacebar.example";
    return config;
}

function runCors(config: ConfigValue, options: { method?: string; path?: string; headers?: HeaderMap } = {}) {
    const originalConfigGet = Config.get;
    const requestHeaders = Object.fromEntries(Object.entries(options.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]));
    const responseHeaders = new Map<string, string>();
    let statusCode: number | undefined;
    let ended = false;
    let nextCalled = false;

    const req = {
        method: options.method ?? "GET",
        path: options.path ?? "/api/test",
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

async function listen(server: Server) {
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address();
    assert(address && typeof address === "object");
    return (address as AddressInfo).port;
}

async function close(server: Server) {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}

function useConfig(t: TestContext, config: ConfigValue) {
    const originalGet = Config.get;
    (Config as unknown as { get: () => ConfigValue }).get = () => config;
    t.after(() => {
        (Config as unknown as { get: typeof originalGet }).get = originalGet;
    });
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
        assert.match(result.responseHeaders.get("Content-Security-Policy") ?? "", /default-src 'self'/);
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
        assert.match(result.responseHeaders.get("Content-Security-Policy") ?? "", /default-src 'self'/);
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
        assert.match(result.responseHeaders.get("Content-Security-Policy") ?? "", /default-src 'self'/);
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

describe("CORS middleware content security policy", () => {
    test("builds a scoped default CSP from configured public endpoints", () => {
        const policy = buildDefaultContentSecurityPolicy(testConfig());

        assert.match(policy, /default-src 'self'/);
        assert.match(policy, /object-src 'none'/);
        assert.match(policy, /base-uri 'self'/);
        assert.match(policy, /frame-ancestors 'self'/);
        assert.match(policy, /connect-src[^;]*https:\/\/api\.spacebar\.example/);
        assert.match(policy, /connect-src[^;]*https:\/\/cdn\.spacebar\.example/);
        assert.match(policy, /connect-src[^;]*wss:\/\/gateway\.spacebar\.example/);
        assert.match(policy, /img-src[^;]*https:\/\/cdn\.spacebar\.example/);
        assert.match(policy, /script-src[^;]*https:\/\/\*\.hcaptcha\.com/);
        assert.match(policy, /script-src[^;]*https:\/\/www\.google\.com\/recaptcha\//);
        assert.match(policy, /script-src[^;]*https:\/\/www\.gstatic\.com\/recaptcha\//);
        assert.match(policy, /connect-src[^;]*https:\/\/www\.google\.com\/recaptcha\//);
        assert.match(policy, /frame-src[^;]*https:\/\/recaptcha\.google\.com\/recaptcha\//);
        assert.match(policy, /style-src[^;]*https:\/\/fonts\.googleapis\.com/);
        assert.match(policy, /font-src[^;]*https:\/\/fonts\.gstatic\.com/);
        assert.doesNotMatch(policy, /default-src \*/);
        assert.doesNotMatch(policy, /script-src \*/);
        assert.doesNotMatch(policy, /'unsafe-eval'/);
        assert.doesNotMatch(policy, /filesystem:/);
        assert.doesNotMatch(policy, /about:/);
    });

    test("normalizes configured endpoint URLs before using them as CSP sources", () => {
        const config = testConfig();
        config.api.endpointPublic = "https://api.spacebar.example/api/v9?redirect=https://evil.example;script-src *";
        config.cdn.endpointPublic = "https://cdn.spacebar.example/assets#fragment";
        config.gateway.endpointPublic = "wss://gateway.spacebar.example/socket?transport=websocket;connect-src *";

        const policy = buildDefaultContentSecurityPolicy(config);

        assert.match(policy, /connect-src[^;]*wss:\/\/gateway\.spacebar\.example/);
        assert.doesNotMatch(policy, /evil\.example/);
        assert.doesNotMatch(policy, /script-src \*/);
        assert.doesNotMatch(policy, /connect-src \*/);
        assert.doesNotMatch(policy, /\/api\/v9/);
        assert.doesNotMatch(policy, /\/assets/);
        assert.doesNotMatch(policy, /\/socket/);
        assert.doesNotMatch(policy, /transport=websocket/);
    });

    test("allows the public widget page to remain embeddable", () => {
        const policy = buildDefaultContentSecurityPolicy(testConfig(), { allowEmbedding: true });

        assert.doesNotMatch(policy, /frame-ancestors/);
    });

    test("uses an explicit configured CSP when provided", () => {
        const config = testConfig();
        config.security.contentSecurityPolicy = "default-src 'none'; connect-src https://api.example";

        assert.equal(getConfiguredContentSecurityPolicy(config), "default-src 'none'; connect-src https://api.example");
    });

    test("omits the CSP header when configured off", () => {
        const config = testConfig();
        config.security.contentSecurityPolicy = " off ";

        assert.equal(getConfiguredContentSecurityPolicy(config), undefined);
    });

    test("does not set the CSP response header when configured off", async (t) => {
        const config = testConfig();
        config.security.contentSecurityPolicy = "off";
        useConfig(t, config);

        const app = express();
        app.use(CORS);
        app.get("/ping", (_req, res) => res.json({ ok: true }));

        const server = http.createServer(app);
        t.after(async () => {
            await close(server);
        });
        const port = await listen(server);

        const response = await fetch(`http://127.0.0.1:${port}/ping`);

        assert.equal(response.status, 200);
        assert.equal(response.headers.get("content-security-policy"), null);
    });

    test("sets CSP and CORS headers on regular and preflight requests", async (t) => {
        useConfig(t, testConfig());

        const app = express();
        app.use(CORS);
        app.get("/ping", (_req, res) => res.json({ ok: true }));
        app.get("/widget", (_req, res) => res.type("html").send("<!doctype html>"));
        app.get("/widget/", (_req, res) => res.type("html").send("<!doctype html>"));

        const server = http.createServer(app);
        t.after(async () => {
            await close(server);
        });
        const port = await listen(server);

        const response = await fetch(`http://127.0.0.1:${port}/ping`, {
            headers: { Origin: "https://client.example" },
        });

        assert.equal(response.status, 200);
        assert.equal(response.headers.get("access-control-allow-origin"), "https://client.example");
        assert.match(response.headers.get("content-security-policy") ?? "", /default-src 'self'/);

        const preflight = await fetch(`http://127.0.0.1:${port}/ping`, {
            method: "OPTIONS",
            headers: {
                Origin: "https://client.example",
                "Access-Control-Request-Method": "PATCH",
                "Access-Control-Request-Headers": "Authorization, Content-Type",
            },
        });

        assert.equal(preflight.status, 204);
        assert.equal(preflight.headers.get("access-control-allow-methods"), "PATCH");
        assert.equal(preflight.headers.get("access-control-allow-headers"), "Authorization, Content-Type");
        assert.match(preflight.headers.get("content-security-policy") ?? "", /default-src 'self'/);

        const widget = await fetch(`http://127.0.0.1:${port}/widget`);

        assert.equal(widget.status, 200);
        assert.doesNotMatch(widget.headers.get("content-security-policy") ?? "", /frame-ancestors/);

        const widgetWithTrailingSlash = await fetch(`http://127.0.0.1:${port}/widget/`);

        assert.equal(widgetWithTrailingSlash.status, 200);
        assert.doesNotMatch(widgetWithTrailingSlash.headers.get("content-security-policy") ?? "", /frame-ancestors/);
    });
});
