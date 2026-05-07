import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ExactArray, instanceOf } from "./check";

describe("instanceOf array validation", () => {
    test("allows an optional typed array property to be absent", () => {
        assert.equal(instanceOf({ $items: [Number] }, {}), true);
    });

    test("rejects null entries in a present optional typed array property", () => {
        assert.throws(() => instanceOf({ $items: [Number] }, { items: [1, null] }), /.items\[1\] is required/);
    });

    test("allows an optional exact array property to be absent", () => {
        assert.equal(instanceOf({ $size: new ExactArray(Number, Number) }, {}), true);
    });

    test("rejects null entries in a present optional exact array property", () => {
        assert.throws(() => instanceOf({ $size: new ExactArray(Number, Number) }, { size: [1, null] }), /.size\[1\] is required/);
    });
});
