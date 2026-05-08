import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { OPCODES, type Payload } from "./Constants";
import type { WebSocket } from "./WebSocket";

function ensureDatabaseEnvForGatewayUtilImports() {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_test";
}

function createOpenJsonSocket() {
    const sent: Payload[] = [];
    const closes: { code?: number; reason?: string }[] = [];
    const socket = {
        OPEN: 1,
        readyState: 1,
        encoding: "json",
        sequence: 17,
        send(data: string, callback: (err?: Error) => void) {
            sent.push(JSON.parse(data) as Payload);
            callback();
        },
        close(code?: number, reason?: string) {
            closes.push({ code, reason });
        },
    } as unknown as WebSocket;

    return { socket, sent, closes };
}

describe("invalid session gateway helpers", () => {
    test("sends a non-resumable opcode 9 invalid-session payload by default", async () => {
        ensureDatabaseEnvForGatewayUtilImports();
        const { sendInvalidSession } = await import("./InvalidSession.js");
        const { socket, sent, closes } = createOpenJsonSocket();

        await sendInvalidSession(socket);

        assert.deepEqual(sent, [
            {
                op: OPCODES.Invalid_Session,
                d: false,
                s: 17,
            },
        ]);
        assert.equal(socket.sequence, 18);
        assert.deepEqual(closes, []);
    });

    test("can mark invalid-session payloads resumable", async () => {
        ensureDatabaseEnvForGatewayUtilImports();
        const { sendInvalidSession } = await import("./InvalidSession.js");
        const { socket, sent } = createOpenJsonSocket();

        await sendInvalidSession(socket, true);

        assert.deepEqual(sent, [
            {
                op: OPCODES.Invalid_Session,
                d: true,
                s: 17,
            },
        ]);
    });

    test("closes with normal closure instead of deprecated close code 4006", async () => {
        ensureDatabaseEnvForGatewayUtilImports();
        const { INVALID_SESSION_CLOSE_CODE, sendInvalidSessionAndClose } = await import("./InvalidSession.js");
        const { socket, sent, closes } = createOpenJsonSocket();

        await sendInvalidSessionAndClose(socket);

        assert.deepEqual(sent, [
            {
                op: OPCODES.Invalid_Session,
                d: false,
                s: 17,
            },
        ]);
        assert.equal(INVALID_SESSION_CLOSE_CODE, 1000);
        assert.notEqual(INVALID_SESSION_CLOSE_CODE, 4006);
        assert.deepEqual(closes, [{ code: 1000, reason: undefined }]);
    });
});
