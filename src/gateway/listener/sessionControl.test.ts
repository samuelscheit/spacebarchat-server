import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { EventOpts } from "@spacebar/util";
import { CLOSECODES, OPCODES } from "../util/Constants";
import { INVALID_SESSION_CLOSE_CODE } from "../util/InvalidSessionPayload";
import type { WebSocket } from "../util/WebSocket";
import { handlePreDispatchGatewayEvent, handleSessionControlEvent } from "./sessionControl";

function createJsonSocket(sequence = 0, sessionId = "session"): WebSocket & { closedReason?: string; closedWith?: number; sent: unknown[] } {
    const sent: unknown[] = [];
    let closedWith: number | undefined;
    let closedReason: string | undefined;

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
        get closedReason() {
            return closedReason;
        },
        close(code?: number, reason?: string) {
            closedWith = code;
            closedReason = reason;
        },
        send(buffer: string | Buffer, callback: (error?: Error) => void) {
            sent.push(JSON.parse(buffer.toString()));
            callback();
        },
    } as unknown as WebSocket & { closedReason?: string; closedWith?: number; sent: unknown[] };
}

describe("handlePreDispatchGatewayEvent", () => {
    test("acknowledges and closes invalidated tokens before reading dispatch data", async () => {
        const socket = createJsonSocket(7);
        let acknowledged = false;
        const event = {
            event: "INVALIDATED" as const,
            session_id: "session",
            acknowledge() {
                acknowledged = true;
            },
            cancel: () => undefined,
            get data(): never {
                throw new Error("control events must not read dispatch data");
            },
        };

        const handled = await handlePreDispatchGatewayEvent(socket, event as EventOpts);

        assert.equal(handled, true);
        assert.equal(acknowledged, true);
        assert.deepEqual(socket.sent, []);
        assert.equal(socket.sequence, 7);
        assert.equal(socket.closedWith, CLOSECODES.Authentication_failed);
        assert.equal(socket.closedReason, "Invalidated Token");
    });

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
            assert.equal(socket.closedWith, INVALID_SESSION_CLOSE_CODE);
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

    test("deduplicates repeated gateway transactions before dispatch", async () => {
        const socket = createJsonSocket();
        let acknowledgements = 0;
        const event = {
            event: "MESSAGE_CREATE" as const,
            transaction_id: "transaction",
            data: { id: "message" },
            acknowledge() {
                acknowledgements++;
            },
            cancel: () => undefined,
        };

        assert.equal(await handlePreDispatchGatewayEvent(socket, event as EventOpts), false);
        assert.deepEqual(socket.recentTransactions, ["transaction"]);
        assert.equal(await handlePreDispatchGatewayEvent(socket, event as EventOpts), true);
        assert.deepEqual(socket.recentTransactions, ["transaction"]);
        assert.equal(acknowledgements, 2);
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
        assert.equal(socket.closedWith, INVALID_SESSION_CLOSE_CODE);
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
