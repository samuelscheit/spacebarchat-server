import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getGroupDMOwnerAfterRecipientRemoval, saveGroupDMOwnerAfterRecipientRemoval } from "./DmChannelOwnership";

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

describe("saveGroupDMOwnerAfterRecipientRemoval", () => {
    test("skips saving when the current owner is still valid", async () => {
        const channel = {
            owner_id: "owner-id",
            save: async () => {
                throw new Error("should not save");
            },
        };

        assert.equal(await saveGroupDMOwnerAfterRecipientRemoval(channel, ["owner-id", "user-1"]), false);
        assert.equal(channel.owner_id, "owner-id");
    });

    test("persists a normalized owner before reporting a change", async () => {
        const saves: string[] = [];
        const channel = {
            owner_id: "1",
            save: async () => {
                saves.push(channel.owner_id);
            },
        };

        assert.equal(await saveGroupDMOwnerAfterRecipientRemoval(channel, ["user-2", "user-1"]), true);
        assert.equal(channel.owner_id, "user-1");
        assert.deepEqual(saves, ["user-1"]);
    });

    test("does not report a change when owner persistence fails", async () => {
        const channel = {
            owner_id: "1",
            save: async () => {
                throw new Error("save failed");
            },
        };

        await assert.rejects(() => saveGroupDMOwnerAfterRecipientRemoval(channel, ["user-1"]), /save failed/);
        assert.equal(channel.owner_id, "user-1");
    });
});
