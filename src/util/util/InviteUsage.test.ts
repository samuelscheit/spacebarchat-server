import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { consumeInviteUse } from "./InviteUsage";

describe("consumeInviteUse", () => {
    test("keeps unlimited invites after recording a use", () => {
        const invite = { uses: 10, max_uses: 0 };

        assert.equal(consumeInviteUse(invite), false);
        assert.equal(invite.uses, 11);
    });

    test("deletes one-use invites on the first valid use", () => {
        const invite = { uses: 0, max_uses: 1 };

        assert.equal(consumeInviteUse(invite), true);
        assert.equal(invite.uses, 1);
    });

    test("deletes limited invites on the final valid use", () => {
        const invite = { uses: 4, max_uses: 5 };

        assert.equal(consumeInviteUse(invite), true);
        assert.equal(invite.uses, 5);
    });

    test("keeps limited invites before the final use", () => {
        const invite = { uses: 3, max_uses: 5 };

        assert.equal(consumeInviteUse(invite), false);
        assert.equal(invite.uses, 4);
    });
});
