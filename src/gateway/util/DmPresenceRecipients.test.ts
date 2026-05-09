import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getOpenDmPresenceRecipientIds } from "./DmPresenceRecipients";

describe("getOpenDmPresenceRecipientIds", () => {
    test("keeps open non-self recipients", () => {
        assert.deepEqual([...getOpenDmPresenceRecipientIds([{ user_id: "self" }, { user_id: "friend-a", closed: false }, { user_id: "friend-b" }], "self")].sort(), [
            "friend-a",
            "friend-b",
        ]);
    });

    test("excludes self and recipients that no longer have the DM open", () => {
        assert.deepEqual(
            [
                ...getOpenDmPresenceRecipientIds(
                    [
                        { user_id: "self", closed: false },
                        { user_id: "closed-friend", closed: true },
                        { user_id: "open-friend", closed: false },
                    ],
                    "self",
                ),
            ],
            ["open-friend"],
        );
    });

    test("handles missing recipient relations as no dispatch targets", () => {
        assert.deepEqual([...getOpenDmPresenceRecipientIds(undefined, "self")], []);
    });
});
