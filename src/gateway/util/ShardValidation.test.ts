import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseGatewayShard } from "./ShardValidation";

describe("gateway shard validation", () => {
    test("accepts zero-based shard ids inside the declared shard count", () => {
        assert.deepEqual(parseGatewayShard([0, 1]), { shard_id: 0n, shard_count: 1n });
        assert.deepEqual(parseGatewayShard([1n, 2n]), { shard_id: 1n, shard_count: 2n });
    });

    test("rejects the shard count as a shard id", () => {
        assert.equal(parseGatewayShard([1, 1]), undefined);
        assert.equal(parseGatewayShard([2n, 2n]), undefined);
    });

    test("rejects malformed shard arrays", () => {
        assert.equal(parseGatewayShard(undefined), undefined);
        assert.equal(parseGatewayShard([0]), undefined);
        assert.equal(parseGatewayShard([0, 1, 2]), undefined);
    });

    test("rejects non-integer shard values", () => {
        assert.equal(parseGatewayShard([0.5, 1]), undefined);
        assert.equal(parseGatewayShard([0, Number.NaN]), undefined);
        assert.equal(parseGatewayShard([false, 1]), undefined);
        assert.equal(parseGatewayShard(["0.5", "1"]), undefined);
    });

    test("rejects negative shard ids and non-positive shard counts", () => {
        assert.equal(parseGatewayShard([-1, 1]), undefined);
        assert.equal(parseGatewayShard([0, 0]), undefined);
        assert.equal(parseGatewayShard([0, -1]), undefined);
    });
});
