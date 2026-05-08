import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { createRequire } from "node:module";

type ChannelEntity = import("../entities/Channel").Channel;
type GuildEntity = import("../entities/Guild").Guild;
type SnowflakeClass = typeof import("./Snowflake").Snowflake;
type ChannelClass = typeof import("../entities/Channel").Channel;
type GuildClass = typeof import("../entities/Guild").Guild;
type ThreadMemberClass = typeof import("../entities/ThreadMember").ThreadMember;
type EmittedEvent = { event: string; data: Record<string, unknown> };

type FindOneOptionsWithId = {
    where?: {
        id?: string;
    };
};

const localRequire = createRequire(__filename);
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
    trimSpecial: (value?: string) => value,
};

for (const path of [localRequire.resolve("."), localRequire.resolve("..")]) {
    (localRequire.cache as Record<string, { exports: unknown } | undefined>)[path] = {
        exports: utilMock,
    };
}

const { Channel } = localRequire("../entities/Channel") as { Channel: ChannelClass };
const { Guild } = localRequire("../entities/Guild") as { Guild: GuildClass };
const { ThreadMember } = localRequire("../entities/ThreadMember") as { ThreadMember: ThreadMemberClass };

const originals = {
    channelFindOne: Channel.findOne,
    channelFindOneOrFail: Channel.findOneOrFail,
    channelSave: Channel.prototype.save,
    guildFindOneOrFail: Guild.findOneOrFail,
    snowflakeGenerate: Snowflake.generate,
    threadMemberCreateForUser: ThreadMember.createForUser,
};

afterEach(() => {
    emittedEvents.length = 0;
    Object.assign(Channel, {
        findOne: originals.channelFindOne,
        findOneOrFail: originals.channelFindOneOrFail,
    });
    Object.assign(Channel.prototype, {
        save: originals.channelSave,
    });
    Object.assign(Guild, {
        findOneOrFail: originals.guildFindOneOrFail,
    });
    Object.assign(Snowflake, {
        generate: originals.snowflakeGenerate,
    });
    Object.assign(ThreadMember, {
        createForUser: originals.threadMemberCreateForUser,
    });
});

function stubThreadPersistence(findOneCalls: FindOneOptionsWithId[]) {
    Object.assign(Channel, {
        findOne: async (options: FindOneOptionsWithId) => {
            findOneCalls.push(options);
            return null;
        },
        findOneOrFail: async () =>
            ({
                id: "parent",
                guild_id: "guild",
                nsfw: false,
                permission_overwrites: [],
            }) satisfies Partial<ChannelEntity>,
    });
    Object.assign(Guild, {
        findOneOrFail: async () =>
            ({
                id: "guild",
                features: [],
            }) satisfies Partial<GuildEntity>,
    });
    Object.assign(Channel.prototype, {
        save: async function (this: ChannelEntity) {
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

describe("Channel.createThreadChannel", () => {
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

    test("emits the creator membership update with the saved thread member count", async () => {
        const findOneCalls: FindOneOptionsWithId[] = [];
        stubThreadPersistence(findOneCalls);
        Object.assign(Snowflake, {
            generate: () => "generated-thread-id",
        });

        await Channel.createThreadChannel(
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

        assert.ok(threadMembersUpdate);
        assert.equal(threadMembersUpdate.data.id, "generated-thread-id");
        assert.equal(threadMembersUpdate.data.guild_id, "guild");
        assert.equal(threadMembersUpdate.data.member_count, 1);
        assert.deepEqual(threadMembersUpdate.data.removed_member_ids, []);
        assert.deepEqual(threadMembersUpdate.data.added_members, [{ user_id: "user", id: "generated-thread-id" }]);
    });
});
