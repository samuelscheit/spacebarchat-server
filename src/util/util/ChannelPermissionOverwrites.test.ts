import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Permissions } from "./Permissions";
import { resolveChannelPermissionOverwritePermissions } from "./ChannelPermissionOverwrites";
import type { ChannelPermissionOverwrite } from "@spacebar/schemas";

const ROLE_OVERWRITE = 0;
const MEMBER_OVERWRITE = 1;

function actor(bitfield: bigint, cache: Permissions["cache"] = {}) {
    const permissions = new Permissions(bitfield);
    permissions.cache = cache;
    return permissions;
}

function roleOverwrite(id: string, allow: bigint, deny = 0n): ChannelPermissionOverwrite {
    return { id, type: ROLE_OVERWRITE, allow: allow.toString(), deny: deny.toString() };
}

function memberOverwrite(id: string, allow: bigint, deny = 0n): ChannelPermissionOverwrite {
    return { id, type: MEMBER_OVERWRITE, allow: allow.toString(), deny: deny.toString() };
}

describe("resolveChannelPermissionOverwritePermissions", () => {
    test("caps requested allow and deny bits to the actor's current permissions", () => {
        const sendMessages = Permissions.FLAGS.SEND_MESSAGES;
        const attachFiles = Permissions.FLAGS.ATTACH_FILES;
        const embedLinks = Permissions.FLAGS.EMBED_LINKS;

        assert.deepEqual(
            resolveChannelPermissionOverwritePermissions({
                requestedAllow: (sendMessages | attachFiles).toString(),
                requestedDeny: (sendMessages | embedLinks).toString(),
                actorPermissions: actor(sendMessages | embedLinks),
            }),
            {
                allow: sendMessages.toString(),
                deny: (sendMessages | embedLinks).toString(),
            },
        );
    });

    test("does not preserve unknown or unheld requested bits", () => {
        const unknownBit = 1n << 80n;

        assert.deepEqual(
            resolveChannelPermissionOverwritePermissions({
                requestedAllow: unknownBit.toString(),
                requestedDeny: unknownBit.toString(),
                actorPermissions: actor(Permissions.FLAGS.MANAGE_ROLES),
            }),
            { allow: "0", deny: "0" },
        );
    });

    test("allows any known permission bit when actor has MANAGE_ROLES from an applicable role channel overwrite", () => {
        const requested = Permissions.FLAGS.SEND_MESSAGES | Permissions.FLAGS.ATTACH_FILES;
        const actorPermissions = actor(Permissions.FLAGS.MANAGE_ROLES, {
            roles: [{ id: "moderator" } as never],
            user_id: "user",
        });

        assert.deepEqual(
            resolveChannelPermissionOverwritePermissions({
                requestedAllow: requested.toString(),
                requestedDeny: requested.toString(),
                actorPermissions,
                channelOverwrites: [roleOverwrite("moderator", Permissions.FLAGS.MANAGE_ROLES)],
            }),
            { allow: requested.toString(), deny: requested.toString() },
        );
    });

    test("allows the MANAGE_ROLES overwrite exception for @everyone channel overwrites", () => {
        const requested = Permissions.FLAGS.MUTE_MEMBERS;
        const actorPermissions = actor(Permissions.FLAGS.MANAGE_ROLES, {
            guild: { id: "guild" } as never,
            roles: [],
            user_id: "user",
        });

        assert.deepEqual(
            resolveChannelPermissionOverwritePermissions({
                requestedAllow: requested.toString(),
                requestedDeny: requested.toString(),
                actorPermissions,
                channelOverwrites: [roleOverwrite("guild", Permissions.FLAGS.MANAGE_ROLES)],
            }),
            { allow: requested.toString(), deny: requested.toString() },
        );
    });

    test("allows the MANAGE_ROLES overwrite exception for member channel overwrites", () => {
        const requested = Permissions.FLAGS.MOVE_MEMBERS;
        const actorPermissions = actor(Permissions.FLAGS.MANAGE_ROLES, {
            roles: [],
            user_id: "user",
        });

        assert.deepEqual(
            resolveChannelPermissionOverwritePermissions({
                requestedAllow: requested.toString(),
                requestedDeny: requested.toString(),
                actorPermissions,
                channelOverwrites: [memberOverwrite("user", Permissions.FLAGS.MANAGE_ROLES)],
            }),
            { allow: requested.toString(), deny: requested.toString() },
        );
    });

    test("does not apply the exception for unrelated MANAGE_ROLES overwrites", () => {
        const requested = Permissions.FLAGS.SEND_MESSAGES;
        const actorPermissions = actor(Permissions.FLAGS.MANAGE_ROLES, {
            roles: [{ id: "moderator" } as never],
            user_id: "user",
        });

        assert.deepEqual(
            resolveChannelPermissionOverwritePermissions({
                requestedAllow: requested.toString(),
                requestedDeny: requested.toString(),
                actorPermissions,
                channelOverwrites: [roleOverwrite("other-role", Permissions.FLAGS.MANAGE_ROLES), memberOverwrite("other-user", Permissions.FLAGS.MANAGE_ROLES)],
            }),
            { allow: "0", deny: "0" },
        );
    });
});
