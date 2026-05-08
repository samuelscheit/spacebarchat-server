import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { serializeMemberRoleIds, serializePublicMember } from "./MemberRoles";

describe("Member role serialization", () => {
    test("serializes role entities to role ids", () => {
        assert.deepEqual(serializeMemberRoleIds([{ id: "role-a" }, { id: "role-b" }]), ["role-a", "role-b"]);
    });

    test("preserves already serialized role ids", () => {
        assert.deepEqual(serializeMemberRoleIds(["role-a", "role-b"]), ["role-a", "role-b"]);
    });

    test("normalizes plain public member role entities to role ids", () => {
        const publicMember = serializePublicMember({ id: "user-a", guild_id: "guild-a", roles: [{ id: "role-a" }, { id: "role-b" }] });

        assert.deepEqual(publicMember?.roles, ["role-a", "role-b"]);
    });
});
