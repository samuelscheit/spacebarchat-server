import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getGroupDMOwnerAfterRecipientRemoval } from "./DmChannelOwnership";

describe("getGroupDMOwnerAfterRecipientRemoval", () => {
    test("keeps ownership when a non-owner leaves", () => {
        assert.equal(getGroupDMOwnerAfterRecipientRemoval("owner-id", ["owner-id", "user-2"]), "owner-id");
    });

    test("transfers ownership to a remaining recipient when the owner leaves", () => {
        assert.equal(getGroupDMOwnerAfterRecipientRemoval("owner-id", ["user-1", "user-2"]), "user-1");
    });

    test("chooses a deterministic remaining recipient when transferring ownership", () => {
        assert.equal(getGroupDMOwnerAfterRecipientRemoval("owner-id", ["user-2", "user-1"]), "user-1");
    });

    test("repairs a stale owner that is no longer a recipient", () => {
        assert.equal(getGroupDMOwnerAfterRecipientRemoval("1", ["user-2", "user-1"]), "user-1");
    });

    test("repairs a missing owner", () => {
        assert.equal(getGroupDMOwnerAfterRecipientRemoval(undefined, ["user-2", "user-1"]), "user-1");
    });

    test("does not assign an owner without remaining recipients", () => {
        assert.equal(getGroupDMOwnerAfterRecipientRemoval("owner-id", []), undefined);
    });
});
