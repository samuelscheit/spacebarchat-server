import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { assertCanManageRole, canManageRole, getHighestRolePosition, resolveCreatedRolePermissions } from "./RolePermissions";

describe("created role permissions", () => {
    test("inherits @everyone permissions when create payload omits permissions", () => {
        assert.equal(resolveCreatedRolePermissions({ everyone: "64", actor: 127n }), "64");
    });

    test("inherits @everyone permissions when clients send zero permissions on create", () => {
        assert.equal(resolveCreatedRolePermissions({ requested: "0", everyone: "64", actor: 127n }), "64");
    });

    test("caps requested permissions to the creator permissions", () => {
        assert.equal(resolveCreatedRolePermissions({ requested: "7", everyone: "64", actor: 5n }), "5");
    });
});

describe("role hierarchy", () => {
    test("allows the guild owner to manage any role", () => {
        assert.equal(
            canManageRole({
                actorId: "owner",
                guildOwnerId: "owner",
                actorRoles: [],
                targetRole: { id: "admin", position: 100 },
            }),
            true,
        );
    });

    test("allows members whose highest role is above the target role", () => {
        assert.equal(
            canManageRole({
                actorId: "moderator",
                guildOwnerId: "owner",
                actorRoles: [
                    { id: "lower", position: 1 },
                    { id: "higher", position: 3 },
                ],
                targetRole: { id: "target", position: 2 },
            }),
            true,
        );
    });

    test("does not grant owner bypass for ownerless guilds", () => {
        assert.equal(
            canManageRole({
                actorId: "member",
                guildOwnerId: undefined,
                actorRoles: [{ id: "lower", position: 1 }],
                targetRole: { id: "target", position: 2 },
            }),
            false,
        );
    });

    test("denies members at the same hierarchy position as the target role", () => {
        assert.equal(
            canManageRole({
                actorId: "moderator",
                guildOwnerId: "owner",
                actorRoles: [{ id: "peer", position: 2 }],
                targetRole: { id: "target", position: 2 },
            }),
            false,
        );
    });

    test("denies members whose highest role is below the target role", () => {
        assert.equal(
            canManageRole({
                actorId: "moderator",
                guildOwnerId: "owner",
                actorRoles: [{ id: "lower", position: 1 }],
                targetRole: { id: "target", position: 2 },
            }),
            false,
        );
    });

    test("treats members with no roles as below every role", () => {
        assert.equal(getHighestRolePosition([]), Number.NEGATIVE_INFINITY);
        assert.throws(
            () =>
                assertCanManageRole({
                    actorId: "member",
                    guildOwnerId: "owner",
                    actorRoles: [],
                    targetRole: { id: "everyone", position: 0 },
                }),
            (error) => (error as { code?: number }).code === 50013,
        );
    });
});
