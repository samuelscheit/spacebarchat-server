import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { FindManyOptions } from "typeorm";

process.env.DATABASE ??= "postgres://user:password@localhost:5432/spacebar";

describe("RequestChannelStatuses", () => {
    test("loads persisted visible voice channel statuses for a guild", async () => {
        const { Channel, Permissions } = require("@spacebar/util");
        const { ChannelPermissionOverwriteType, ChannelType } = require("@spacebar/schemas");
        const permissionsModule = require("@spacebar/util/util/Permissions");
        const { getChannelStatuses } = require("./RequestChannelStatuses");
        const originalFind = Channel.find;
        const originalGetPermission = permissionsModule.getPermission;
        let options: FindManyOptions | undefined;
        let permissionArgs: { user_id: string; guild_id: string } | undefined;

        try {
            permissionsModule.getPermission = async (user_id: string, guild_id: string) => {
                permissionArgs = { user_id, guild_id };
                const permissions = new Permissions("VIEW_CHANNEL");
                permissions.cache = {
                    roles: [{ id: guild_id }],
                    user_id,
                };
                return permissions;
            };
            Channel.find = async (findOptions: FindManyOptions) => {
                options = findOptions;
                return [
                    { id: "1000", status: "Daily standup", permission_overwrites: [] },
                    {
                        id: "1001",
                        status: "Private sync",
                        permission_overwrites: [
                            {
                                id: "42",
                                type: ChannelPermissionOverwriteType.role,
                                allow: "0",
                                deny: Permissions.FLAGS.VIEW_CHANNEL.toString(),
                            },
                        ],
                    },
                ];
            };

            const statuses = await getChannelStatuses("42", "user");

            assert.deepEqual(statuses, [{ id: "1000", status: "Daily standup" }]);
            assert.deepEqual(permissionArgs, { user_id: "user", guild_id: "42" });
            const where = options?.where as Record<string, unknown>;
            assert.equal(where.guild_id, "42");
            assert.equal(where.type, ChannelType.GUILD_VOICE);
            assert.deepEqual(options?.select, { id: true, status: true, permission_overwrites: true });
            assert.deepEqual(options?.order, { id: "ASC" });
        } finally {
            Channel.find = originalFind;
            permissionsModule.getPermission = originalGetPermission;
        }
    });

    test("checks guild view permission before loading statuses", async () => {
        const { Channel, Permissions } = require("@spacebar/util");
        const permissionsModule = require("@spacebar/util/util/Permissions");
        const { getChannelStatuses } = require("./RequestChannelStatuses");
        const originalFind = Channel.find;
        const originalGetPermission = permissionsModule.getPermission;
        let findCalled = false;

        try {
            permissionsModule.getPermission = async () => new Permissions(0);
            Channel.find = async () => {
                findCalled = true;
                return [];
            };

            await assert.rejects(getChannelStatuses("42", "user"), /VIEW_CHANNEL/);
            assert.equal(findCalled, false);
        } finally {
            Channel.find = originalFind;
            permissionsModule.getPermission = originalGetPermission;
        }
    });

    test("offloads configured requests without local permission or status queries", async () => {
        const { Channel, Config } = require("@spacebar/util");
        const permissionsModule = require("@spacebar/util/util/Permissions");
        const gatewayUtils = require("../util/Utils");
        const { onRequestChannelStatuses } = require("./RequestChannelStatuses");
        const originalFind = Channel.find;
        const originalConfigGet = Config.get;
        const originalGetPermission = permissionsModule.getPermission;
        const originalHandleOffloadedGatewayRequest = gatewayUtils.handleOffloadedGatewayRequest;
        const payload = { guild_id: "42" };
        let offloadArgs: { socket: unknown; url: string; body: unknown } | undefined;
        let findCalled = false;
        let permissionCalled = false;

        try {
            Config.get = () => ({
                offload: {
                    gateway: {
                        channelStatusesUrl: "http://offload.example/channel-statuses",
                    },
                },
            });
            permissionsModule.getPermission = async () => {
                permissionCalled = true;
                throw new Error("getPermission should not be called for offloaded requests");
            };
            Channel.find = async () => {
                findCalled = true;
                return [];
            };
            gatewayUtils.handleOffloadedGatewayRequest = async (socket: unknown, url: string, body: unknown) => {
                offloadArgs = { socket, url, body };
                return "offloaded";
            };

            const socket = { user_id: "user" };
            const result = await onRequestChannelStatuses.call(socket, { d: payload });

            assert.equal(result, "offloaded");
            assert.deepEqual(offloadArgs, {
                socket,
                url: "http://offload.example/channel-statuses",
                body: payload,
            });
            assert.equal(permissionCalled, false);
            assert.equal(findCalled, false);
        } finally {
            Channel.find = originalFind;
            Config.get = originalConfigGet;
            permissionsModule.getPermission = originalGetPermission;
            gatewayUtils.handleOffloadedGatewayRequest = originalHandleOffloadedGatewayRequest;
        }
    });
});
