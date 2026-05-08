import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { calculateRoleMemberChanges } from "./RoleMembers";

const roleId = "role";
const otherRoleId = "other";
const members = [
    { id: "already-desired", role_ids: [roleId] },
    { id: "needs-add", role_ids: [otherRoleId] },
    { id: "needs-remove", role_ids: [roleId, otherRoleId] },
    { id: "unrelated", role_ids: [] },
];

function getRoleMembersRouteSource() {
    return fs.readFileSync(path.join(process.cwd(), "src/api/routes/guilds/#guild_id/roles/#role_id/members.ts"), "utf8");
}

describe("role member update route behavior", () => {
    test("registers PATCH additive and PUT replacement endpoints with the shared schema", () => {
        const source = getRoleMembersRouteSource();

        assert.ok(source.includes('requestBody: "RoleMembersUpdateSchema"'));
        assert.match(source, /router\.patch\(\s*"\/"/);
        assert.match(source, /router\.put\(\s*"\/"/);
        assert.ok(source.includes('updateRoleMembers(req, res, "add")'));
        assert.ok(source.includes('updateRoleMembers(req, res, "replace")'));
    });

    test("persists role membership changes through the bulk member helper", () => {
        const source = getRoleMembersRouteSource();

        assert.ok(source.includes("Member.updateRoleMembers(guild_id, role_id, { addMemberIds, removeMemberIds })"));
        assert.doesNotMatch(source, /Member\.addRole\(/);
        assert.doesNotMatch(source, /Member\.removeRole\(/);
        assert.doesNotMatch(source, /TODO \(erkin\): have a bulk add\/remove function/);
    });

    test("PATCH add mode adds missing desired members without removing omitted current holders", () => {
        const changes = calculateRoleMemberChanges(members, ["already-desired", "needs-add"], roleId, "add");

        assert.deepEqual(changes, {
            addMemberIds: ["needs-add"],
            removeMemberIds: [],
        });
    });

    test("PUT replace mode adds desired missing members and removes omitted current holders", () => {
        const changes = calculateRoleMemberChanges(members, ["already-desired", "needs-add"], roleId, "replace");

        assert.deepEqual(changes, {
            addMemberIds: ["needs-add"],
            removeMemberIds: ["needs-remove"],
        });
    });
});
