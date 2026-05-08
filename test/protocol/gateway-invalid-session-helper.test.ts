import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { INVALID_SESSION_CLOSE_CODE, OPCODES, sendInvalidSession, sendInvalidSessionAndClose, type Payload, type WebSocket } from "@spacebar/gateway";

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

describe("gateway invalid-session helpers", () => {
    test("sends a non-resumable opcode 9 invalid-session payload by default", async () => {
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

    test("still closes normally if the invalid-session send fails", async () => {
        const sent: Payload[] = [];
        const closes: { code?: number; reason?: string }[] = [];
        const socket = {
            OPEN: 1,
            readyState: 1,
            encoding: "json",
            sequence: 23,
            send(data: string, callback: (err?: Error) => void) {
                sent.push(JSON.parse(data) as Payload);
                callback(new Error("write failed"));
            },
            close(code?: number, reason?: string) {
                closes.push({ code, reason });
            },
        } as unknown as WebSocket;

        await assert.rejects(sendInvalidSessionAndClose(socket), /write failed/);

        assert.deepEqual(sent, [
            {
                op: OPCODES.Invalid_Session,
                d: false,
                s: 23,
            },
        ]);
        assert.equal(socket.sequence, 24);
        assert.deepEqual(closes, [{ code: INVALID_SESSION_CLOSE_CODE, reason: undefined }]);
    });
});
