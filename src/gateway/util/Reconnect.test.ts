import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { OPCODES, type Payload } from "./Constants";
import { createReconnectPayload } from "./ReconnectPayload";
import type { WebSocket } from "./WebSocket";

function ensureDatabaseEnvForGatewayUtilImports() {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_test";
}

async function expectSettles(promise: Promise<unknown>) {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
        await Promise.race([
            promise,
            new Promise((_, reject) => {
                timeout = setTimeout(() => reject(new Error("Promise did not settle")), 50);
            }),
        ]);
    } finally {
        if (timeout) clearTimeout(timeout);
    }
}

describe("gateway reconnect helpers", () => {
    test("builds opcode 7 reconnect payloads", () => {
        assert.deepEqual(createReconnectPayload(), {
            op: OPCODES.Reconnect,
            d: 1000,
        });
    });

    test("adds sequence numbers when provided", () => {
        assert.deepEqual(createReconnectPayload(2500, 42), {
            op: OPCODES.Reconnect,
            s: 42,
            d: 2500,
        });
    });

    test("send settles and closes without sending when the socket is no longer open", async () => {
        ensureDatabaseEnvForGatewayUtilImports();
        const { Send } = await import("./Send.js");
        let closed = false;
        let sent = false;
        const socket = {
            OPEN: 1,
            readyState: 3,
            encoding: "json",
            close: () => {
                closed = true;
            },
            send: () => {
                sent = true;
            },
        } as unknown as WebSocket;

        await expectSettles(Send(socket, { op: 1, d: null } as Payload));

        assert.equal(closed, true);
        assert.equal(sent, false);
    });

    test("broadcast reconnect settles if an open socket closes before send", async () => {
        ensureDatabaseEnvForGatewayUtilImports();
        const { broadcastReconnect } = await import("./Reconnect.js");
        let readyStateReads = 0;
        let closed = false;
        let sent = false;
        const socket = {
            OPEN: 1,
            encoding: "json",
            compress: undefined,
            sequence: 0,
            get readyState() {
                readyStateReads += 1;
                return readyStateReads === 1 ? 1 : 3;
            },
            close: () => {
                closed = true;
            },
            send: () => {
                sent = true;
            },
        } as unknown as WebSocket;

        await expectSettles(broadcastReconnect([socket]));

        assert.equal(closed, true);
        assert.equal(sent, false);
        assert.equal(socket.sequence, 1);
    });
});
