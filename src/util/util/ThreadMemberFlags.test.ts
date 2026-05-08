import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ThreadMemberFlags as EntityThreadMemberFlags } from "../entities/ThreadMember";
import { ThreadMemberFlags } from "./ThreadMemberFlags";

describe("ThreadMemberFlags", () => {
    test("keeps Discord thread notification bit values stable", () => {
        assert.equal(ThreadMemberFlags.NONE, 0);
        assert.equal(ThreadMemberFlags.HAS_INTERACTED, 1);
        assert.equal(ThreadMemberFlags.ALL_MESSAGES, 2);
        assert.equal(ThreadMemberFlags.ONLY_MENTIONS, 4);
        assert.equal(ThreadMemberFlags.NO_MESSAGES, 8);
    });

    test("is still re-exported from the ThreadMember entity module", () => {
        assert.equal(EntityThreadMemberFlags.ALL_MESSAGES, ThreadMemberFlags.ALL_MESSAGES);
    });
});
