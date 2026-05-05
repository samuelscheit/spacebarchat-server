import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { bigintNumberTransformer } from "./DatabaseTransformers";

describe("database transformers", () => {
    test("converts hydrated bigint values to numbers", () => {
        const transformed = bigintNumberTransformer.from("64");

        assert.equal(transformed, 64);
        assert.equal(typeof transformed, "number");
    });

    test("passes numbers and empty values through", () => {
        assert.equal(bigintNumberTransformer.from(0), 0);
        assert.equal(bigintNumberTransformer.from(null), null);
        assert.equal(bigintNumberTransformer.from(undefined), undefined);
        assert.equal(bigintNumberTransformer.to(64), 64);
    });
});
