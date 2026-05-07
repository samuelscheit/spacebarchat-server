import assert from "node:assert/strict";
import http, { type RequestListener } from "node:http";
import net from "node:net";
import { describe, test } from "node:test";
import express from "express";
import { collectPrometheusMetrics, formatPrometheusMetrics, getProcessMetricSamples, registerPrometheusMetricsRoute, writePrometheusMetricsResponse } from "./Metrics";

describe("Prometheus metrics", () => {
    test("formats samples with metadata once per metric", () => {
        const output = formatPrometheusMetrics([
            {
                name: "spacebar_test_value",
                help: "A test value.",
                type: "gauge",
                value: 1,
                labels: { service: "api" },
            },
            {
                name: "spacebar_test_value",
                help: "A test value.",
                type: "gauge",
                value: 2,
                labels: { service: "gateway" },
            },
        ]);

        assert.equal(output.match(/# HELP spacebar_test_value/g)?.length, 1);
        assert.match(output, /spacebar_test_value\{service="api"\} 1/);
        assert.match(output, /spacebar_test_value\{service="gateway"\} 2/);
        assert.equal(output.endsWith("\n"), true);
    });
    test("escapes help text", () => {
        const output = formatPrometheusMetrics([
            {
                name: "spacebar_test_value",
                help: "A test value with \\ slash and\nnewline.",
                type: "gauge",
                value: 1,
            },
        ]);

        assert.match(output, /# HELP spacebar_test_value A test value with \\\\ slash and\\nnewline\./);
        assert.doesNotMatch(output.split("\n").slice(1).join("\n"), /^newline\./m);
    });

    test("writes metrics HTTP responses from a scrape-time collector", async () => {
        let value = 0;
        const server = await listen((req, res) => {
            writePrometheusMetricsResponse(res, () => [
                {
                    name: "spacebar_lazy_metric",
                    help: "Lazy metric.",
                    type: "gauge",
                    value: (value += 1),
                    labels: { service: "api" },
                },
            ]);
        });

        try {
            const firstResponse = await fetch(`http://127.0.0.1:${server.port}/-/metrics`);
            const secondResponse = await fetch(`http://127.0.0.1:${server.port}/-/metrics`);
            const firstBody = await firstResponse.text();
            const secondBody = await secondResponse.text();

            assert.equal(firstResponse.status, 200);
            assert.match(firstResponse.headers.get("content-type") ?? "", /^text\/plain; version=0\.0\.4/);
            assert.match(firstBody, /spacebar_lazy_metric\{service="api"\} 1/);
            assert.match(secondBody, /spacebar_lazy_metric\{service="api"\} 2/);
        } finally {
            await close(server.server);
        }
    });
    test("escapes label values", () => {
        const output = formatPrometheusMetrics([
            {
                name: "spacebar_test_value",
                help: "A test value.",
                type: "gauge",
                value: 1,
                labels: { service: 'api"quoted\\line\nbreak' },
            },
        ]);

        assert.match(output, /service="api\\"quoted\\\\line\\nbreak"/);
    });

    test("drops non-finite samples", () => {
        const output = formatPrometheusMetrics([
            { name: "spacebar_test_value", help: "A test value.", type: "gauge", value: Number.NaN },
            { name: "spacebar_test_value", help: "A test value.", type: "gauge", value: 3 },
        ]);

        assert.match(output, /spacebar_test_value 3/);
        assert.doesNotMatch(output, /NaN/);
    });

    test("collects process metrics and extras", () => {
        const samples = getProcessMetricSamples("api", [{ name: "spacebar_extra", help: "Extra metric.", type: "gauge", value: 4 }]);
        const names = new Set(samples.map((sample) => sample.name));

        assert.equal(names.has("spacebar_process_uptime_seconds"), true);
        assert.equal(names.has("spacebar_process_memory_bytes"), true);
        assert.equal(names.has("spacebar_extra"), true);

        const output = collectPrometheusMetrics("api");
        assert.match(output, /spacebar_process_uptime_seconds\{service="api"\} /);
    });

    test("registers one shared Express metrics endpoint with all collectors", async () => {
        const app = express();
        registerPrometheusMetricsRoute(app, () => [{ name: "spacebar_api_metric", help: "API metric.", type: "gauge", value: 1, labels: { service: "api" } }]);
        registerPrometheusMetricsRoute(app, () => [{ name: "spacebar_cdn_metric", help: "CDN metric.", type: "gauge", value: 2, labels: { service: "cdn" } }]);

        const server = await listen(app);
        try {
            const response = await fetch(`http://127.0.0.1:${server.port}/-/metrics`);
            const body = await response.text();

            assert.equal(response.status, 200);
            assert.match(response.headers.get("content-type") ?? "", /^text\/plain; version=0\.0\.4/);
            assert.match(body, /spacebar_api_metric\{service="api"\} 1/);
            assert.match(body, /spacebar_cdn_metric\{service="cdn"\} 2/);
        } finally {
            await close(server.server);
        }
    });

    test("standalone WebRTC metrics endpoint reports websocket clients", async () => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@127.0.0.1:5432/spacebar";
        const { Server } = await import("../../webrtc/Server.js");
        const webrtc = new Server({ port: 0 });
        const server = await listen(webrtc.server);

        try {
            const response = await fetch(`http://127.0.0.1:${server.port}/-/metrics`);
            const body = await response.text();

            assert.equal(response.status, 200);
            assert.match(response.headers.get("content-type") ?? "", /^text\/plain; version=0\.0\.4/);
            assert.match(body, /spacebar_webrtc_websocket_clients\{service="webrtc"\} /);
        } finally {
            webrtc.ws?.close();
            await close(server.server);
        }
    });

    test("standalone WebRTC metrics endpoint ignores malformed Host headers", async () => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@127.0.0.1:5432/spacebar";
        const { Server } = await import("../../webrtc/Server.js");
        const webrtc = new Server({ port: 0 });
        const server = await listen(webrtc.server);

        try {
            const response = await requestWithMalformedHost(server.port, "/-/metrics");

            assert.match(response, /^HTTP\/1\.1 200 OK\r\n/);
            assert.match(response, /content-type: text\/plain; version=0\.0\.4; charset=utf-8/i);
            assert.match(response, /spacebar_webrtc_websocket_clients\{service="webrtc"\} /);
        } finally {
            webrtc.ws?.close();
            await close(server.server);
        }
    });

    test("standalone WebRTC server handles malformed absolute-form request targets", async () => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@127.0.0.1:5432/spacebar";
        const { Server } = await import("../../webrtc/Server.js");
        const webrtc = new Server({ port: 0 });
        const server = await listen(webrtc.server);

        try {
            const response = await requestRaw(server.port, "GET http://[::1 HTTP/1.1\r\nHost: example.test\r\nConnection: close\r\n\r\n");

            assert.match(response, /^HTTP\/1\.1 200 OK\r\n/);
            assert.match(response, /Online/);
        } finally {
            webrtc.ws?.close();
            await close(server.server);
        }
    });

    test("standalone gateway metrics endpoint is scrape-only", async () => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@127.0.0.1:5432/spacebar";
        const { Server } = await import("../../gateway/Server.js");
        const gateway = new Server({ port: 0 });
        const server = await listen(gateway.server);

        try {
            const response = await fetch(`http://127.0.0.1:${server.port}/-/metrics`);
            const body = await response.text();

            assert.equal(response.status, 200);
            assert.equal(response.headers.get("set-cookie"), null);
            assert.match(response.headers.get("content-type") ?? "", /^text\/plain; version=0\.0\.4/);
            assert.match(body, /spacebar_gateway_websocket_clients\{service="gateway"\} /);
        } finally {
            gateway.ws.close();
            await close(server.server);
        }
    });

    test("standalone gateway metrics endpoint ignores malformed Host headers", async () => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@127.0.0.1:5432/spacebar";
        const { Server } = await import("../../gateway/Server.js");
        const gateway = new Server({ port: 0 });
        const server = await listen(gateway.server);

        try {
            const response = await requestWithMalformedHost(server.port, "/-/metrics");

            assert.match(response, /^HTTP\/1\.1 200 OK\r\n/);
            assert.doesNotMatch(response, /^set-cookie:/im);
            assert.match(response, /content-type: text\/plain; version=0\.0\.4; charset=utf-8/i);
            assert.match(response, /spacebar_gateway_websocket_clients\{service="gateway"\} /);
        } finally {
            gateway.ws.close();
            await close(server.server);
        }
    });

    test("standalone gateway server handles malformed absolute-form request targets", async () => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@127.0.0.1:5432/spacebar";
        const { Server } = await import("../../gateway/Server.js");
        const gateway = new Server({ port: 0 });
        const server = await listen(gateway.server);

        try {
            const response = await requestRaw(server.port, "GET http://[::1 HTTP/1.1\r\nHost: example.test\r\nConnection: close\r\n\r\n");

            assert.match(response, /^HTTP\/1\.1 200 OK\r\n/);
            assert.match(response, /Online/);
        } finally {
            gateway.ws.close();
            await close(server.server);
        }
    });
});

type ListeningServer = {
    server: http.Server;
    port: number;
};

function listen(handler: RequestListener | http.Server): Promise<ListeningServer> {
    const server = handler instanceof http.Server ? handler : http.createServer(handler);

    return new Promise((resolve) => {
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            assert(address && typeof address === "object");
            resolve({ server, port: address.port });
        });
    });
}

function close(server: http.Server): Promise<void> {
    return new Promise((resolve, reject) => {
        server.close((error) => {
            if (error) reject(error);
            else resolve();
        });
    });
}

function requestWithMalformedHost(port: number, path: string): Promise<string> {
    return requestRaw(port, `GET ${path} HTTP/1.1\r\nHost: exa mple\r\nConnection: close\r\n\r\n`);
}

function requestRaw(port: number, request: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const socket = net.createConnection({ host: "127.0.0.1", port }, () => {
            socket.write(request);
        });
        const chunks: Buffer[] = [];

        socket.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        socket.on("error", reject);
        socket.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
}
