import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Capabilities } from "./Capabilities";

describe("gateway capabilities", () => {
    test("declares the message reaction debounce capability", () => {
        assert.equal(Capabilities.FLAGS.DEBOUNCE_MESSAGE_REACTIONS, BigInt(1) << BigInt(13));
        assert.equal(new Capabilities(Capabilities.FLAGS.DEBOUNCE_MESSAGE_REACTIONS).has("DEBOUNCE_MESSAGE_REACTIONS"), true);
    });
});
