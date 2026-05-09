import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Permissions } from "./Permissions";
import { resolveChannelPermissionOverwritePermissions, resolveChannelPermissionOverwrites } from "./ChannelPermissionOverwrites";
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

    test("does not preserve unknown requested bits even if they are present in the actor bitfield", () => {
        const unknownBit = 1n << 80n;

        assert.deepEqual(
            resolveChannelPermissionOverwritePermissions({
                requestedAllow: unknownBit.toString(),
                requestedDeny: unknownBit.toString(),
                actorPermissions: actor(Permissions.FLAGS.MANAGE_ROLES | unknownBit),
            }),
            { allow: "0", deny: "0" },
        );
    });

    test("rejects negative and non-decimal permission bitfields", () => {
        assert.throws(
            () =>
                resolveChannelPermissionOverwritePermissions({
                    requestedAllow: "-1",
                    requestedDeny: "0",
                    actorPermissions: actor(Permissions.FLAGS.MANAGE_ROLES),
                }),
            /Invalid permission overwrite bitfield/,
        );

        assert.throws(
            () =>
                resolveChannelPermissionOverwritePermissions({
                    requestedAllow: "not-a-bitfield",
                    requestedDeny: "0",
                    actorPermissions: actor(Permissions.FLAGS.MANAGE_ROLES),
                }),
            /Invalid permission overwrite bitfield/,
        );
    });

    test("caps to the guild or parent-channel permission mask, not current-channel grants", () => {
        const sendMessages = Permissions.FLAGS.SEND_MESSAGES;
        const attachFiles = Permissions.FLAGS.ATTACH_FILES;
        const manageRoles = Permissions.FLAGS.MANAGE_ROLES;

        assert.deepEqual(
            resolveChannelPermissionOverwritePermissions({
                requestedAllow: (sendMessages | attachFiles).toString(),
                requestedDeny: (sendMessages | attachFiles).toString(),
                actorPermissions: actor(manageRoles | attachFiles),
                actorChannelPermissions: actor(manageRoles | sendMessages | attachFiles),
            }),
            {
                allow: attachFiles.toString(),
                deny: attachFiles.toString(),
            },
        );
    });

    test("does not use current-channel denials to remove permissions held in the guild or parent channel", () => {
        const sendMessages = Permissions.FLAGS.SEND_MESSAGES;
        const manageRoles = Permissions.FLAGS.MANAGE_ROLES;

        assert.deepEqual(
            resolveChannelPermissionOverwritePermissions({
                requestedAllow: sendMessages.toString(),
                requestedDeny: sendMessages.toString(),
                actorPermissions: actor(manageRoles | sendMessages),
                actorChannelPermissions: actor(manageRoles),
            }),
            {
                allow: sendMessages.toString(),
                deny: sendMessages.toString(),
            },
        );
    });

    test("preserves existing allow and deny bits the actor cannot affect", () => {
        const sendMessages = Permissions.FLAGS.SEND_MESSAGES;
        const attachFiles = Permissions.FLAGS.ATTACH_FILES;
        const embedLinks = Permissions.FLAGS.EMBED_LINKS;

        assert.deepEqual(
            resolveChannelPermissionOverwritePermissions({
                requestedAllow: sendMessages.toString(),
                requestedDeny: sendMessages.toString(),
                existingAllow: attachFiles.toString(),
                existingDeny: embedLinks.toString(),
                actorPermissions: actor(sendMessages),
            }),
            {
                allow: (sendMessages | attachFiles).toString(),
                deny: (sendMessages | embedLinks).toString(),
            },
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

    test("uses current-channel permissions for the MANAGE_ROLES overwrite exception", () => {
        const requested = Permissions.FLAGS.SEND_MESSAGES | Permissions.FLAGS.ATTACH_FILES;
        const actorChannelPermissions = actor(Permissions.FLAGS.MANAGE_ROLES, {
            roles: [{ id: "moderator" } as never],
            user_id: "user",
        });

        assert.deepEqual(
            resolveChannelPermissionOverwritePermissions({
                requestedAllow: requested.toString(),
                requestedDeny: requested.toString(),
                actorPermissions: actor(0n),
                actorChannelPermissions,
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

    test("resolves bulk overwrite replacement without dropping omitted bits the actor cannot affect", () => {
        const sendMessages = Permissions.FLAGS.SEND_MESSAGES;
        const attachFiles = Permissions.FLAGS.ATTACH_FILES;

        assert.deepEqual(
            resolveChannelPermissionOverwrites({
                requestedOverwrites: [roleOverwrite("target", sendMessages, sendMessages)],
                existingOverwrites: [roleOverwrite("target", attachFiles), memberOverwrite("member", attachFiles, attachFiles)],
                actorPermissions: actor(sendMessages),
            }),
            [roleOverwrite("target", sendMessages | attachFiles, sendMessages), memberOverwrite("member", attachFiles, attachFiles)],
        );
    });
});
