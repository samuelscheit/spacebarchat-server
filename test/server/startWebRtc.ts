import assert from "node:assert/strict";
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Server as WebRtcServer } from "@spacebar/webrtc";

export interface StartedWebRtcServer {
    url: string;
    server: WebRtcServer;
    http: HttpServer;
    stop: () => Promise<void>;
}

export async function startWebRtc(): Promise<StartedWebRtcServer> {
    const http = createServer();
    const server = new WebRtcServer({ port: 0, server: http });
    server.configureWebSocketServer();
    const port = await listen(http);

    return {
        url: `ws://127.0.0.1:${port}`,
        server,
        http,
        stop: () => closeWebRtc(server),
    };
}

async function listen(server: HttpServer) {
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address();
    assert(address && typeof address === "object");
    return (address as AddressInfo).port;
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
