import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { createRequire } from "node:module";

type ChannelEntity = import("../entities/Channel").Channel;
type GuildEntity = import("../entities/Guild").Guild;
type SnowflakeClass = typeof import("./Snowflake").Snowflake;
type ChannelClass = typeof import("../entities/Channel").Channel;
type GuildClass = typeof import("../entities/Guild").Guild;
type ThreadMemberClass = typeof import("../entities/ThreadMember").ThreadMember;
type SerializeThreadMemberPayload = typeof import("../entities/ThreadMember").serializeThreadMemberPayload;
type CapturedEvent = { event: string; data?: Record<string, unknown> };

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
const emittedEvents: CapturedEvent[] = [];

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
    emitEvent: async (event: CapturedEvent) => {
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
const { ThreadMember, serializeThreadMemberPayload } = localRequire("../entities/ThreadMember") as {
    ThreadMember: ThreadMemberClass;
    serializeThreadMemberPayload: SerializeThreadMemberPayload;
};

const originals = {
    channelFindOne: Channel.findOne,
    channelFindOneOrFail: Channel.findOneOrFail,
    channelSave: Channel.prototype.save,
    guildFindOneOrFail: Guild.findOneOrFail,
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
    });
    Object.assign(Snowflake, {
        generate: originals.snowflakeGenerate,
    });
    Object.assign(ThreadMember, {
        createForUser: originals.threadMemberCreateForUser,
    });
    emittedEvents.length = 0;
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
    test("serializes thread member event payloads without ORM-only fields", () => {
        const payload = serializeThreadMemberPayload(
            {
                id: "thread-id",
                index: "internal-row-id",
                member_idx: "internal-member-index",
                join_timestamp: new Date("2026-01-02T03:04:05.000Z"),
                muted: true,
                mute_config: {
                    end_time: new Date("2026-01-03T04:05:06.000Z"),
                    selected_time_window: 3600,
                },
                flags: 2,
                member: { id: "user" },
                channel: { id: "thread-id" },
                toJSON: () => ({
                    id: "thread-id",
                    index: "internal-row-id",
                    member_idx: "internal-member-index",
                    member: { id: "user" },
                    channel: { id: "thread-id" },
                }),
            } as Parameters<typeof serializeThreadMemberPayload>[0],
            "user",
        );

        assert.deepEqual(payload, {
            id: "thread-id",
            user_id: "user",
            join_timestamp: "2026-01-02T03:04:05.000Z",
            muted: true,
            mute_config: {
                end_time: "2026-01-03T04:05:06.000Z",
                selected_time_window: 3600,
            },
            flags: 2,
        });
        assert.equal("index" in payload, false);
        assert.equal("member_idx" in payload, false);
        assert.equal("member" in payload, false);
        assert.equal("channel" in payload, false);
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

    test("serializes the loaded creator member as thread owner", async () => {
        const findOneCalls: FindOneOptionsWithId[] = [];
        stubThreadPersistence(findOneCalls);
        Object.assign(Snowflake, {
            generate: () => "owned-thread",
        });

        const publicOwner = {
            id: "user",
            guild_id: "guild",
            roles: ["role"],
            user: { id: "user", username: "owner" },
        };
        Object.assign(ThreadMember, {
            createForUser: async (userId: string, thread: Pick<ChannelEntity, "id" | "guild_id">) =>
                ({
                    id: thread.id,
                    index: "internal-row-id",
                    member_idx: "internal-member-index",
                    join_timestamp: new Date("2026-01-01T00:00:00.000Z"),
                    muted: false,
                    flags: 0,
                    member: {
                        id: userId,
                        toPublicMember: () => publicOwner,
                    },
                    channel: { id: thread.id },
                    toJSON: () => ({ id: thread.id }),
                }) as unknown,
        });

        const thread = await Channel.createThreadChannel(
            {
                parent_id: "parent",
                guild_id: "guild",
                name: "owned-thread",
                type: GUILD_PRIVATE_THREAD,
            },
            {},
            "user",
            { skipEventEmit: true, skipNameChecks: true, skipPermissionCheck: true },
        );

        assert.equal(thread.owner_id, "user");
        assert.equal(thread.thread_members?.length, 1);
        const json = thread.toJSON();
        assert.deepEqual(json.owner, publicOwner);
        assert.deepEqual(json.member_ids_preview, ["user"]);
        assert.equal((json as { thread_members?: unknown }).thread_members, undefined);
    });

    test("serializes the loaded creator member as thread owner in the default create event", async () => {
        const findOneCalls: FindOneOptionsWithId[] = [];
        stubThreadPersistence(findOneCalls);
        Object.assign(Snowflake, {
            generate: () => "event-owned-thread",
        });

        const publicOwner = {
            id: "user",
            guild_id: "guild",
            roles: ["role"],
            user: { id: "user", username: "owner" },
        };
        Object.assign(ThreadMember, {
            createForUser: async (userId: string, thread: Pick<ChannelEntity, "id" | "guild_id">) =>
                ({
                    id: thread.id,
                    index: "internal-row-id",
                    member_idx: "internal-member-index",
                    join_timestamp: new Date("2026-01-01T00:00:00.000Z"),
                    muted: false,
                    flags: 0,
                    member: {
                        id: userId,
                        toPublicMember: () => publicOwner,
                    },
                    channel: { id: thread.id },
                    toJSON: () => ({
                        id: thread.id,
                        index: "internal-row-id",
                        member_idx: "internal-member-index",
                        flags: 0,
                        join_timestamp: "2026-01-01T00:00:00.000Z",
                        member: { id: userId },
                        channel: { id: thread.id },
                    }),
                }) as unknown,
        });

        await Channel.createThreadChannel(
            {
                parent_id: "parent",
                guild_id: "guild",
                name: "event-owned-thread",
                type: GUILD_PRIVATE_THREAD,
            },
            {},
            "user",
            { skipNameChecks: true, skipPermissionCheck: true },
        );

        const threadCreate = emittedEvents.find((event) => event.event === "THREAD_CREATE");
        assert.ok(threadCreate);
        assert.deepEqual(threadCreate.data?.owner, publicOwner);
        assert.deepEqual(threadCreate.data?.member_ids_preview, ["user"]);
        assert.equal(threadCreate.data?.thread_members, undefined);

        const threadMembersUpdate = emittedEvents.find((event) => event.event === "THREAD_MEMBERS_UPDATE");
        assert.ok(threadMembersUpdate);
        const addedMember = (threadMembersUpdate.data?.added_members as Record<string, unknown>[] | undefined)?.[0];
        assert.deepEqual(addedMember, {
            id: "event-owned-thread",
            user_id: "user",
            join_timestamp: "2026-01-01T00:00:00.000Z",
            muted: false,
            flags: 0,
        });
        assert.equal(addedMember?.index, undefined);
        assert.equal(addedMember?.member_idx, undefined);
        assert.equal(addedMember?.member, undefined);
        assert.equal(addedMember?.channel, undefined);
    });

    test("omits thread owner when thread member relations are not loaded", () => {
        const thread = Object.assign(new Channel(), {
            id: "thread-without-members",
            guild_id: "guild",
            owner_id: "user",
            type: GUILD_PRIVATE_THREAD,
            created_at: new Date("2026-01-01T00:00:00.000Z"),
            nsfw: false,
        });

        const json = thread.toJSON();
        assert.equal(json.owner, undefined);
        assert.equal(json.member_ids_preview, undefined);
    });

    test("omits thread owner when thread member rows are loaded without member relations", () => {
        const thread = Object.assign(new Channel(), {
            id: "thread-without-member-relations",
            guild_id: "guild",
            owner_id: "user",
            type: GUILD_PRIVATE_THREAD,
            created_at: new Date("2026-01-01T00:00:00.000Z"),
            nsfw: false,
            thread_members: [{ id: "thread-without-member-relations", member_idx: "internal-member-row-index" }],
        });

        const json = thread.toJSON();
        assert.equal(json.owner, undefined);
        assert.equal(json.member_ids_preview, undefined);
        assert.equal((json as { thread_members?: unknown }).thread_members, undefined);
    });

    test("serializes null thread owner when loaded member relations do not include owner", () => {
        const thread = Object.assign(new Channel(), {
            id: "thread-with-missing-owner",
            guild_id: "guild",
            owner_id: "user",
            type: GUILD_PRIVATE_THREAD,
            created_at: new Date("2026-01-01T00:00:00.000Z"),
            nsfw: false,
            thread_members: [{ id: "thread-with-missing-owner", member: { id: "other-user" } }],
        });

        const json = thread.toJSON();
        assert.equal(json.owner, null);
        assert.deepEqual(json.member_ids_preview, ["other-user"]);
    });
});
