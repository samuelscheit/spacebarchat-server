import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, test } from "node:test";
import ws from "ws";
import { Server as WebRtcServer } from "./Server";
import { VoiceOPCodes, type VoicePayload } from "./util/Constants";

describe("WebRTC Server transport", () => {
    test("accepts a real websocket client and sends HELLO without startup database initialization", async () => {
        const http = createServer();
        const server = new WebRtcServer({ port: 0, server: http });
        server.configureWebSocketServer();
        const port = await listen(http);

        try {
            const client = new ws(`ws://127.0.0.1:${port}/?v=5`);
            const hello = await readJsonMessage(client);

            assert.equal(hello.op, VoiceOPCodes.HELLO);
            assert.equal(typeof hello.d?.heartbeat_interval, "number");

            await closeClient(client);
        } finally {
            await closeWebRtc(server);
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

    return JSON.parse(raw.toString()) as VoicePayload;
}

async function closeClient(client: ws) {
    client.close();
    if (client.readyState !== ws.CLOSED) {
        await new Promise<void>((resolve) => {
            client.once("close", () => resolve());
        });
    }
}

async function closeWebRtc(server: WebRtcServer) {
    if (server.ws) {
        for (const client of server.ws.clients) client.close();
        await new Promise<void>((resolve) => {
            server.ws?.close(() => resolve());
        });
    }
    await new Promise<void>((resolve, reject) => {
        server.server.close((error) => (error ? reject(error) : resolve()));
    });
}
