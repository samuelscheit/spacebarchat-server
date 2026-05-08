import assert from "node:assert/strict";
import http, { type Server } from "node:http";
import { AddressInfo } from "node:net";
import { describe, test } from "node:test";
import express from "express";
import { ConfigValue } from "@spacebar/util";
import { buildDefaultContentSecurityPolicy, CORS, getConfiguredContentSecurityPolicy } from "./CORS";

function testConfig() {
    const config = new ConfigValue();
    config.admin.endpointPublic = "https://admin.spacebar.example/app";
    config.api.endpointPublic = "https://api.spacebar.example/api/v9";
    config.cdn.endpointPublic = "https://cdn.spacebar.example/assets";
    config.gateway.endpointPublic = "wss://gateway.spacebar.example";
    return config;
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
        assert.match(policy, /script-src[^;]*https:\/\/www\.google\.com/);
        assert.match(policy, /style-src[^;]*https:\/\/fonts\.googleapis\.com/);
        assert.match(policy, /font-src[^;]*https:\/\/fonts\.gstatic\.com/);
        assert.doesNotMatch(policy, /default-src \*/);
        assert.doesNotMatch(policy, /script-src \*/);
        assert.doesNotMatch(policy, /'unsafe-eval'/);
        assert.doesNotMatch(policy, /filesystem:/);
        assert.doesNotMatch(policy, /about:/);
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

    test("sets CSP and CORS headers on regular and preflight requests", async (t) => {
        const app = express();
        app.use(CORS);
        app.get("/ping", (req, res) => res.json({ ok: true }));
        app.get("/widget", (req, res) => res.type("html").send("<!doctype html>"));
        app.get("/widget/", (req, res) => res.type("html").send("<!doctype html>"));

        const server = http.createServer(app);
        t.after(() => close(server));
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
