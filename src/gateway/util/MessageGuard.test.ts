import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CLOSECODES } from "./Constants";
import { createGatewayMessageGuard, createGatewayMessageHandler, getGatewayRawDataByteLength, getGatewayTransportMaxPayload, normalizeGatewayMessageLimits } from "./MessageGuard";
import type { WebSocket } from "./WebSocket";

function createSocket() {
    const calls: { code: number; reason?: string }[] = [];
    return {
        socket: {
            close(code: number, reason?: string) {
                calls.push({ code, reason });
            },
        } as WebSocket,
        calls,
    };
}

describe("GatewayMessageGuard", () => {
    it("uses Discord-compatible defaults with partial config", () => {
        assert.deepEqual(normalizeGatewayMessageLimits({ rateLimitCount: 1 }), {
            maxMessageSize: 15 * 1024,
            rateLimitCount: 1,
            rateLimitWindow: 60_000,
        });
    });

    it("uses the normalized gateway message size as the transport cap", () => {
        assert.equal(getGatewayTransportMaxPayload(), 15 * 1024);
        assert.equal(getGatewayTransportMaxPayload({ maxMessageSize: 4096 }), 4096);
        assert.equal(getGatewayTransportMaxPayload({ rateLimitCount: 1 }), 15 * 1024);
    });

    it("calculates raw message sizes", () => {
        assert.equal(getGatewayRawDataByteLength("abc"), 3);
        assert.equal(getGatewayRawDataByteLength(Buffer.from("abc")), 3);
        assert.equal(getGatewayRawDataByteLength(new Uint8Array([1, 2, 3]).buffer), 3);
        assert.equal(getGatewayRawDataByteLength([Buffer.from("ab"), Buffer.from("cd")]), 4);
    });

    it("closes oversized messages before dispatch", () => {
        const { socket, calls } = createSocket();
        const guard = createGatewayMessageGuard({
            maxMessageSize: 2,
            rateLimitCount: 10,
            rateLimitWindow: 1000,
        });

        assert.equal(guard(socket, Buffer.from("abc")), false);
        assert.deepEqual(calls, [
            {
                code: CLOSECODES.Decode_error,
                reason: "Gateway message exceeds maximum size",
            },
        ]);
    });

    it("closes messages over the configured rate limit", () => {
        const { socket, calls } = createSocket();
        const guard = createGatewayMessageGuard({
            maxMessageSize: 10,
            rateLimitCount: 2,
            rateLimitWindow: 1000,
        });

        assert.equal(guard(socket, Buffer.from("{}"), 1000), true);
        assert.equal(guard(socket, Buffer.from("{}"), 1100), true);
        assert.equal(guard(socket, Buffer.from("{}"), 1200), false);
        assert.deepEqual(calls, [
            {
                code: CLOSECODES.Rate_limited,
                reason: "Gateway message rate limit exceeded",
            },
        ]);
    });

    it("forgets messages outside the configured rate window", () => {
        const { socket, calls } = createSocket();
        const guard = createGatewayMessageGuard({
            maxMessageSize: 10,
            rateLimitCount: 2,
            rateLimitWindow: 1000,
        });

        assert.equal(guard(socket, Buffer.from("{}"), 1000), true);
        assert.equal(guard(socket, Buffer.from("{}"), 1100), true);
        assert.equal(guard(socket, Buffer.from("{}"), 2101), true);
        assert.deepEqual(calls, []);
    });

    it("does not dispatch blocked messages", async () => {
        const { socket } = createSocket();
        let dispatched = false;
        const handler = createGatewayMessageHandler(
            socket,
            () => {
                dispatched = true;
            },
            {
                maxMessageSize: 2,
                rateLimitCount: 10,
                rateLimitWindow: 1000,
            },
        );

        await handler(Buffer.from("abc"));

        assert.equal(dispatched, false);
    });

    it("dispatches allowed messages", async () => {
        const { socket } = createSocket();
        let dispatched = false;
        const handler = createGatewayMessageHandler(
            socket,
            () => {
                dispatched = true;
            },
            {
                maxMessageSize: 10,
                rateLimitCount: 10,
                rateLimitWindow: 1000,
            },
        );

        await handler(Buffer.from("{}"));

        assert.equal(dispatched, true);
    });
});
