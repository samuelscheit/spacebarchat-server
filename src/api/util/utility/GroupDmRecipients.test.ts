import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DiscordApiErrors } from "../../../util/util/Constants";
import { assertExistingGroupDmRecipient } from "./GroupDmRecipients";

describe("group DM recipient validation", () => {
    test("accepts an existing group DM recipient", () => {
        assert.doesNotThrow(() => assertExistingGroupDmRecipient([{ user_id: "owner-id" }, { user_id: "member-id" }], "member-id"));
    });

    test("rejects a target user that is not a group DM recipient as an invalid recipient", () => {
        assert.throws(
            () => assertExistingGroupDmRecipient([{ user_id: "owner-id" }, { user_id: "member-id" }], "missing-id"),
            (error) => error === DiscordApiErrors.INVALID_RECIPIENT,
        );
    });

    test("rejects missing recipient relations as invalid recipients", () => {
        assert.throws(
            () => assertExistingGroupDmRecipient(undefined, "missing-id"),
            (error) => error === DiscordApiErrors.INVALID_RECIPIENT,
        );
    });
});
