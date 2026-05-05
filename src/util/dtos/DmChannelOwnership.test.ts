import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getGroupDMOwnerAfterRecipientRemoval } from "./DmChannelOwnership";

describe("getGroupDMOwnerAfterRecipientRemoval", () => {
    test("keeps ownership when a non-owner leaves", () => {
        assert.equal(getGroupDMOwnerAfterRecipientRemoval("owner-id", "user-id", ["owner-id", "user-2"]), "owner-id");
    });

    test("transfers ownership to a remaining recipient when the owner leaves", () => {
        assert.equal(getGroupDMOwnerAfterRecipientRemoval("owner-id", "owner-id", ["user-1", "user-2"]), "user-1");
    });
});
