import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { calculateRoleMemberChanges } from "./RoleMembers";

const roleId = "role";
const otherRoleId = "other";
const members = [
    { id: "already-desired", roles: [{ id: roleId }] },
    { id: "needs-add", roles: [{ id: otherRoleId }] },
    { id: "needs-remove", roles: [{ id: roleId }, { id: otherRoleId }] },
    { id: "unrelated", roles: [] },
];

function getRoleMembersRouteSource() {
    return fs.readFileSync(path.join(process.cwd(), "src/api/routes/guilds/#guild_id/roles/#role_id/members.ts"), "utf8");
}

describe("role member update route behavior", () => {
    test("registers PATCH additive and PUT replacement endpoints with the shared schema", () => {
        const source = getRoleMembersRouteSource();

        assert.ok(source.includes('requestBody: "RoleMembersUpdateSchema"'));
        assert.ok(source.includes('router.patch("/", routeOptions, (req: Request, res: Response) => updateRoleMembers(req, res, "add"));'));
        assert.ok(source.includes('router.put("/", routeOptions, (req: Request, res: Response) => updateRoleMembers(req, res, "replace"));'));
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
