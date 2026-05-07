import assert from "node:assert/strict";
import { describe, test } from "node:test";
import http from "node:http";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_test";

const { Server } = require("./Server") as typeof import("./Server");

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
