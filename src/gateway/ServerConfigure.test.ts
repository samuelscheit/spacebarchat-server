import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, test } from "node:test";
import { Decoder, Encoder } from "@toondepauw/node-zstd";
import { Deflate, Inflate } from "fast-zlib";
import ws from "ws";
import { CLOSECODES, OPCODES, Server as GatewayServer, type Payload } from "@spacebar/gateway";

describe("Gateway Server transport", () => {
    test("accepts a real websocket client and sends HELLO without startup database initialization", async () => {
        const http = createServer();
        const server = new GatewayServer({ port: 0, server: http });
        server.configureWebSocketServer();
        const port = await listen(http);

        try {
            const client = new ws(`ws://127.0.0.1:${port}/?version=8&encoding=json`, { headers: { "User-Agent": "spacebar-test" } });
            const hello = await readJsonMessage(client);

            assert.equal(hello.op, OPCODES.Hello);
            assert.equal(typeof hello.d?.heartbeat_interval, "number");

            await closeClient(client);
        } finally {
            await closeGateway(server);
        }
    });

    test("rejects unsupported handshake options over a real websocket", async () => {
        await assertGatewayHandshakeClose("/?version=8&encoding=xml", CLOSECODES.Decode_error);
        await assertGatewayHandshakeClose("/?version=8&encoding=json&compress=unsupported", CLOSECODES.Decode_error);
        await assertGatewayHandshakeClose("/?version=7&encoding=json", CLOSECODES.Invalid_API_version);
    });

    test("responds to heartbeat over a real websocket before authentication", async () => {
        const http = createServer();
        const server = new GatewayServer({ port: 0, server: http });
        server.configureWebSocketServer();
        const port = await listen(http);

        try {
            const client = new ws(`ws://127.0.0.1:${port}/?version=8&encoding=json`, { headers: { "User-Agent": "spacebar-test" } });
            await readJsonMessage(client);

            client.send(JSON.stringify({ op: OPCODES.Heartbeat, d: null }));
            const ack = await readJsonMessage(client);

            assert.equal(ack.op, OPCODES.Heartbeat_ACK);

            await closeClient(client);
        } finally {
            await closeGateway(server);
        }
    });

    test("responds to heartbeat over a zlib-stream compressed real websocket before authentication", async () => {
        const http = createServer();
        const server = new GatewayServer({ port: 0, server: http });
        server.configureWebSocketServer();
        const port = await listen(http);
        const deflate = new Deflate();
        const inflate = new Inflate();

        try {
            const client = new ws(`ws://127.0.0.1:${port}/?version=8&encoding=json&compress=zlib-stream`, { headers: { "User-Agent": "spacebar-test" } });
            const hello = await readCompressedJsonMessage(client, (message) => inflate.process(message) as Buffer);

            assert.equal(hello.op, OPCODES.Hello);

            client.send(deflate.process(Buffer.from(JSON.stringify({ op: OPCODES.Heartbeat, d: null }))) as Buffer);
            const ack = await readCompressedJsonMessage(client, (message) => inflate.process(message) as Buffer);

            assert.equal(ack.op, OPCODES.Heartbeat_ACK);

            await closeClient(client);
        } finally {
            await closeGateway(server);
        }
    });

    test("responds to heartbeat over a zstd-stream compressed real websocket before authentication", async () => {
        const http = createServer();
        const server = new GatewayServer({ port: 0, server: http });
        server.configureWebSocketServer();
        const port = await listen(http);
        const encoder = new Encoder(6);
        const decoder = new Decoder();

        try {
            const client = new ws(`ws://127.0.0.1:${port}/?version=8&encoding=json&compress=zstd-stream`, { headers: { "User-Agent": "spacebar-test" } });
            const hello = await readCompressedJsonMessage(client, async (message) => Buffer.from(await decoder.decode(message)));

            assert.equal(hello.op, OPCODES.Hello);

            client.send((await encoder.encode(Buffer.from(JSON.stringify({ op: OPCODES.Heartbeat, d: null })))) as Buffer);
            const ack = await readCompressedJsonMessage(client, async (message) => Buffer.from(await decoder.decode(message)));

            assert.equal(ack.op, OPCODES.Heartbeat_ACK);

            await closeClient(client);
        } finally {
            await closeGateway(server);
        }
    });

    test("responds to QoS heartbeat over a real websocket before authentication", async () => {
        const http = createServer();
        const server = new GatewayServer({ port: 0, server: http });
        server.configureWebSocketServer();
        const port = await listen(http);

        try {
            const client = new ws(`ws://127.0.0.1:${port}/?version=8&encoding=json`, { headers: { "User-Agent": "spacebar-test" } });
            await readJsonMessage(client);

            client.send(
                JSON.stringify({
                    op: OPCODES.SetQoS,
                    d: {
                        seq: null,
                        qos: {
                            ver: 1,
                            active: true,
                            reasons: ["foregrounded"],
                        },
                    },
                }),
            );
            const ack = await readJsonMessage(client);

            assert.equal(ack.op, OPCODES.Heartbeat_ACK);

            await closeClient(client);
        } finally {
            await closeGateway(server);
        }
    });

    test("closes invalid JSON payloads over a real websocket", async () => {
        const http = createServer();
        const server = new GatewayServer({ port: 0, server: http });
        server.configureWebSocketServer();
        const port = await listen(http);

        try {
            const client = new ws(`ws://127.0.0.1:${port}/?version=8&encoding=json`, { headers: { "User-Agent": "spacebar-test" } });
            await readJsonMessage(client);

            client.send("{not-json");
            const close = await readClose(client);

            assert.equal(close.code, CLOSECODES.Decode_error);
        } finally {
            await closeGateway(server);
        }
    });

    test("closes malformed compressed JSON payloads over real websockets", async () => {
        await assertGatewayCompressedPayloadClose(
            "/?version=8&encoding=json&compress=zlib-stream",
            (message) => new Inflate().process(message) as Buffer,
            async (message) => new Deflate().process(message) as Buffer,
        );
        await assertGatewayCompressedPayloadClose(
            "/?version=8&encoding=json&compress=zstd-stream",
            async (message) => Buffer.from(await new Decoder().decode(message)),
            async (message) => (await new Encoder(6).encode(message)) as Buffer,
        );
    });

    test("closes malformed heartbeat payloads over a real websocket", async () => {
        const http = createServer();
        const server = new GatewayServer({ port: 0, server: http });
        server.configureWebSocketServer();
        const port = await listen(http);

        try {
            const client = new ws(`ws://127.0.0.1:${port}/?version=8&encoding=json`, { headers: { "User-Agent": "spacebar-test" } });
            await readJsonMessage(client);

            client.send(JSON.stringify({ op: OPCODES.Heartbeat, d: {} }));
            const close = await readClose(client);

            assert.equal(close.code, CLOSECODES.Decode_error);
        } finally {
            await closeGateway(server);
        }
    });

    test("closes authenticated-only opcodes before identify over a real websocket", async () => {
        const http = createServer();
        const server = new GatewayServer({ port: 0, server: http });
        server.configureWebSocketServer();
        const port = await listen(http);

        try {
            const client = new ws(`ws://127.0.0.1:${port}/?version=8&encoding=json`, { headers: { "User-Agent": "spacebar-test" } });
            await readJsonMessage(client);

            client.send(JSON.stringify({ op: OPCODES.Request_Channel_Statuses, d: { guild_id: "100000000000000001" } }));
            const close = await readClose(client);

            assert.equal(close.code, CLOSECODES.Not_authenticated);
        } finally {
            await closeGateway(server);
        }
    });

    test("closes bad opcodes over a real websocket", async () => {
        const http = createServer();
        const server = new GatewayServer({ port: 0, server: http });
        server.configureWebSocketServer();
        const port = await listen(http);

        try {
            const client = new ws(`ws://127.0.0.1:${port}/?version=8&encoding=json`, { headers: { "User-Agent": "spacebar-test" } });
            await readJsonMessage(client);

            client.send(JSON.stringify({ op: 999, d: {} }));
            const close = await readClose(client);

            assert.equal(close.code, CLOSECODES.Unknown_opcode);
        } finally {
            await closeGateway(server);
        }
    });
});

async function assertGatewayHandshakeClose(path: string, expectedCode: CLOSECODES) {
    const http = createServer();
    const server = new GatewayServer({ port: 0, server: http });
    server.configureWebSocketServer();
    const port = await listen(http);

    try {
        const client = new ws(`ws://127.0.0.1:${port}${path}`, { headers: { "User-Agent": "spacebar-test" } });
        const close = await readClose(client);
        assert.equal(close.code, expectedCode);
    } finally {
        await closeGateway(server);
    }
}

async function assertGatewayCompressedPayloadClose(path: string, decode: (message: Buffer) => Buffer | Promise<Buffer>, encode: (message: Buffer) => Buffer | Promise<Buffer>) {
    const http = createServer();
    const server = new GatewayServer({ port: 0, server: http });
    server.configureWebSocketServer();
    const port = await listen(http);

    try {
        const client = new ws(`ws://127.0.0.1:${port}${path}`, { headers: { "User-Agent": "spacebar-test" } });
        const hello = await readCompressedJsonMessage(client, decode);

        assert.equal(hello.op, OPCODES.Hello);

        client.send(await encode(Buffer.from("{not-json")));
        const close = await readClose(client);

        assert.equal(close.code, CLOSECODES.Decode_error);
    } finally {
        await closeGateway(server);
    }
}

async function listen(server: ReturnType<typeof createServer>) {
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address();
    assert(address && typeof address === "object");
    return (address as AddressInfo).port;
}

async function readJsonMessage(client: ws) {
    const raw = await readRawMessage(client);
    return JSON.parse(raw.toString()) as Payload;
}

async function readCompressedJsonMessage(client: ws, decode: (message: Buffer) => Buffer | Promise<Buffer>) {
    const raw = await readRawMessage(client);
    const payload = await decode(rawDataToBuffer(raw));
    return JSON.parse(payload.toString()) as Payload;
}

async function readRawMessage(client: ws) {
    return await new Promise<ws.RawData>((resolve, reject) => {
        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error("Timed out waiting for Gateway message"));
        }, 10_000);
        const cleanup = () => {
            clearTimeout(timeout);
            client.off("message", onMessage);
            client.off("error", onError);
            client.off("close", onClose);
        };
        const onMessage = (message: ws.RawData) => {
            cleanup();
            resolve(message);
        };
        const onError = (error: Error) => {
            cleanup();
            reject(error);
        };
        const onClose = (code: number) => {
            cleanup();
            reject(new Error(`Gateway closed before message: ${code}`));
        };
        client.once("message", onMessage);
        client.once("error", onError);
        client.once("close", onClose);
    });
}

function rawDataToBuffer(raw: ws.RawData) {
    if (Buffer.isBuffer(raw)) return raw;
    if (Array.isArray(raw)) return Buffer.concat(raw);
    return Buffer.from(raw);
}

async function closeClient(client: ws) {
    client.close();
    if (client.readyState !== ws.CLOSED) {
        await new Promise<void>((resolve) => {
            client.once("close", () => resolve());
        });
    }
}

async function readClose(client: ws) {
    return await new Promise<{ code: number; reason: Buffer }>((resolve, reject) => {
        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error("Timed out waiting for Gateway close"));
        }, 10_000);
        const cleanup = () => {
            clearTimeout(timeout);
            client.off("close", onClose);
            client.off("error", onError);
        };
        const onClose = (code: number, reason: Buffer) => {
            cleanup();
            resolve({ code, reason });
        };
        const onError = (error: Error) => {
            cleanup();
            reject(error);
        };
        client.once("close", onClose);
        client.once("error", onError);
    });
}

async function closeGateway(server: GatewayServer) {
    assert.ok(server.ws, "Gateway websocket server should be initialized before close");
    const wsServer = server.ws;
    for (const client of wsServer.clients) client.close();
    await new Promise<void>((resolve) => {
        wsServer.close(() => resolve());
    });
    await new Promise<void>((resolve, reject) => {
        server.server.close((error) => (error ? reject(error) : resolve()));
    });
}
