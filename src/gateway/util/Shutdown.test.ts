import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { EventEmitter } from "node:events";
import WS from "ws";
import { closeGatewayServer, runDelayedGatewayCloseCleanup, waitForGatewayClientClose, type GatewayShutdownClient, type GatewayShutdownServer } from "./Shutdown";

class TestClient extends EventEmitter implements GatewayShutdownClient {
    readyState: number = WS.OPEN;
    closeCalls = 0;
    closeCleanup?: Promise<unknown>;

    close() {
        this.closeCalls += 1;
        this.readyState = WS.CLOSING;
    }

    finishClose() {
        this.readyState = WS.CLOSED;
        this.emit("close");
    }
}

class TestGatewayServer implements GatewayShutdownServer {
    clients: Set<GatewayShutdownClient> = new Set();
    closeCalls = 0;
    private closeCallback?: (error?: Error) => void;

    addClient(client = new TestClient()) {
        this.clients.add(client);
        client.on("close", () => {
            this.clients.delete(client);
            this.finishServerCloseIfDrained();
        });
        return client;
    }

    close(callback?: (error?: Error) => void) {
        this.closeCalls += 1;
        this.closeCallback = callback;
        this.finishServerCloseIfDrained();
    }

    private finishServerCloseIfDrained() {
        if (this.closeCallback && !this.clients.size) {
            const callback = this.closeCallback;
            this.closeCallback = undefined;
            callback();
        }
    }
}

describe("waitForGatewayClientClose", () => {
    test("closes an open client and waits for its async close cleanup", async () => {
        const client = new TestClient();
        let resolveCleanup!: () => void;
        client.closeCleanup = new Promise<void>((resolve) => {
            resolveCleanup = resolve;
        });

        const closeWait = waitForGatewayClientClose(client);
        assert.equal(client.closeCalls, 1);

        let settled = false;
        void closeWait.then(() => {
            settled = true;
        });

        client.finishClose();
        await Promise.resolve();
        assert.equal(settled, false);

        resolveCleanup();
        await closeWait;
        assert.equal(settled, true);
    });

    test("does not close a client that is already closing", async () => {
        const client = new TestClient();
        client.readyState = WS.CLOSING;

        const closeWait = waitForGatewayClientClose(client);
        assert.equal(client.closeCalls, 0);

        client.finishClose();

        await closeWait;
    });

    test("waits for cleanup assigned by an earlier close listener", async () => {
        const client = new TestClient();
        let resolveCleanup!: () => void;
        client.on("close", () => {
            client.closeCleanup = new Promise<void>((resolve) => {
                resolveCleanup = resolve;
            });
        });

        const closeWait = waitForGatewayClientClose(client);
        client.finishClose();

        let settled = false;
        void closeWait.then(() => {
            settled = true;
        });
        await Promise.resolve();
        assert.equal(settled, false);

        resolveCleanup();
        await closeWait;
        assert.equal(settled, true);
    });

    test("waits for close cleanup extended by another close listener", async () => {
        const client = new TestClient();
        let resolveCloseCleanup!: () => void;
        let resolveListenerCleanup!: () => void;
        client.closeCleanup = new Promise<void>((resolve) => {
            resolveCloseCleanup = resolve;
        });
        client.on("close", () => {
            const closeCleanup = client.closeCleanup;
            const listenerCleanup = new Promise<void>((resolve) => {
                resolveListenerCleanup = resolve;
            });
            client.closeCleanup = Promise.all([closeCleanup, listenerCleanup]).then(() => undefined);
        });

        const closeWait = waitForGatewayClientClose(client);
        client.finishClose();

        let settled = false;
        void closeWait.then(() => {
            settled = true;
        });
        await Promise.resolve();
        assert.equal(settled, false);

        resolveCloseCleanup();
        await Promise.resolve();
        assert.equal(settled, false);

        resolveListenerCleanup();
        await closeWait;
        assert.equal(settled, true);
    });
});

describe("closeGatewayServer", () => {
    test("closes the websocket server before draining clients", async () => {
        const server = new TestGatewayServer();
        const client = server.addClient();

        const closeWait = closeGatewayServer(server);

        assert.equal(server.closeCalls, 1);
        assert.equal(client.closeCalls, 1);

        client.finishClose();
        await closeWait;
    });

    test("drains clients that appear after shutdown starts", async () => {
        const server = new TestGatewayServer();
        const firstClient = server.addClient();

        const closeWait = closeGatewayServer(server);
        const lateClient = server.addClient();

        assert.equal(firstClient.closeCalls, 1);
        assert.equal(lateClient.closeCalls, 0);

        firstClient.finishClose();
        await new Promise((resolve) => {
            setImmediate(resolve);
        });
        assert.equal(lateClient.closeCalls, 1);

        lateClient.finishClose();
        await closeWait;
    });
});

describe("runDelayedGatewayCloseCleanup", () => {
    test("waits for the disconnect delay before running cleanup", async () => {
        let releaseDelay!: () => void;
        let cleanupRan = false;

        const cleanupWait = runDelayedGatewayCloseCleanup(
            async () => {
                cleanupRan = true;
            },
            1234,
            async (ms) => {
                assert.equal(ms, 1234);
                await new Promise<void>((resolve) => {
                    releaseDelay = resolve;
                });
            },
        );

        await Promise.resolve();
        assert.equal(cleanupRan, false);

        releaseDelay();
        await cleanupWait;

        assert.equal(cleanupRan, true);
    });

    test("does not resolve until delayed cleanup work resolves", async () => {
        let releaseCleanup!: () => void;
        let settled = false;

        const cleanupWait = runDelayedGatewayCloseCleanup(
            async () => {
                await new Promise<void>((resolve) => {
                    releaseCleanup = resolve;
                });
            },
            0,
            async () => {},
        );
        void cleanupWait.then(() => {
            settled = true;
        });

        await Promise.resolve();
        assert.equal(settled, false);

        releaseCleanup();
        await cleanupWait;

        assert.equal(settled, true);
    });
});
