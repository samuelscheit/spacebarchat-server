import assert from "node:assert/strict";
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Server as GatewayServer } from "@spacebar/gateway";
import { Config } from "@spacebar/util";

export interface StartedGatewayServer {
    url: string;
    server: GatewayServer;
    http: HttpServer;
    stop: () => Promise<void>;
}

export async function startGateway(): Promise<StartedGatewayServer> {
    const http = createServer();
    const server = new GatewayServer({ port: 0, server: http });
    Config.get().gateway.disconnectedSessionCleanupDelayMs = 0;
    server.configureWebSocketServer();
    const port = await listen(http);

    return {
        url: `ws://127.0.0.1:${port}`,
        server,
        http,
        stop: () => closeGateway(server, http),
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

async function closeGateway(server: GatewayServer, http: HttpServer) {
    await server.stop();
    await new Promise<void>((resolve, reject) => {
        if (!http.listening) {
            resolve();
            return;
        }
        http.close((error) => (error ? reject(error) : resolve()));
    });
}
