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

function getRoleMemberIdsRouteSource() {
    return fs.readFileSync(path.join(process.cwd(), "src/api/routes/guilds/#guild_id/roles/#role_id/member-ids.ts"), "utf8");
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

    test("keeps the role member id list route unpaginated but capped", () => {
        const source = getRoleMemberIdsRouteSource();

        assert.match(source, /router\.get\(\s*"\/"/);
        assert.ok(source.includes("Member.IsInGuildOrFail(req.user_id, guild_id)"));
        assert.ok(source.includes("MAX_ROLE_MEMBER_IDS = 100"));
        assert.ok(source.includes('order: { id: "ASC" }'));
        assert.ok(source.includes("take: MAX_ROLE_MEMBER_IDS"));
        assert.ok(source.includes("members.map((x) => x.id)"));
        assert.doesNotMatch(source, /\b(limit|after|before)\b/);
        assert.doesNotMatch(source, /\bskip\b/);
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
