import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, test } from "node:test";
import ws from "ws";
import { Server as GatewayServer } from "./Server";
import { CLOSECODES, OPCODES, type Payload } from "./util/Constants";

describe("Gateway Server transport", () => {
    test("accepts a real websocket client and sends HELLO without startup database initialization", async () => {
        const http = createServer();
        const server = new GatewayServer({ port: 0, server: http });
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

    test("responds to QoS heartbeat over a real websocket before authentication", async () => {
        const http = createServer();
        const server = new GatewayServer({ port: 0, server: http });
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

    test("closes malformed heartbeat payloads over a real websocket", async () => {
        const http = createServer();
        const server = new GatewayServer({ port: 0, server: http });
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
});

async function assertGatewayHandshakeClose(path: string, expectedCode: CLOSECODES) {
    const http = createServer();
    const server = new GatewayServer({ port: 0, server: http });
    const port = await listen(http);

    try {
        const client = new ws(`ws://127.0.0.1:${port}${path}`, { headers: { "User-Agent": "spacebar-test" } });
        const close = await readClose(client);
        assert.equal(close.code, expectedCode);
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
    const raw = await new Promise<ws.RawData>((resolve, reject) => {
        client.once("message", resolve);
        client.once("error", reject);
    });

    return JSON.parse(raw.toString()) as Payload;
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
        client.once("close", (code, reason) => resolve({ code, reason }));
        client.once("error", reject);
    });
}

async function closeGateway(server: GatewayServer) {
    for (const client of server.ws.clients) client.close();
    await new Promise<void>((resolve) => {
        server.ws.close(() => resolve());
    });
    await new Promise<void>((resolve, reject) => {
        server.server.close((error) => (error ? reject(error) : resolve()));
    });
}
