import assert from "node:assert/strict";
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { CDNServer, type CDNServerOptions } from "../../src/cdn/Server";

export interface StartedCdnServer {
    baseUrl: string;
    server: CDNServer;
    http: HttpServer;
    stop: () => Promise<void>;
}

export async function startCdn(options: Partial<CDNServerOptions> = {}): Promise<StartedCdnServer> {
    const server = new CDNServer({ serverInitLogging: false, ...options });
    await server.configureApp();

    const http = createServer(server.app);
    const port = await listen(http);
    const baseUrl = `http://127.0.0.1:${port}`;

    return {
        baseUrl,
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
