import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, test } from "node:test";
import ws from "ws";
import { CLOSECODES } from "@spacebar/gateway";
import { Server as WebRtcServer } from "./Server";
import { VoiceOPCodes, type VoicePayload } from "./util/Constants";
import type { WebRtcWebSocket } from "./util/WebRtcWebSocket";

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

    test("requires authentication for non-identify opcodes over a real websocket", async () => {
        const http = createServer();
        const server = new WebRtcServer({ port: 0, server: http });
        server.configureWebSocketServer();
        const port = await listen(http);

        try {
            const client = new ws(`ws://127.0.0.1:${port}/?v=5`);
            await readJsonMessage(client);

            client.send(JSON.stringify({ op: VoiceOPCodes.HEARTBEAT, d: 12345 }));
            const close = await readClose(client);

            assert.equal(close.code, CLOSECODES.Not_authenticated);
        } finally {
            await closeWebRtc(server);
        }
    });

    test("responds to heartbeat over a real websocket after authentication precondition is met", async () => {
        const http = createServer();
        const server = new WebRtcServer({ port: 0, server: http });
        server.configureWebSocketServer();
        const port = await listen(http);

        try {
            const client = new ws(`ws://127.0.0.1:${port}/?v=5`);
            await readJsonMessage(client);

            const [serverSocket] = server.ws?.clients ?? [];
            assert(serverSocket);
            (serverSocket as WebRtcWebSocket).user_id = "user-fixture";

            client.send(JSON.stringify({ op: VoiceOPCodes.HEARTBEAT, d: 12345 }));
            const ack = await readJsonMessage(client);

            assert.equal(ack.op, VoiceOPCodes.HEARTBEAT_ACK);
            assert.equal(ack.d, 12345);

            await closeClient(client);
        } finally {
            await closeWebRtc(server);
        }
    });

    test("responds with backend version over a real websocket after authentication precondition is met", async () => {
        const http = createServer();
        const server = new WebRtcServer({ port: 0, server: http });
        server.configureWebSocketServer();
        const port = await listen(http);

        try {
            const client = new ws(`ws://127.0.0.1:${port}/?v=5`);
            await readJsonMessage(client);

            const [serverSocket] = server.ws?.clients ?? [];
            assert(serverSocket);
            (serverSocket as WebRtcWebSocket).user_id = "user-fixture";

            client.send(JSON.stringify({ op: VoiceOPCodes.VOICE_BACKEND_VERSION, d: {} }));
            const version = await readJsonMessage(client);

            assert.equal(version.op, VoiceOPCodes.VOICE_BACKEND_VERSION);
            assert.equal(typeof version.d?.voice, "string");
            assert.equal(typeof version.d?.rtc_worker, "string");

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

async function readClose(client: ws) {
    return await new Promise<{ code: number; reason: Buffer }>((resolve, reject) => {
        client.once("close", (code, reason) => resolve({ code, reason }));
        client.once("error", reject);
    });
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
