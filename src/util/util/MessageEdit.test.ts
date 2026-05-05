import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { preserveEditedMessageReactions } from "./MessageEdit";

describe("Message edit helpers", () => {
    test("preserves existing reactions when an edit omits reactions", () => {
        const reactions = [{ count: 1, emoji: { name: "thumb" }, user_ids: ["user_id"] }];

        assert.equal(preserveEditedMessageReactions(reactions, undefined), reactions);
    });

    test("uses explicit incoming reactions when supplied", () => {
        const existing = [{ count: 1, emoji: { name: "thumb" }, user_ids: ["user_id"] }];
        const incoming = [{ count: 2, emoji: { name: "fire" }, user_ids: ["user_id", "other_user_id"] }];

        assert.equal(preserveEditedMessageReactions(existing, incoming), incoming);
    });

    test("defaults missing reactions to an empty array", () => {
        assert.deepEqual(preserveEditedMessageReactions(undefined, undefined), []);
    });
});
