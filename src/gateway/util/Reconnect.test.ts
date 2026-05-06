import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { OPCODES } from "./Constants";
import { createReconnectPayload } from "./ReconnectPayload";

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
});
