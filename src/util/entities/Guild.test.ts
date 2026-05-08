import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getMetadataArgsStorage } from "typeorm";

const ROLE_PERMISSION_OVERWRITE_TYPE = 0;
const MEMBER_PERMISSION_OVERWRITE_TYPE = 1;
const GUILD_TEXT_CHANNEL_TYPE = 0;
const GUILD_CATEGORY_CHANNEL_TYPE = 4;
const GUILD_NEWS_THREAD_TYPE = 10;
const GUILD_PUBLIC_THREAD_TYPE = 11;
const GUILD_PRIVATE_THREAD_TYPE = 12;

type EntityPayload = Record<string, unknown>;
type SaveableEntity = EntityPayload & { save: () => Promise<EntityPayload> };

function createThreadMetadata(archived: boolean) {
    return {
        archived,
        archive_timestamp: new Date("2026-05-08T00:00:00.000Z").toISOString(),
        create_timestamp: new Date("2026-05-08T00:00:00.000Z").toISOString(),
        locked: false,
        auto_archive_duration: 60,
    };
}

function createSaveableEntity(payload: EntityPayload): SaveableEntity {
    const entity = {
        ...payload,
        save: async () => entity,
    };

    return entity;
}

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

    test("remaps template channel role permission overwrites before channel creation", async (t) => {
        process.env.DATABASE ??= "postgres://test:test@localhost:5432/test";
        process.env.APPLY_DB_MIGRATIONS ??= "false";

        const [{ Guild }, { Role }, { Channel }, { Config, Snowflake }] = await Promise.all([
            import("./Guild.js"),
            import("./Role.js"),
            import("./Channel.js"),
            import("../util/index.js"),
        ]);

        const guildClass = Guild as unknown as {
            create: (guild: EntityPayload) => SaveableEntity;
            update: (criteria: unknown, partial: EntityPayload) => Promise<unknown>;
        };
        const roleClass = Role as unknown as {
            create: (role: EntityPayload) => SaveableEntity;
        };
        const channelClass = Channel as unknown as {
            createChannel: (channel: EntityPayload, userId?: string, options?: EntityPayload) => Promise<EntityPayload>;
        };
        const configClass = Config as unknown as {
            get: () => EntityPayload;
        };
        const snowflakeClass = Snowflake as unknown as {
            generate: () => string;
        };

        const generatedIds = ["new-guild", "new-role", "new-category", "new-text"];
        const createdRoles: EntityPayload[] = [];
        const createdChannels: EntityPayload[] = [];

        t.mock.method(configClass, "get", () => ({
            defaults: {
                guild: {
                    afkTimeout: 300,
                    defaultMessageNotifications: 0,
                    explicitContentFilter: 0,
                    maxPresences: null,
                    maxVideoChannelUsers: 25,
                },
            },
            guild: {
                defaultFeatures: [],
            },
            limits: {
                guild: {
                    maxMembers: 250000,
                },
            },
            regions: {
                default: "deprecated",
            },
        }));
        t.mock.method(snowflakeClass, "generate", () => {
            const id = generatedIds.shift();
            assert.ok(id);
            return id;
        });
        t.mock.method(guildClass, "create", (guild: EntityPayload) =>
            createSaveableEntity({
                ...guild,
                channel_ordering: [],
            }),
        );
        t.mock.method(guildClass, "update", async () => ({ affected: 1, generatedMaps: [], raw: [] }));
        t.mock.method(roleClass, "create", (role: EntityPayload) => {
            createdRoles.push(role);
            return createSaveableEntity(role);
        });
        t.mock.method(channelClass, "createChannel", async (channel: EntityPayload) => {
            createdChannels.push(channel);
            return channel;
        });

        const guild = await Guild.createGuild({
            name: "Template Import",
            owner_id: "owner",
            roles: [
                { id: 0, permissions: "8" },
                { id: 1, name: "Mods" },
            ],
            channels: [
                {
                    id: "old-category",
                    type: GUILD_CATEGORY_CHANNEL_TYPE,
                    name: "Private",
                    permission_overwrites: [
                        { id: 0, type: ROLE_PERMISSION_OVERWRITE_TYPE, allow: "0", deny: "1024" },
                        { id: 1, type: ROLE_PERMISSION_OVERWRITE_TYPE, allow: "1024", deny: "0" },
                        { id: "member-id", type: MEMBER_PERMISSION_OVERWRITE_TYPE, allow: "2048", deny: "0" },
                        { id: "missing-role", type: ROLE_PERMISSION_OVERWRITE_TYPE, allow: "4096", deny: "0" },
                    ],
                },
                {
                    id: "old-text",
                    parent_id: "old-category",
                    type: GUILD_TEXT_CHANNEL_TYPE,
                    name: "mods",
                    permission_overwrites: [{ id: 1, type: ROLE_PERMISSION_OVERWRITE_TYPE, allow: "2048", deny: "0" }],
                },
            ],
            source_guild_id: "source-guild",
        });

        assert.equal(guild.id, "new-guild");
        assert.deepEqual(
            createdRoles.map((role) => ({ id: role.id, name: role.name, permissions: role.permissions })),
            [
                { id: "new-guild", name: "@everyone", permissions: "8" },
                { id: "new-role", name: "Mods", permissions: "0" },
            ],
        );
        assert.deepEqual(createdChannels[0].permission_overwrites, [
            { id: "new-guild", type: ROLE_PERMISSION_OVERWRITE_TYPE, allow: "0", deny: "1024" },
            { id: "new-role", type: ROLE_PERMISSION_OVERWRITE_TYPE, allow: "1024", deny: "0" },
        ]);
        assert.equal(createdChannels[1].parent_id, "new-category");
        assert.deepEqual(createdChannels[1].permission_overwrites, [{ id: "new-role", type: ROLE_PERMISSION_OVERWRITE_TYPE, allow: "2048", deny: "0" }]);
        assert.deepEqual(guild.channel_ordering, ["new-category", "new-text"]);
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

describe("Guild entity metadata", () => {
    test("uses explicit database types for nullable discovery metadata backing columns", async () => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar";
        const { Guild } = await import("./Guild.js");
        const columns = getMetadataArgsStorage().columns.filter((column) => column.target === Guild);

        assert.equal(columns.find((column) => column.propertyName === "description")?.options.type, "varchar");
        assert.equal(columns.find((column) => column.propertyName === "primary_category_id")?.options.type, "int8");
    });
});

test("ready guild thread predicate includes only active public and news threads for the requested guild", async () => {
    const { ReadyGuildThreadTypes, isReadyGuildThreadChannel } = await import("./Guild.js");

    assert.deepEqual([...ReadyGuildThreadTypes], [GUILD_NEWS_THREAD_TYPE, GUILD_PUBLIC_THREAD_TYPE]);
    assert.equal(isReadyGuildThreadChannel({ guild_id: "guild", type: GUILD_NEWS_THREAD_TYPE, thread_metadata: createThreadMetadata(false) }, "guild"), true);
    assert.equal(isReadyGuildThreadChannel({ guild_id: "guild", type: GUILD_PUBLIC_THREAD_TYPE, thread_metadata: createThreadMetadata(false) }, "guild"), true);
    assert.equal(isReadyGuildThreadChannel({ guild_id: "guild", type: GUILD_PUBLIC_THREAD_TYPE, thread_metadata: createThreadMetadata(true) }, "guild"), false);
    assert.equal(isReadyGuildThreadChannel({ guild_id: "guild", type: GUILD_PRIVATE_THREAD_TYPE, thread_metadata: createThreadMetadata(false) }, "guild"), false);
    assert.equal(isReadyGuildThreadChannel({ guild_id: "guild", type: GUILD_TEXT_CHANNEL_TYPE, thread_metadata: createThreadMetadata(false) }, "guild"), false);
    assert.equal(isReadyGuildThreadChannel({ guild_id: "other", type: GUILD_PUBLIC_THREAD_TYPE, thread_metadata: createThreadMetadata(false) }, "guild"), false);
});

test("addToGuild sends active public and news threads separately from ordered guild channels without leaking private threads", async (t) => {
    process.env.DATABASE ??= "postgres://test:test@localhost:5432/test";
    process.env.APPLY_DB_MIGRATIONS ??= "false";

    const [{ Member }, { Guild }, { Channel }, { Ban }, { Role }, { StageInstance }, { User }, { Message }, utilModule] = await Promise.all([
        import("./Member.js"),
        import("./Guild.js"),
        import("./Channel.js"),
        import("./Ban.js"),
        import("./Role.js"),
        import("./StageInstance.js"),
        import("./User.js"),
        import("./Message.js"),
        import("../util/index.js"),
    ]);

    const emittedEvents: EntityPayload[] = [];
    const savedMembers: EntityPayload[] = [];
    const guild = Object.assign(new Guild(), {
        id: "guild",
        name: "Thread Guild",
        channels: [
            Object.assign(new Channel(), {
                id: "active-news-thread",
                guild_id: "guild",
                parent_id: "text",
                type: GUILD_NEWS_THREAD_TYPE,
                name: "active news thread",
                thread_metadata: createThreadMetadata(false),
            }),
            Object.assign(new Channel(), {
                id: "active-thread",
                guild_id: "guild",
                parent_id: "text",
                type: GUILD_PUBLIC_THREAD_TYPE,
                name: "active thread",
                thread_metadata: createThreadMetadata(false),
            }),
            Object.assign(new Channel(), { id: "text", guild_id: "guild", type: 0, name: "text" }),
            Object.assign(new Channel(), {
                id: "archived-thread",
                guild_id: "guild",
                parent_id: "text",
                type: GUILD_PUBLIC_THREAD_TYPE,
                name: "archived thread",
                thread_metadata: createThreadMetadata(true),
            }),
            Object.assign(new Channel(), {
                id: "private-thread",
                guild_id: "guild",
                parent_id: "text",
                type: GUILD_PRIVATE_THREAD_TYPE,
                name: "private thread",
                thread_metadata: createThreadMetadata(false),
            }),
        ],
        channel_ordering: ["active-news-thread", "active-thread", "text"],
        roles: [],
        emojis: [],
        stickers: [],
        voice_states: [],
        large: false,
        member_count: 0,
        premium_subscription_count: 0,
        features: [],
        owner_id: "owner",
        afk_timeout: 300,
        premium_tier: 0,
        premium_progress_bar_enabled: false,
        nsfw: false,
        default_message_notifications: 0,
    });

    t.mock.method(utilModule.Config, "get", () => ({ limits: { user: { maxGuilds: 100 } } }));
    t.mock.method(User, "getPublicUser", async () => ({ id: "new-user", username: "new-user", discriminator: "0001", avatar: null, public_flags: 0 }));
    t.mock.method(Ban, "getRepository", () => ({ count: async () => 0 }));
    t.mock.method(Member, "getRepository", () => ({
        count: async (options: EntityPayload) => (options.where && "id" in (options.where as EntityPayload) ? 0 : 1),
        find: async () => [],
        create: (entity: EntityPayload) => ({
            ...entity,
            toPublicMember() {
                return { user_id: entity.id, roles: (entity.roles as EntityPayload[]).map((role) => role.id) };
            },
        }),
        save: async (entity: EntityPayload) => {
            savedMembers.push(entity);
            return entity;
        },
    }));
    t.mock.method(Guild, "getRepository", () => ({
        findOneOrFail: async () => guild,
        increment: async () => undefined,
    }));
    t.mock.method(StageInstance, "getRepository", () => ({ find: async () => [] }));
    t.mock.method(Channel, "getRepository", () => ({ findOneOrFail: async () => ({ id: "text" }), save: async () => undefined }));
    t.mock.method(Role, "create", (role: EntityPayload) => role);
    const manager = {
        getRepository(entity: unknown) {
            if (entity === Channel) return Channel.getRepository();
            if (entity === Guild) return Guild.getRepository();
            if (entity === Member) return Member.getRepository();
            if (entity === Message) return { create: (message: EntityPayload) => message, save: async (message: EntityPayload) => message };
            if (entity === StageInstance) return StageInstance.getRepository();
            if (entity === Ban) return Ban.getRepository();
            throw new Error("unexpected repository");
        },
    };
    await Member.addToGuild("new-user", "guild", { manager: manager as never, deferredEvents: emittedEvents as never[] });

    assert.equal(savedMembers.length, 1);
    const guildCreate = emittedEvents.find((event) => event.event === "GUILD_CREATE") as EntityPayload | undefined;
    assert.ok(guildCreate);
    const data = guildCreate.data as { channels: EntityPayload[]; threads: EntityPayload[] };
    assert.deepEqual(
        data.channels.map((channel) => channel.id),
        ["text"],
    );
    assert.deepEqual(
        data.threads.map((thread) => thread.id),
        ["active-news-thread", "active-thread"],
    );
});
