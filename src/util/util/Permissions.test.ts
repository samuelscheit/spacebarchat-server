import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { ChannelPermissionOverwrite } from "@spacebar/schemas";
import type { Role } from "../entities";
import { getPermission, isGuildOwner, Permissions } from "./Permissions";

const CHANNEL_PERMISSION_OVERWRITE_ROLE = 0;
const CHANNEL_PERMISSION_OVERWRITE_MEMBER = 1;
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
    test("identifies guild owners by id or loaded owner relation", () => {
        assert.equal(isGuildOwner({ owner_id: "owner_id" }, "owner_id"), true);
        assert.equal(isGuildOwner({ owner: { id: "owner_id" } }, { id: "owner_id" }), true);
        assert.equal(isGuildOwner({ owner_id: "owner_id" }, "member_id", { id: "other_member_id" }), false);
        assert.equal(isGuildOwner({ owner_id: null }, "owner_id"), false);
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

    test("final guild permissions grant guild owners all permissions before channel overwrites", () => {
        const permissions = Permissions.finalPermission({
            user: {
                id: "owner_id",
                roles: [],
                communication_disabled_until: null,
                flags: 0,
            },
            guild: {
                id: "guild_id",
                owner_id: "owner_id",
                roles: [],
            },
            channel: {
                overwrites: [
                    {
                        id: "owner_id",
                        type: CHANNEL_PERMISSION_OVERWRITE_MEMBER,
                        allow: "0",
                        deny: Permissions.ALL.bitfield.toString(),
                    },
                ],
            },
        });

        assert.equal(permissions.bitfield, Permissions.ALL.bitfield);
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

    test("getPermission short-circuits guild owners without requiring a member row", async (t) => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar";

        const [{ User }, { Guild }, { Member }] = await Promise.all([import("../entities/User.js"), import("../entities/Guild.js"), import("../entities/Member.js")]);
        const userClass = User as unknown as {
            findOneOrFail: (options: unknown) => Promise<unknown>;
        };
        const guildClass = Guild as unknown as {
            findOneOrFail: (options: unknown) => Promise<unknown>;
        };
        const memberClass = Member as unknown as {
            findOneOrFail: (options: unknown) => Promise<unknown>;
        };

        let memberLookups = 0;

        t.mock.method(userClass, "findOneOrFail", async () => ({ id: "owner_id", flags: 0 }));
        t.mock.method(guildClass, "findOneOrFail", async () => ({ id: "guild_id", owner_id: "owner_id" }));
        t.mock.method(memberClass, "findOneOrFail", async () => {
            memberLookups += 1;
            throw new Error("owner permission lookup should not require a guild member row");
        });

        const permissions = await getPermission("owner_id", "guild_id");

        assert.equal(permissions.bitfield, Permissions.ALL.bitfield);
        assert.equal(memberLookups, 0);
    });
});
