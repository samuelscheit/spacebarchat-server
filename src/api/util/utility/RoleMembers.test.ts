import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
    calculateRoleMemberAdditions,
    calculateRoleMemberReplacement,
    getMissingRoleMemberIds,
    getRoleMemberIdsToAdd,
    getRoleMemberIdsToRemove,
    normalizeRoleMemberPatchIds,
} from "./RoleMembers";

describe("role member helpers", () => {
    const roleId = "role";
    const otherRoleId = "other";
    const members = [
        { id: "already-desired", role_ids: [roleId] },
        { id: "needs-add", role_ids: [otherRoleId] },
        { id: "needs-remove", role_ids: [roleId, otherRoleId] },
        { id: "unrelated", role_ids: [] },
    ];

    test("deduplicates patch member ids", () => {
        assert.deepEqual(normalizeRoleMemberPatchIds(["2", "1", "2"]), ["2", "1"]);
    });

    test("accepts an empty patch member id list", () => {
        assert.deepEqual(normalizeRoleMemberPatchIds([]), []);
    });

    test("rejects non-string patch member ids", () => {
        assert.throws(() => normalizeRoleMemberPatchIds(["1", 2]), TypeError);
        assert.throws(() => normalizeRoleMemberPatchIds("1"), TypeError);
        assert.throws(() => normalizeRoleMemberPatchIds(undefined), TypeError);
    });

    test("returns only requested members missing the role", () => {
        assert.deepEqual(getRoleMemberIdsToAdd(members, ["already-desired", "needs-add", "unrelated"], roleId), ["needs-add", "unrelated"]);
    });

    test("does not treat omitted existing role members as removals for additive helpers", () => {
        assert.deepEqual(getRoleMemberIdsToAdd(members, [], roleId), []);
    });

    test("returns requested member ids missing from the guild member query", () => {
        assert.deepEqual(
            getMissingRoleMemberIds(
                [
                    { id: "2", role_ids: [] },
                    { id: "4", role_ids: [] },
                ],
                ["1", "2", "3", "4"],
            ),
            ["1", "3"],
        );
    });

    test("PATCH additions add missing desired members without removing omitted current holders", () => {
        const changes = calculateRoleMemberAdditions(members, ["already-desired", "needs-add"], roleId);

        assert.deepEqual(changes, {
            addMemberIds: ["needs-add"],
            removeMemberIds: [],
        });
    });

    test("PATCH additions keep existing holders that were omitted", () => {
        const changes = calculateRoleMemberAdditions(members, ["needs-add"], roleId);

        assert.deepEqual(changes, {
            addMemberIds: ["needs-add"],
            removeMemberIds: [],
        });
    });

    test("PATCH additions deduplicate desired member ids through set semantics", () => {
        const changes = calculateRoleMemberAdditions(members, ["needs-add", "needs-add"], roleId);

        assert.deepEqual(changes, {
            addMemberIds: ["needs-add"],
            removeMemberIds: [],
        });
    });

    test("returns current role holders omitted from a replacement request", () => {
        assert.deepEqual(getRoleMemberIdsToRemove(members, ["already-desired", "needs-add"], roleId), ["needs-remove"]);
    });

    test("PUT replacement adds missing desired members and removes omitted current holders", () => {
        const changes = calculateRoleMemberReplacement(members, ["already-desired", "needs-add"], roleId);

        assert.deepEqual(changes, {
            addMemberIds: ["needs-add"],
            removeMemberIds: ["needs-remove"],
        });
    });

    test("PUT replacement keeps desired current holders and unrelated non-holders unchanged", () => {
        const changes = calculateRoleMemberReplacement(members, ["already-desired"], roleId);

        assert.equal(changes.addMemberIds.includes("already-desired"), false);
        assert.equal(changes.removeMemberIds.includes("already-desired"), false);
        assert.equal(changes.removeMemberIds.includes("unrelated"), false);
    });

    test("replacement deduplicates desired member ids through set semantics", () => {
        const changes = calculateRoleMemberReplacement(members, ["needs-add", "needs-add"], roleId);

        assert.deepEqual(changes.addMemberIds, ["needs-add"]);
    });

    test("empty PUT replacement desired list removes only current role holders", () => {
        const changes = calculateRoleMemberReplacement(members, [], roleId);

        assert.deepEqual(changes, {
            addMemberIds: [],
            removeMemberIds: ["already-desired", "needs-remove"],
        });
    });
});
