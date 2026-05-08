import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { instanceOf } from "lambert-server";
import { PayloadSchema } from "./PayloadSchema";

describe("gateway PayloadSchema", () => {
    test("accepts gateway envelope payload shapes handled by Message", () => {
        assert.equal(instanceOf(PayloadSchema, { op: 2, d: { token: "token" } }, { path: "body" }), true);
        assert.equal(instanceOf(PayloadSchema, { op: 1, d: 123 }, { path: "body" }), true);
        assert.equal(instanceOf(PayloadSchema, { op: 1, d: null }, { path: "body" }), true);
        assert.equal(instanceOf(PayloadSchema, { op: 1 }, { path: "body" }), true);
        assert.equal(instanceOf(PayloadSchema, { op: 0, s: 42, t: "READY", d: {} }, { path: "body" }), true);
    });

    test("rejects unsupported gateway envelope shapes", () => {
        assert.throws(() => instanceOf(PayloadSchema, { d: {} }, { path: "body" }), /body\.op is required/);
        assert.throws(() => instanceOf(PayloadSchema, { op: 1, d: "not-a-number" }, { path: "body" }), /body\.d must be one of/);
        assert.throws(() => instanceOf(PayloadSchema, { op: 1, unexpected: true }, { path: "body" }), /Unknown key unexpected/);
    });
});
