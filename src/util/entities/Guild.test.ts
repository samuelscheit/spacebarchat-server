import assert from "node:assert/strict";
import { describe, test } from "node:test";

describe("Guild.createGuild", () => {
    test("persists imported template channel ordering from serialized channel order", async () => {
        process.env.DATABASE ??= "postgres://user:password@localhost:5432/database";

        const guildModule = await import("./Guild.js");
        const channelModule = await import("./Channel.js");
        const roleModule = await import("./Role.js");
        const snowflakeModule = await import("../util/Snowflake.js");
        const configModule = await import("../util/Config.js");
        const { Guild } = guildModule;
        const { Channel } = channelModule;
        const { Role } = roleModule;
        const { Snowflake } = snowflakeModule;
        const { Config } = configModule;

        type MutableStatic = Record<string, unknown>;
        const mutableGuild = Guild as unknown as MutableStatic;
        const mutableRole = Role as unknown as MutableStatic;
        const mutableChannel = Channel as unknown as MutableStatic;
        const mutableSnowflake = Snowflake as unknown as MutableStatic;
        const mutableConfig = Config as unknown as MutableStatic;

        const originalGuildCreate = mutableGuild.create;
        const originalGuildUpdate = mutableGuild.update;
        const originalRoleCreate = mutableRole.create;
        const originalChannelCreateChannel = mutableChannel.createChannel;
        const originalSnowflakeGenerate = mutableSnowflake.generate;
        const originalConfigGet = mutableConfig.get;

        const generatedIds = ["new-guild", "new-category", "new-child-1", "new-child-2", "new-top-level"];
        const channelCreateCalls: {
            channel: {
                id?: string;
                name?: string;
                parent_id?: string;
                permission_overwrites?: { allow: string; deny: string; id: string; type: number }[];
            };
            options?: { skipOrdering?: boolean };
        }[] = [];
        const guildUpdates: {
            criteria: unknown;
            partial: {
                afk_channel_id?: string | null;
                channel_ordering?: string[];
                rules_channel_id?: string | null;
                system_channel_id?: string | null;
            };
        }[] = [];

        const createEntity = <T extends object>(entity: T) => ({
            ...entity,
            save: async () => entity,
        });

        try {
            mutableConfig.get = () => ({
                defaults: {
                    guild: {
                        afkTimeout: 300,
                        defaultMessageNotifications: 1,
                        explicitContentFilter: 0,
                        maxPresences: 250000,
                        maxVideoChannelUsers: 25,
                    },
                },
                guild: { defaultFeatures: [] },
                limits: { guild: { maxMembers: 250000 } },
                regions: { default: "spacebar" },
            });
            mutableSnowflake.generate = () => generatedIds.shift() ?? assert.fail("unexpected snowflake generation");
            mutableGuild.create = (entity: object) => createEntity(entity);
            mutableGuild.update = async (criteria: unknown, partial: (typeof guildUpdates)[number]["partial"]) => {
                guildUpdates.push({ criteria, partial });
                return { affected: 1, raw: {}, generatedMaps: [] };
            };
            mutableRole.create = (entity: object) => createEntity(entity);
            mutableChannel.createChannel = async (channel: { id?: string; name?: string; parent_id?: string }, _userId?: string, options?: { skipOrdering?: boolean }) => {
                channelCreateCalls.push({ channel, options });
                return { id: channel.id };
            };

            const guild = await Guild.createGuild({
                name: "Imported template",
                owner_id: "owner",
                source_guild_id: "source-guild",
                rules_channel_id: "child-1",
                system_channel_id: "top-level",
                channels: [
                    { id: "category", name: "category", type: 4, position: 50 },
                    {
                        id: "child-1",
                        name: "child-1",
                        type: 0,
                        parent_id: "category",
                        position: 99,
                        permission_overwrites: [{ id: "source-guild", type: 0, allow: "1", deny: "0" }],
                    },
                    { id: "child-2", name: "child-2", type: 0, parent_id: "category", position: 0 },
                    { id: "top-level", name: "top-level", type: 0, position: 1 },
                ],
            });

            assert.deepEqual(
                channelCreateCalls.map(({ channel }) => channel.name),
                ["category", "child-1", "child-2", "top-level"],
            );
            assert.equal(channelCreateCalls[1].channel.parent_id, "new-category");
            assert.equal(channelCreateCalls[2].channel.parent_id, "new-category");
            assert.deepEqual(channelCreateCalls[1].channel.permission_overwrites, [{ id: "new-guild", type: 0, allow: "1", deny: "0" }]);
            assert(channelCreateCalls.every(({ options }) => options?.skipOrdering));
            assert.deepEqual(guild.channel_ordering, ["new-category", "new-child-1", "new-child-2", "new-top-level"]);
            assert.equal(guild.rules_channel_id, "new-child-1");
            assert.equal(guild.system_channel_id, "new-top-level");
            assert.deepEqual(guildUpdates.at(-1), {
                criteria: { id: "new-guild" },
                partial: {
                    channel_ordering: ["new-category", "new-child-1", "new-child-2", "new-top-level"],
                    rules_channel_id: "new-child-1",
                    system_channel_id: "new-top-level",
                },
            });
        } finally {
            mutableGuild.create = originalGuildCreate;
            mutableGuild.update = originalGuildUpdate;
            mutableRole.create = originalRoleCreate;
            mutableChannel.createChannel = originalChannelCreateChannel;
            mutableSnowflake.generate = originalSnowflakeGenerate;
            mutableConfig.get = originalConfigGet;
        }
    });

    test("Channel.createChannel can skip immediate guild channel_ordering insertion for template imports", async () => {
        process.env.DATABASE ??= "postgres://user:password@localhost:5432/database";

        const { Guild } = await import("./Guild.js");
        const { Channel } = await import("./Channel.js");
        const mutableGuild = Guild as unknown as Record<string, unknown>;
        const mutableChannel = Channel as unknown as Record<string, unknown>;

        const originalChannelCreate = mutableChannel.create;
        const originalGuildFindOneOrFail = mutableGuild.findOneOrFail;
        const originalGuildInsertChannelInOrder = mutableGuild.insertChannelInOrder;

        let insertCalls = 0;

        try {
            mutableChannel.create = (entity: object) => ({
                ...entity,
                save: async () => entity,
                toJSON: () => entity,
            });
            mutableGuild.findOneOrFail = async () => ({ id: "guild", features: [], channel_ordering: [] });
            mutableGuild.insertChannelInOrder = async () => {
                insertCalls += 1;
                return 0;
            };

            await Channel.createChannel({ id: "channel", guild_id: "guild", name: "general", type: 0, position: 1 }, "owner", {
                keepId: true,
                skipPermissionCheck: true,
                skipEventEmit: true,
                skipOrdering: true,
            });

            assert.equal(insertCalls, 0);
        } finally {
            mutableChannel.create = originalChannelCreate;
            mutableGuild.findOneOrFail = originalGuildFindOneOrFail;
            mutableGuild.insertChannelInOrder = originalGuildInsertChannelInOrder;
        }
    });
});
