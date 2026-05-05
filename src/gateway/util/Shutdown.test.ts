import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { EventEmitter } from "node:events";
import WS from "ws";
import { waitForGatewayClientClose, type GatewayShutdownClient } from "./Shutdown";

class TestClient extends EventEmitter implements GatewayShutdownClient {
    readyState: number = WS.OPEN;
    closeCalls = 0;
    closeCleanup?: Promise<unknown>;

    close() {
        this.closeCalls += 1;
        this.readyState = WS.CLOSING;
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

        client.readyState = WS.CLOSED;
        client.emit("close");
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

        client.readyState = WS.CLOSED;
        client.emit("close");

        await closeWait;
    });
});
