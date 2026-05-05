import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { serializeMessageRoleMentions } from "./MessageRoleMentions";

describe("Message role mentions serializer", () => {
    test("returns role ids instead of role objects", () => {
        assert.deepEqual(serializeMessageRoleMentions([{ id: "role-a" }, { id: "role-b" }]), ["role-a", "role-b"]);
    });

    test("returns an empty array when role mentions are not loaded", () => {
        assert.deepEqual(serializeMessageRoleMentions(undefined), []);
        assert.deepEqual(serializeMessageRoleMentions(null), []);
    });
});
