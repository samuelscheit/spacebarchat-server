import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { memberRequiresSelfLeaveRight } from "./index";

describe("guild member delete self-leave rights", () => {
    test("requires SELF_LEAVE_GROUPS for memberships without force-add provenance", () => {
        assert.equal(memberRequiresSelfLeaveRight(undefined), true);
        assert.equal(memberRequiresSelfLeaveRight(null), true);
        assert.equal(memberRequiresSelfLeaveRight({ joined_by: "" }), true);
    });

    test("does not require SELF_LEAVE_GROUPS for force-added memberships", () => {
        assert.equal(memberRequiresSelfLeaveRight({ joined_by: "admin-user-id" }), false);
    });
});
