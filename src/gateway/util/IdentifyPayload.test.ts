import assert from "node:assert/strict";
import test from "node:test";
import { DefaultIdentifyIntents, toIdentifyIntents, toIdentifyShard } from "./IdentifyPayload";

test("toIdentifyIntents normalizes numeric and string gateway intent bitfields to bigint", () => {
    assert.equal(toIdentifyIntents(undefined), DefaultIdentifyIntents);
    assert.equal(toIdentifyIntents(0), 0n);
    assert.equal(toIdentifyIntents(513), 513n);
    assert.equal(toIdentifyIntents("1099511627776"), 1099511627776n);
});

test("toIdentifyShard normalizes numeric and string shard tuple values to bigint", () => {
    assert.deepEqual(toIdentifyShard([0, 2]), [0n, 2n]);
    assert.deepEqual(toIdentifyShard(["1", "16"]), [1n, 16n]);
});
