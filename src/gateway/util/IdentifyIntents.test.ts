import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DEFAULT_IDENTIFY_INTENTS, resolveIdentifyIntents } from "./IdentifyIntents";

describe("resolveIdentifyIntents", () => {
    test("uses the legacy default only when intents are omitted", () => {
        assert.equal(resolveIdentifyIntents(undefined), DEFAULT_IDENTIFY_INTENTS);
    });

    test("preserves an explicit zero-intent identify payload", () => {
        assert.equal(resolveIdentifyIntents(0n), 0n);
    });

    test("preserves explicit non-zero intents", () => {
        assert.equal(resolveIdentifyIntents(1n << 12n), 1n << 12n);
    });
});
