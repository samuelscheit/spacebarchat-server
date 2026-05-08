import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { createRequire } from "node:module";

type ChannelEntity = import("../entities/Channel").Channel;
type GuildEntity = import("../entities/Guild").Guild;
type SnowflakeClass = typeof import("./Snowflake").Snowflake;
type ChannelClass = typeof import("../entities/Channel").Channel;
type GuildClass = typeof import("../entities/Guild").Guild;
type ThreadMemberClass = typeof import("../entities/ThreadMember").ThreadMember;
type EmittedEvent = { event: string; data: Record<string, unknown>; guild_id?: string };

type FindOneOptionsWithId = {
    where?: {
        id?: string;
    };
};

type StubThreadPersistenceOptions = {
    parentGuildId?: string | null;
    savedGuildId?: string | null;
};

const localRequire = createRequire(__filename);
const DM = 1;
const GROUP_DM = 3;
const GUILD_PUBLIC_THREAD = 11;
const GUILD_PRIVATE_THREAD = 12;

const fallbackSchemaValue = new Proxy(Object.create(null), {
    get: (_target, property) => {
        if (property === Symbol.toPrimitive) return () => 0;
        if (property === "then") return undefined;
        if (property === "toString") return () => "0";
        if (property === "valueOf") return () => 0;
        return fallbackSchemaValue;
    },
});

const schemasPath = localRequire.resolve("@spacebar/schemas");
const schemasMock = new Proxy(
    {
        ApplicationCommandType: { CHAT_INPUT: 1 },
        ChannelType: {
            DM,
            GROUP_DM,
            GUILD_TEXT: 0,
            GUILD_NEWS_THREAD: 10,
            GUILD_PUBLIC_THREAD,
            GUILD_PRIVATE_THREAD,
            GUILD_FORUM: 15,
            GUILD_MEDIA: 16,
        },
        PublicMemberProjection: {},
        PublicUserProjection: {},
        PublicVoiceStateProjection: {},
        ReadStateFlags: {
            IS_GUILD_CHANNEL: 1,
            IS_THREAD: 2,
            IS_MENTION_LOW_IMPORTANCE: 4,
        },
        ReadStateType: { CHANNEL: 0 },
    },
    {
        get: (target, property) => {
            if (property in target) return target[property as keyof typeof target];
            return fallbackSchemaValue;
        },
    },
);

(localRequire.cache as Record<string, { exports: unknown } | undefined>)[schemasPath] = {
    exports: schemasMock,
};

const { Snowflake } = localRequire("./Snowflake") as { Snowflake: SnowflakeClass };

const GUILD_TEXT = 0;
const emittedEvents: EmittedEvent[] = [];
const utilMock = {
    Config: {
        get: () => ({
            guild: {
                publicThreadsInvitable: false,
            },
        }),
    },
    DiscordApiErrors: {
        THREAD_ALREADY_CREATED_FOR_THIS_MESSAGE: new Error("THREAD_ALREADY_CREATED_FOR_THIS_MESSAGE"),
    },
    FieldErrors: class FieldErrors extends Error {},
    GuildFeature: {
        AllowExistingThreadForMessage: "ALLOW_EXISTING_THREAD_FOR_MESSAGE",
    },
    InvisibleCharacters: [],
    Permissions: {
        ALL: {},
        DEFAULT_DM_PERMISSIONS: {},
        NONE: {},
        finalPermission: () => ({ has: () => false, hasThrow: () => undefined }),
    },
    Snowflake,
    emitEvent: async (event: EmittedEvent) => {
        emittedEvents.push(event);
    },
    getDatabase: () => null,
    getPermission: async () => ({ hasThrow: () => undefined }),
    handleFile: async () => undefined,
    isGuildOwner: () => false,
    normalizeChannelName: (value?: string) => value,
    normalizeThreadName: (value?: string) => value,
    assertChannelNamePresent: () => undefined,
    trimSpecial: (value?: string) => value,
};

function mockModule(path: string, exports: unknown) {
    (localRequire.cache as Record<string, { exports: unknown } | undefined>)[path] = {
        exports,
    };
}

for (const path of [localRequire.resolve("."), localRequire.resolve("..")]) {
    mockModule(path, utilMock);
}

for (const [path, moduleExports] of [
    [localRequire.resolve("./ChannelName"), utilMock],
    [localRequire.resolve("./Config"), { Config: utilMock.Config }],
    [localRequire.resolve("./Constants"), { DiscordApiErrors: utilMock.DiscordApiErrors }],
    [localRequire.resolve("./Database"), { getDatabase: utilMock.getDatabase }],
    [localRequire.resolve("./Event"), { emitEvent: utilMock.emitEvent }],
    [localRequire.resolve("./GuildFeatures"), { GuildFeature: utilMock.GuildFeature }],
    [localRequire.resolve("./Permissions"), utilMock],
    [localRequire.resolve("./String"), { trimSpecial: utilMock.trimSpecial }],
    [localRequire.resolve("./cdn"), { handleFile: utilMock.handleFile }],
] as const) {
    mockModule(path, moduleExports);
}

const { Channel } = localRequire("../entities/Channel") as { Channel: ChannelClass };
const { Guild } = localRequire("../entities/Guild") as { Guild: GuildClass };
const { ThreadMember } = localRequire("../entities/ThreadMember") as { ThreadMember: ThreadMemberClass };

const originals = {
    channelFindOne: Channel.findOne,
    channelFindOneOrFail: Channel.findOneOrFail,
    channelSave: Channel.prototype.save,
    guildFindOneOrFail: Guild.findOneOrFail,
    guildInsertChannelInOrder: Guild.insertChannelInOrder,
    snowflakeGenerate: Snowflake.generate,
    threadMemberCreateForUser: ThreadMember.createForUser,
};

afterEach(() => {
    Object.assign(Channel, {
        findOne: originals.channelFindOne,
        findOneOrFail: originals.channelFindOneOrFail,
    });
    Object.assign(Channel.prototype, {
        save: originals.channelSave,
    });
    Object.assign(Guild, {
        findOneOrFail: originals.guildFindOneOrFail,
        insertChannelInOrder: originals.guildInsertChannelInOrder,
    });
    Object.assign(Snowflake, {
        generate: originals.snowflakeGenerate,
    });
    Object.assign(ThreadMember, {
        createForUser: originals.threadMemberCreateForUser,
    });
    emittedEvents.length = 0;
});

function stubThreadPersistence(findOneCalls: FindOneOptionsWithId[], options: StubThreadPersistenceOptions = {}) {
    const parentGuildId = Object.hasOwn(options, "parentGuildId") ? options.parentGuildId : "guild";
    Object.assign(Channel, {
        findOne: async (options: FindOneOptionsWithId) => {
            findOneCalls.push(options);
            return null;
        },
        findOneOrFail: async () =>
            ({
                id: "parent",
                guild_id: parentGuildId ?? undefined,
                member_count: 42,
                nsfw: false,
                permission_overwrites: [],
            }) satisfies Partial<ChannelEntity>,
    });
    Object.assign(Guild, {
        findOneOrFail: async () =>
            ({
                id: parentGuildId ?? "guild",
                features: [],
            }) satisfies Partial<GuildEntity>,
    });
    Object.assign(Channel.prototype, {
        save: async function (this: ChannelEntity) {
            if ("savedGuildId" in options) this.guild_id = options.savedGuildId ?? undefined;
            return this;
        },
    });
    Object.assign(ThreadMember, {
        createForUser: async (_userId: string, thread: Pick<ChannelEntity, "id" | "guild_id">) =>
            ({
                id: thread.id,
                toJSON: () => ({ id: thread.id }),
            }) satisfies { id: string; toJSON: () => { id: string } },
    });
}

describe("Channel.createChannel", () => {
    test("rejects DM channel types because direct messages are created outside guild channel creation", async () => {
        Object.assign(Guild, {
            findOneOrFail: async () =>
                ({
                    id: "guild",
                    features: [],
                    channel_ordering: [],
                }) satisfies Partial<GuildEntity>,
        });

        for (const type of [DM, GROUP_DM]) {
            await assert.rejects(
                () =>
                    Channel.createChannel(
                        {
                            guild_id: "guild",
                            name: "not-a-guild-channel",
                            type,
                        },
                        "user",
                        {
                            skipEventEmit: true,
                            skipNameChecks: true,
                            skipOrdering: true,
                            skipPermissionCheck: true,
                        },
                    ),
                /You can't create a dm channel in a guild/,
            );
        }
    });
});

describe("Channel.createThreadChannel", () => {
    test("rejects non-thread channel types before persistence", async () => {
        const findOneCalls: FindOneOptionsWithId[] = [];
        stubThreadPersistence(findOneCalls);

        await assert.rejects(
            () =>
                Channel.createThreadChannel(
                    {
                        id: "text-channel",
                        parent_id: "parent",
                        guild_id: "guild",
                        name: "not-a-thread",
                        type: GUILD_TEXT,
                    },
                    {},
                    "user",
                    { keepId: true, skipEventEmit: true, skipNameChecks: true, skipPermissionCheck: true },
                ),
            /createThreadChannel can only create thread channel types/,
        );

        assert.deepEqual(findOneCalls, []);
    });

    test("generates an id before duplicate lookup when keepId is set without an id", async () => {
        const findOneCalls: FindOneOptionsWithId[] = [];
        stubThreadPersistence(findOneCalls);
        let generated = 0;
        Object.assign(Snowflake, {
            generate: () => `generated-${++generated}`,
        });

        const thread = await Channel.createThreadChannel(
            {
                parent_id: "parent",
                guild_id: "guild",
                name: "standalone-thread",
                type: GUILD_PRIVATE_THREAD,
            },
            {},
            "user",
            { keepId: true, skipEventEmit: true, skipNameChecks: true, skipPermissionCheck: true },
        );

        assert.equal(thread.id, "generated-1");
        assert.deepEqual(
            findOneCalls.map((call) => call.where?.id),
            ["generated-1"],
        );
    });

    test("emits thread member updates with the persisted thread guild id", async () => {
        const findOneCalls: FindOneOptionsWithId[] = [];
        stubThreadPersistence(findOneCalls, { savedGuildId: "persisted-guild" });
        Object.assign(Snowflake, {
            generate: () => "generated-thread-id",
        });

        const thread = await Channel.createThreadChannel(
            {
                parent_id: "parent",
                guild_id: "guild",
                name: "event-thread",
                type: GUILD_PRIVATE_THREAD,
            },
            {},
            "user",
            { skipNameChecks: true, skipPermissionCheck: true },
        );

        assert.deepEqual(
            emittedEvents.map((event) => (typeof event === "object" && event !== null && "event" in event ? event.event : undefined)),
            ["THREAD_CREATE", "THREAD_MEMBERS_UPDATE"],
        );
        const [threadCreateEvent, threadMembersUpdateEvent] = emittedEvents as [
            { event: "THREAD_CREATE"; guild_id: string; data: { guild_id: string } },
            { event: "THREAD_MEMBERS_UPDATE"; guild_id: string; data: { guild_id: string; member_count: number } },
        ];

        assert.equal(thread.guild_id, "persisted-guild");
        assert.equal(threadCreateEvent?.guild_id, "persisted-guild");
        assert.equal(threadCreateEvent?.data.guild_id, "persisted-guild");
        assert.equal(threadMembersUpdateEvent?.guild_id, "persisted-guild");
        assert.equal(threadMembersUpdateEvent?.data.guild_id, "persisted-guild");
        assert.equal(threadMembersUpdateEvent?.data.member_count, 1);
    });

    test("rejects a caller guild id that differs from the parent guild id before saving", async () => {
        const findOneCalls: FindOneOptionsWithId[] = [];
        stubThreadPersistence(findOneCalls, { parentGuildId: "parent-guild" });
        let saveCalled = false;
        let createForUserCalled = false;
        Object.assign(Channel.prototype, {
            save: async function (this: ChannelEntity) {
                saveCalled = true;
                return this;
            },
        });
        Object.assign(ThreadMember, {
            createForUser: async () => {
                createForUserCalled = true;
                throw new Error("ThreadMember.createForUser should not be called");
            },
        });

        await assert.rejects(
            () =>
                Channel.createThreadChannel(
                    {
                        parent_id: "parent",
                        guild_id: "input-guild",
                        name: "event-thread",
                        type: GUILD_PRIVATE_THREAD,
                    },
                    {},
                    "user",
                    { skipNameChecks: true, skipPermissionCheck: true },
                ),
            /same guild as the parent/,
        );

        assert.equal(saveCalled, false);
        assert.equal(createForUserCalled, false);
        assert.deepEqual(findOneCalls, []);
        assert.deepEqual(emittedEvents, []);
    });

    test("rejects a parent without a guild id before saving", async () => {
        const findOneCalls: FindOneOptionsWithId[] = [];
        stubThreadPersistence(findOneCalls, { parentGuildId: null });
        let saveCalled = false;
        let createForUserCalled = false;
        Object.assign(Channel.prototype, {
            save: async function (this: ChannelEntity) {
                saveCalled = true;
                return this;
            },
        });
        Object.assign(ThreadMember, {
            createForUser: async () => {
                createForUserCalled = true;
                throw new Error("ThreadMember.createForUser should not be called");
            },
        });

        await assert.rejects(
            () =>
                Channel.createThreadChannel(
                    {
                        parent_id: "parent",
                        name: "event-thread",
                        type: GUILD_PRIVATE_THREAD,
                    },
                    {},
                    "user",
                    { skipNameChecks: true, skipPermissionCheck: true },
                ),
            /Parent channel guild id not set/,
        );

        assert.equal(saveCalled, false);
        assert.equal(createForUserCalled, false);
        assert.deepEqual(findOneCalls, []);
        assert.deepEqual(emittedEvents, []);
    });

    test("rejects before creating a thread member when the saved thread has no guild id", async () => {
        const findOneCalls: FindOneOptionsWithId[] = [];
        stubThreadPersistence(findOneCalls, { savedGuildId: null });
        Object.assign(Snowflake, {
            generate: () => "generated-thread-id",
        });
        let createForUserCalled = false;
        Object.assign(ThreadMember, {
            createForUser: async () => {
                createForUserCalled = true;
                throw new Error("ThreadMember.createForUser should not be called");
            },
        });

        await assert.rejects(
            () =>
                Channel.createThreadChannel(
                    {
                        parent_id: "parent",
                        guild_id: "guild",
                        name: "event-thread",
                        type: GUILD_PRIVATE_THREAD,
                    },
                    {},
                    "user",
                    { skipNameChecks: true, skipPermissionCheck: true },
                ),
            /Thread guild id not set/,
        );

        assert.equal(createForUserCalled, false);
        assert.deepEqual(emittedEvents, []);
    });

    test("preserves an explicit id when keepId is set for message threads", async () => {
        const findOneCalls: FindOneOptionsWithId[] = [];
        stubThreadPersistence(findOneCalls);
        Object.assign(Snowflake, {
            generate: () => "generated-thread-id",
        });

        const thread = await Channel.createThreadChannel(
            {
                id: "message-id",
                parent_id: "parent",
                guild_id: "guild",
                name: "message-thread",
                type: GUILD_PUBLIC_THREAD,
            },
            {},
            "user",
            { keepId: true, skipEventEmit: true, skipNameChecks: true, skipPermissionCheck: true },
        );

        assert.equal(thread.id, "message-id");
        assert.deepEqual(
            findOneCalls.map((call) => call.where?.id),
            ["message-id"],
        );
    });

    test("keeps threads out of guild channel ordering with position zero", async () => {
        const findOneCalls: FindOneOptionsWithId[] = [];
        stubThreadPersistence(findOneCalls);
        Object.assign(Snowflake, {
            generate: () => "generated-thread-id",
        });
        let orderInsertCalls = 0;
        Object.assign(Guild, {
            insertChannelInOrder: async () => {
                orderInsertCalls += 1;
                return 1;
            },
        });

        const thread = await Channel.createThreadChannel(
            {
                parent_id: "parent",
                guild_id: "guild",
                name: "unordered-thread",
                position: 42,
                type: GUILD_PUBLIC_THREAD,
            },
            {},
            "user",
            { skipEventEmit: true, skipNameChecks: true, skipPermissionCheck: true },
        );

        assert.equal(thread.position, 0);
        assert.equal(orderInsertCalls, 0);
    });

    test("emits the creator membership update with the saved thread member count", async () => {
        const findOneCalls: FindOneOptionsWithId[] = [];
        stubThreadPersistence(findOneCalls);
        Object.assign(Snowflake, {
            generate: () => "generated-thread-id",
        });
        const savedMemberCount = 7;
        Object.assign(Channel.prototype, {
            save: async function (this: ChannelEntity) {
                this.member_count = savedMemberCount;
                return this;
            },
        });

        const thread = await Channel.createThreadChannel(
            {
                parent_id: "parent",
                guild_id: "guild",
                name: "standalone-thread",
                type: GUILD_PRIVATE_THREAD,
            },
            {},
            "user",
            { skipNameChecks: true, skipPermissionCheck: true },
        );

        const threadMembersUpdate = emittedEvents.find((event) => event.event === "THREAD_MEMBERS_UPDATE");

        assert.equal(thread.member_count, savedMemberCount);
        assert.ok(threadMembersUpdate);
        assert.equal(threadMembersUpdate.data.id, "generated-thread-id");
        assert.equal(threadMembersUpdate.data.guild_id, "guild");
        assert.equal(threadMembersUpdate.data.member_count, savedMemberCount);
        assert.deepEqual(threadMembersUpdate.data.removed_member_ids, []);
        assert.deepEqual(threadMembersUpdate.data.added_members, [{ user_id: "user", id: "generated-thread-id" }]);
    });
});
