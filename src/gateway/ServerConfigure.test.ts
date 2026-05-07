import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, test } from "node:test";
import ws from "ws";
import { Server as GatewayServer } from "./Server";
import { OPCODES, type Payload } from "./util/Constants";

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
});

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

async function closeGateway(server: GatewayServer) {
    for (const client of server.ws.clients) client.close();
    await new Promise<void>((resolve) => {
        server.ws.close(() => resolve());
    });
    await new Promise<void>((resolve, reject) => {
        server.server.close((error) => (error ? reject(error) : resolve()));
    });
}
