import assert from "node:assert/strict";
import { describe, test } from "node:test";
import http from "node:http";
import ws, { type ServerOptions } from "ws";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_test";

const { Server } = require("./Server") as typeof import("./Server");

type ServerWithInitializer = {
    initializeWebSocketServer: () => void;
};

class CapturingWebSocketServer {
    static options: ServerOptions[] = [];

    clients = new Set<{ close: () => void }>();

    constructor(options: ServerOptions) {
        CapturingWebSocketServer.options.push(options);
    }

    on() {
        return this;
    }

    close(callback?: () => void) {
        callback?.();
    }
}

function listen(server: http.Server) {
    return new Promise<void>((resolve) => {
        server.listen(0, resolve);
    });
}

function close(server: http.Server) {
    if (!server.listening) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
        server.close((error) => {
            if (error) reject(error);
            else resolve();
        });
    });
}

describe("Gateway Server shutdown", () => {
    test("uses the configured gateway message size as the ws transport cap", () => {
        const { Config, ConfigValue } = require("@spacebar/util") as typeof import("@spacebar/util");
        const originalWebSocketServer = ws.Server;
        const originalConfigGet = Config.get;
        const config = new ConfigValue();
        config.limits.gateway.maxMessageSize = 4096;

        try {
            (ws as unknown as { Server: typeof CapturingWebSocketServer }).Server = CapturingWebSocketServer;
            (Config as unknown as { get: () => typeof config }).get = () => config;
            CapturingWebSocketServer.options = [];

            const gateway = new Server({ port: 0 }) as unknown as ServerWithInitializer;
            gateway.initializeWebSocketServer();
            gateway.initializeWebSocketServer();

            assert.equal(CapturingWebSocketServer.options.length, 1);
            assert.equal(CapturingWebSocketServer.options[0]?.maxPayload, 4096);
        } finally {
            (ws as unknown as { Server: typeof originalWebSocketServer }).Server = originalWebSocketServer;
            (Config as unknown as { get: typeof originalConfigGet }).get = originalConfigGet;
        }
    });

    test("stop removes its upgrade listener from a shared HTTP server", async () => {
        const sharedServer = http.createServer();
        const gateway = new Server({ port: 0, server: sharedServer });

        assert.equal(sharedServer.listenerCount("upgrade"), 1);

        await gateway.stop();

        assert.equal(sharedServer.listenerCount("upgrade"), 0);
    });

    test("stop leaves an already-listening shared HTTP server open", async () => {
        const sharedServer = http.createServer();
        await listen(sharedServer);

        try {
            const gateway = new Server({ port: 0, server: sharedServer });

            await gateway.stop();

            assert.equal(sharedServer.listening, true);
            assert.equal(sharedServer.listenerCount("upgrade"), 0);
        } finally {
            await close(sharedServer);
        }
    });

    test("stop is idempotent", async () => {
        const sharedServer = http.createServer();
        const gateway = new Server({ port: 0, server: sharedServer });

        await Promise.all([gateway.stop(), gateway.stop()]);

        assert.equal(sharedServer.listenerCount("upgrade"), 0);
    });
});
