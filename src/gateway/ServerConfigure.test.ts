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

    test("closes bad opcodes over a real websocket", async () => {
        const http = createServer();
        const server = new GatewayServer({ port: 0, server: http });
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
    for (const client of server.ws.clients) client.close();
    await new Promise<void>((resolve) => {
        server.ws.close(() => resolve());
    });
    await new Promise<void>((resolve, reject) => {
        server.server.close((error) => (error ? reject(error) : resolve()));
    });
}
