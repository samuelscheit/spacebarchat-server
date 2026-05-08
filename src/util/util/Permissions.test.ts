import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { ChannelPermissionOverwrite } from "@spacebar/schemas";
import { PublicMemberProjection } from "../../schemas/api/users/Member";
import type { Member, Role } from "../entities";
import { getPermissionMemberQueryOptions, Permissions, PUBLIC_MESSAGE_PERMISSION_MEMBER_SELECT } from "./Permissions";

const CHANNEL_PERMISSION_OVERWRITE_ROLE = 0;
const USER_FLAG_QUARANTINED = Number(1n << 44n);

function adminRole() {
    return {
        id: "admin_role",
        permissions: Permissions.FLAGS.ADMINISTRATOR.toString(),
    } as Role;
}

function finalAdminPermission({
    communicationDisabledUntil = null,
    flags = 0,
    overwrites,
}: {
    communicationDisabledUntil?: Date | null;
    flags?: number;
    overwrites?: ChannelPermissionOverwrite[];
} = {}) {
    return Permissions.finalPermission({
        user: {
            id: "user_id",
            roles: ["admin_role"],
            communication_disabled_until: communicationDisabledUntil,
            flags,
        },
        guild: {
            id: "guild_id",
            owner_id: "owner_id",
            roles: [adminRole()],
        },
        channel: overwrites ? { overwrites } : undefined,
    });
}

function adminDenyOverwrite(): ChannelPermissionOverwrite {
    return {
        id: "admin_role",
        type: CHANNEL_PERMISSION_OVERWRITE_ROLE,
        allow: "0",
        deny: (Permissions.FLAGS.VIEW_CHANNEL | Permissions.FLAGS.SEND_MESSAGES | Permissions.FLAGS.ADMINISTRATOR).toString(),
    };
}

describe("Permissions", () => {
    test("channel overwrites cannot deny administrator permissions", () => {
        const permissions = new Permissions(
            Permissions.channelPermission(
                [
                    {
                        ...adminDenyOverwrite(),
                        id: "role_id",
                    },
                ],
                Permissions.FLAGS.ADMINISTRATOR,
            ),
        );

        assert.equal(permissions.has("ADMINISTRATOR", false), true);
        assert.equal(permissions.has("VIEW_CHANNEL", false), true);
        assert.equal(permissions.has("SEND_MESSAGES", false), true);
    });

    test("channel overwrites still deny non-administrator permissions", () => {
        const permissions = new Permissions(
            Permissions.channelPermission(
                [
                    {
                        id: "role_id",
                        type: CHANNEL_PERMISSION_OVERWRITE_ROLE,
                        allow: "0",
                        deny: Permissions.FLAGS.SEND_MESSAGES.toString(),
                    },
                ],
                Permissions.FLAGS.VIEW_CHANNEL | Permissions.FLAGS.SEND_MESSAGES,
            ),
        );

        assert.equal(permissions.has("VIEW_CHANNEL", false), true);
        assert.equal(permissions.has("SEND_MESSAGES", false), false);
    });

    test("final guild permissions preserve administrator through channel overwrites", () => {
        const permissions = finalAdminPermission({ overwrites: [adminDenyOverwrite()] });

        assert.equal(permissions.has("ADMINISTRATOR", false), true);
        assert.equal(permissions.has("VIEW_CHANNEL", false), true);
        assert.equal(permissions.has("SEND_MESSAGES", false), true);
    });

    test("overwriteChannel preserves administrator permissions", () => {
        const permissions = new Permissions("ADMINISTRATOR");
        permissions.cache = { roles: [{ id: "role_id" } as Role] };

        const overwritten = permissions.overwriteChannel([
            {
                ...adminDenyOverwrite(),
                id: "role_id",
            },
        ]);

        assert.equal(overwritten.has("ADMINISTRATOR", false), true);
        assert.equal(overwritten.has("VIEW_CHANNEL", false), true);
        assert.equal(overwritten.has("SEND_MESSAGES", false), true);
    });

    test("timed out administrators have consistent permissions with or without channel overwrites", () => {
        const communicationDisabledUntil = new Date(Date.now() + 60_000);
        const withoutOverwrite = finalAdminPermission({ communicationDisabledUntil });
        const withOverwrite = finalAdminPermission({
            communicationDisabledUntil,
            overwrites: [adminDenyOverwrite()],
        });

        assert.equal(withOverwrite.bitfield, withoutOverwrite.bitfield);
        assert.equal(withOverwrite.has("VIEW_CHANNEL", false), false);
        assert.equal(withOverwrite.has("READ_MESSAGE_HISTORY", false), false);
    });

    test("quarantined administrators have consistent permissions with or without channel overwrites", () => {
        const withoutOverwrite = finalAdminPermission({ flags: USER_FLAG_QUARANTINED });
        const withOverwrite = finalAdminPermission({
            flags: USER_FLAG_QUARANTINED,
            overwrites: [adminDenyOverwrite()],
        });

        assert.equal(withOverwrite.bitfield, withoutOverwrite.bitfield);
        assert.equal(withOverwrite.has("VIEW_CHANNEL", false), false);
        assert.equal(withOverwrite.has("READ_MESSAGE_HISTORY", false), false);
        assert.equal(withOverwrite.has("CHANGE_NICKNAME", false), false);
    });

    test("member permission query selects join owner key for role hydration", () => {
        const query = getPermissionMemberQueryOptions("guild_id", "user_id", { member_relations: ["roles", "user"], member_select: ["flags", "roles", "user"] });

        assert.deepEqual(query.where, { guild_id: "guild_id", id: "user_id" });
        assert.deepEqual(query.relations, ["roles", "user"]);
        assert.deepEqual(query.select, {
            index: true,
            id: true,
            guild_id: true,
            communication_disabled_until: true,
            flags: true,
            roles: {
                id: true,
                guild_id: true,
                permissions: true,
            },
        });
    });

    test("member permission query can hydrate public message members without selecting full member rows", () => {
        assert.deepEqual(PUBLIC_MESSAGE_PERMISSION_MEMBER_SELECT, PublicMemberProjection);

        const query = getPermissionMemberQueryOptions("guild_id", "user_id", { member_select: PublicMemberProjection as (keyof Member)[] });
        const select = query.select as Record<string, unknown>;

        for (const key of PublicMemberProjection) {
            if (key === "roles") continue;
            assert.equal(select[key], true, `${key} should be selected`);
        }
        assert.deepEqual(select.roles, {
            id: true,
            guild_id: true,
            permissions: true,
        });
    });
});
