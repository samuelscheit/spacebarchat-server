import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { CLOSECODES, OPCODES } from "./Constants";
import { createInvalidSessionPayload, sendInvalidSessionAndClose } from "./InvalidSessionPayload";
import type { WebSocket } from "./WebSocket";

function createJsonSocket(
    sendImpl: (buffer: string | Buffer, callback: (error?: Error) => void) => void = (_buffer, callback) => callback(),
): WebSocket & { closedWith?: number; sent: unknown[] } {
    const sent: unknown[] = [];
    let closedWith: number | undefined;

    return {
        OPEN: 1,
        readyState: 1,
        encoding: "json",
        compress: undefined,
        sent,
        get closedWith() {
            return closedWith;
        },
        close(code?: number) {
            closedWith = code;
        },
        send(buffer: string | Buffer, callback: (error?: Error) => void) {
            sent.push(JSON.parse(buffer.toString()));
            sendImpl(buffer, callback);
        },
    } as unknown as WebSocket & { closedWith?: number; sent: unknown[] };
}

describe("createInvalidSessionPayload", () => {
    test("builds non-resumable invalid-session payloads by default", () => {
        assert.deepEqual(createInvalidSessionPayload(), {
            op: OPCODES.Invalid_Session,
            d: false,
        });
    });

    test("can explicitly mark an invalid session as resumable", () => {
        assert.deepEqual(createInvalidSessionPayload(true), {
            op: OPCODES.Invalid_Session,
            d: true,
        });
    });

    test("sends a non-resumable invalid-session payload before closing", async () => {
        const socket = createJsonSocket();

        await sendInvalidSessionAndClose(socket);

        assert.deepEqual(socket.sent, [
            {
                op: OPCODES.Invalid_Session,
                d: false,
            },
        ]);
        assert.equal(socket.closedWith, CLOSECODES.Invalid_session);
    });

    test("still closes the socket if sending the invalid-session payload fails", async () => {
        const socket = createJsonSocket((_buffer, callback) => callback(new Error("send failed")));

        await assert.rejects(() => sendInvalidSessionAndClose(socket), /send failed/);

        assert.equal(socket.closedWith, CLOSECODES.Invalid_session);
    });
});
