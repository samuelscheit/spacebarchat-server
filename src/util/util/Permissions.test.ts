import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { ChannelPermissionOverwrite } from "@spacebar/schemas";
import type { Role } from "../entities";
import { Permissions } from "./Permissions";

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
            resolved_roles: [adminRole()],
            communication_disabled_until: communicationDisabledUntil,
            flags,
        },
        guild: {
            id: "guild_id",
            owner_id: "owner_id",
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
    test("final guild permissions use the user's resolved roles", () => {
        const viewRole = {
            id: "view_role",
            permissions: Permissions.FLAGS.VIEW_CHANNEL.toString(),
        } as Role;

        const permissions = Permissions.finalPermission({
            user: {
                id: "user_id",
                roles: ["view_role"],
                resolved_roles: [viewRole],
                communication_disabled_until: null,
                flags: 0,
            },
            guild: {
                id: "guild_id",
                owner_id: "owner_id",
            },
        });

        assert.equal(permissions.has("VIEW_CHANNEL", false), true);
        assert.equal(permissions.has("SEND_MESSAGES", false), false);
    });

    test("active DM recipients receive default DM permissions", () => {
        const permissions = Permissions.finalPermission({
            user: {
                id: "user_id",
                roles: [],
                resolved_roles: [],
                communication_disabled_until: null,
                flags: 0,
            },
            guild: {
                id: "",
                owner_id: "",
            },
            channel: {
                recipients: [{ user_id: "user_id", closed: false }],
            },
        });

        assert.equal(permissions.bitfield, Permissions.DEFAULT_DM_PERMISSIONS.bitfield);
    });

    test("closed DM recipients receive no permissions", () => {
        const permissions = Permissions.finalPermission({
            user: {
                id: "user_id",
                roles: [],
                resolved_roles: [],
                communication_disabled_until: null,
                flags: 0,
            },
            guild: {
                id: "",
                owner_id: "",
            },
            channel: {
                recipients: [{ user_id: "user_id", closed: true }],
            },
        });

        assert.equal(permissions.bitfield, 0n);
    });

    test("DM non-recipients receive no permissions", () => {
        const permissions = Permissions.finalPermission({
            user: {
                id: "user_id",
                roles: [],
                resolved_roles: [],
                communication_disabled_until: null,
                flags: 0,
            },
            guild: {
                id: "",
                owner_id: "",
            },
            channel: {
                recipients: [{ user_id: "other_user_id", closed: false }],
            },
        });

        assert.equal(permissions.bitfield, 0n);
    });

    test("group DM owner receives administrator permissions", () => {
        const permissions = Permissions.finalPermission({
            user: {
                id: "owner_id",
                roles: [],
                resolved_roles: [],
                communication_disabled_until: null,
                flags: 0,
            },
            guild: {
                id: "",
                owner_id: "",
            },
            channel: {
                owner_id: "owner_id",
                recipients: [{ user_id: "owner_id", closed: true }],
            },
        });

        assert.equal(permissions.has("ADMINISTRATOR", false), true);
    });

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
});
