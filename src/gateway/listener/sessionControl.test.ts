import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { EventOpts } from "@spacebar/util";
import { CLOSECODES, OPCODES } from "../util/Constants";
import type { WebSocket } from "../util/WebSocket";
import { handlePreDispatchGatewayEvent, handleSessionControlEvent } from "./sessionControl";

function createJsonSocket(sequence = 0, sessionId = "session"): WebSocket & { closedWith?: number; sent: unknown[] } {
    const sent: unknown[] = [];
    let closedWith: number | undefined;

    return {
        OPEN: 1,
        readyState: 1,
        encoding: "json",
        compress: undefined,
        sequence,
        events: {
            [sessionId]: async () => undefined,
        },
        recentTransactions: [],
        sent,
        get closedWith() {
            return closedWith;
        },
        close(code?: number) {
            closedWith = code;
        },
        send(buffer: string | Buffer, callback: (error?: Error) => void) {
            sent.push(JSON.parse(buffer.toString()));
            callback();
        },
    } as unknown as WebSocket & { closedWith?: number; sent: unknown[] };
}

describe("handlePreDispatchGatewayEvent", () => {
    for (const data of [undefined, null] as const) {
        test(`handles subscribed SB_SESSION_REMOVE with ${data === null ? "null" : "undefined"} data before normal event dispatch`, async () => {
            const socket = createJsonSocket(12);
            let acknowledged = false;

            const handled = await handlePreDispatchGatewayEvent(socket, {
                event: "SB_SESSION_REMOVE",
                session_id: "session",
                data,
                acknowledge() {
                    acknowledged = true;
                },
                cancel: () => undefined,
            } as EventOpts);

            assert.equal(handled, true);
            assert.equal(acknowledged, true);
            assert.equal(socket.sequence, 12);
            assert.deepEqual(socket.sent, [
                {
                    op: OPCODES.Invalid_Session,
                    d: false,
                },
            ]);
            assert.equal(socket.closedWith, CLOSECODES.Invalid_session);
        });
    }

    test("ignores session controls for unsubscribed event routes", async () => {
        const socket = createJsonSocket();
        let acknowledged = false;

        const handled = await handlePreDispatchGatewayEvent(socket, {
            event: "SB_SESSION_REMOVE",
            session_id: "other-session",
            acknowledge() {
                acknowledged = true;
            },
            cancel: () => undefined,
        } as EventOpts);

        assert.equal(handled, true);
        assert.equal(acknowledged, true);
        assert.deepEqual(socket.sent, []);
        assert.equal(socket.closedWith, undefined);
    });
});

describe("handleSessionControlEvent", () => {
    test("handles no-data session removals", async () => {
        const socket = createJsonSocket(12);

        const handled = await handleSessionControlEvent(socket, { event: "SB_SESSION_REMOVE" });

        assert.equal(handled, true);
        assert.equal(socket.sequence, 12);
        assert.deepEqual(socket.sent, [
            {
                op: OPCODES.Invalid_Session,
                d: false,
            },
        ]);
        assert.equal(socket.closedWith, CLOSECODES.Invalid_session);
    });

    test("handles session close events without requiring gateway event data", async () => {
        const socket = createJsonSocket(4);

        const handled = await handleSessionControlEvent(socket, {
            event: "SB_SESSION_CLOSE",
            reconnect_delay: 2500,
        });

        assert.equal(handled, true);
        assert.equal(socket.sequence, 5);
        assert.deepEqual(socket.sent, [
            {
                op: OPCODES.Reconnect,
                s: 4,
                d: 2500,
            },
        ]);
        assert.equal(socket.closedWith, 1000);
    });

    test("leaves regular gateway events for the listener dispatcher", async () => {
        const socket = createJsonSocket();

        const handled = await handleSessionControlEvent(socket, {
            event: "MESSAGE_CREATE",
            data: { id: "message" },
        });

        assert.equal(handled, false);
        assert.deepEqual(socket.sent, []);
        assert.equal(socket.closedWith, undefined);
    });
});
