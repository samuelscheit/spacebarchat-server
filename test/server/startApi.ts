import assert from "node:assert/strict";
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { SpacebarServer, type SpacebarServerOptions } from "@spacebar/api";

export interface StartedApiServer {
    baseUrl: string;
    apiBaseUrl: string;
    server: SpacebarServer;
    http: HttpServer;
    stop: () => Promise<void>;
}

export async function startApi(options: Partial<SpacebarServerOptions> = {}): Promise<StartedApiServer> {
    const server = new SpacebarServer({ serverInitLogging: false, ...options });
    await server.configureApp();

    const http = createServer(server.app);
    const port = await listen(http);
    const baseUrl = `http://127.0.0.1:${port}`;

    return {
        baseUrl,
        apiBaseUrl: `${baseUrl}/api/v9`,
        server,
        http,
        stop: () => close(http),
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

async function close(server: HttpServer) {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}
