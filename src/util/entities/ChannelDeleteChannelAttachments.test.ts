import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

type ChannelModule = typeof import("./Channel");
type InviteModule = typeof import("./Invite");

const localRequire = createRequire(__filename);
const fallbackSchemaValue = new Proxy(Object.create(null), {
    get: (_target, property) => {
        if (property === Symbol.toPrimitive) return () => 0;
        if (property === "then") return undefined;
        if (property === "toString") return () => "0";
        if (property === "valueOf") return () => 0;
        return fallbackSchemaValue;
    },
});
const schemasMock = new Proxy(
    {
        ApplicationCommandType: { CHAT_INPUT: 1 },
        ChannelType: {
            DM: 1,
            GROUP_DM: 3,
            GUILD_CATEGORY: 4,
            GUILD_NEWS_THREAD: 10,
            GUILD_PUBLIC_THREAD: 11,
            GUILD_PRIVATE_THREAD: 12,
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

(localRequire.cache as Record<string, { exports: unknown } | undefined>)[localRequire.resolve("@spacebar/schemas")] = { exports: schemasMock };

let activeDeleteOrderCalls: string[] | undefined;
const cdnDeleteCalls: string[] = [];
const utilMock = new Proxy(
    {
        Config: {
            get: () => ({
                guild: { publicThreadsInvitable: false },
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
        Snowflake: { generate: () => "snowflake" },
        assertChannelNamePresent: () => undefined,
        assertExistingGroupDmRecipient: () => undefined,
        canCreateServerDm: () => false,
        deleteFile: async (path: string) => {
            cdnDeleteCalls.push(path);
            activeDeleteOrderCalls?.push("deleteFile");
        },
        emitEvent: async () => undefined,
        getAttachmentMutationPath: (uploadFilename: string) => `/attachments/${uploadFilename}`,
        getDatabase: () => null,
        getPermission: async () => ({ hasThrow: () => undefined }),
        handleFile: async () => undefined,
        isGuildOwner: () => false,
        normalizeChannelName: (value?: string) => value,
        normalizeThreadName: (value?: string) => value,
        shouldCheckServerDmPrivacy: () => false,
        trimSpecial: (value?: string) => value,
    },
    {
        get: (target, property) => {
            if (property in target) return target[property as keyof typeof target];
            return fallbackSchemaValue;
        },
    },
);

for (const path of [localRequire.resolve("../util"), localRequire.resolve("..")]) {
    (localRequire.cache as Record<string, { exports: unknown } | undefined>)[path] = { exports: utilMock };
}

function mockModule(path: string, exports: unknown) {
    (localRequire.cache as Record<string, { exports: unknown } | undefined>)[localRequire.resolve(path)] = { exports };
}

mockModule("../util/ChannelName", utilMock);
mockModule("../util/Config", { Config: utilMock.Config });
mockModule("../util/Constants", { DiscordApiErrors: utilMock.DiscordApiErrors });
mockModule("../util/Database", { getDatabase: utilMock.getDatabase });
mockModule("../util/DmPrivacy", { canCreateServerDm: utilMock.canCreateServerDm, shouldCheckServerDmPrivacy: utilMock.shouldCheckServerDmPrivacy });
mockModule("../util/Event", { emitEvent: utilMock.emitEvent });
mockModule("../util/GuildFeatures", { GuildFeature: utilMock.GuildFeature });
mockModule("../util/GroupDmRecipients", { assertExistingGroupDmRecipient: utilMock.assertExistingGroupDmRecipient });
mockModule("../util/InternalCdnRoutes", { getAttachmentMutationPath: utilMock.getAttachmentMutationPath });
mockModule("../util/Permissions", utilMock);
mockModule("../util/Snowflake", { Snowflake: utilMock.Snowflake });
mockModule("../util/String", { trimSpecial: utilMock.trimSpecial });
mockModule("../util/cdn", { deleteFile: utilMock.deleteFile, handleFile: utilMock.handleFile });

const { Channel, getChannelAttachmentDeletePath, getChannelAttachmentDeletePaths } = localRequire("./Channel") as ChannelModule;
const { Invite } = localRequire("./Invite") as InviteModule;

type RawAttachmentRow = { id?: string; channel_id?: string | null; message_id?: string | null; filename?: string | null };
type RawCloudAttachmentRow = { uploadFilename?: string | null };

type QueryBuilder = {
    leftJoin(...args: unknown[]): QueryBuilder;
    select(...args: unknown[]): QueryBuilder;
    addSelect(...args: unknown[]): QueryBuilder;
    where(...args: unknown[]): QueryBuilder;
    orWhere(...args: unknown[]): QueryBuilder;
    getRawMany(): Promise<unknown[]>;
};

type FakeEntityManager = {
    getRepository(target: unknown): { createQueryBuilder(alias: string): QueryBuilder };
    delete(target: unknown, criteria: unknown): Promise<void>;
    findOne(target: unknown, options: unknown): Promise<null>;
    findOneOrFail(target: unknown, options: unknown): Promise<{ channel_ordering: string[] }>;
    update(target: unknown, criteria: unknown, value: unknown): Promise<void>;
};

type FakeDatabase = {
    getRepository(target: unknown): { createQueryBuilder(alias: string): QueryBuilder };
    transaction<T>(callback: (entityManager: FakeEntityManager) => Promise<T>): Promise<T>;
};

type FakeDatabaseOptions = {
    attachmentRows?: RawAttachmentRow[];
    cloudAttachmentRows?: RawCloudAttachmentRow[];
    throwInTransaction?: boolean;
};

function createQueryBuilder(calls: string[], alias: string, rows: unknown[]): QueryBuilder {
    const record = (method: string, args: unknown[]) => calls.push(`${alias}.${method}:${JSON.stringify(args)}`);
    const queryBuilder: QueryBuilder = {
        leftJoin: (...args) => {
            record("leftJoin", args);
            return queryBuilder;
        },
        select: (...args) => {
            record("select", args);
            return queryBuilder;
        },
        addSelect: (...args) => {
            record("addSelect", args);
            return queryBuilder;
        },
        where: (...args) => {
            record("where", args);
            return queryBuilder;
        },
        orWhere: (...args) => {
            record("orWhere", args);
            return queryBuilder;
        },
        getRawMany: async () => {
            calls.push(`${alias}.getRawMany`);
            return rows;
        },
    };
    return queryBuilder;
}

function createFakeDatabase(calls: string[], options: FakeDatabaseOptions = {}): FakeDatabase {
    const attachmentRows = options.attachmentRows ?? [{ id: "message", channel_id: null, message_id: "message", filename: "file.png" }];
    const cloudAttachmentRows = options.cloudAttachmentRows ?? [];
    const getRepository = (target: unknown) => ({
        createQueryBuilder: (alias: string) => {
            calls.push(`snapshot:${(target as { name?: string }).name ?? "unknown"}:${alias}`);
            const rows = (target as { name?: string }).name === "CloudAttachment" ? cloudAttachmentRows : attachmentRows;
            return createQueryBuilder(calls, alias, rows);
        },
    });

    return {
        getRepository,
        async transaction(callback) {
            calls.push("transaction:start");
            const entityManager: FakeEntityManager = {
                getRepository,
                async delete(_target, criteria) {
                    calls.push(`delete:${JSON.stringify(criteria)}`);
                },
                async findOne() {
                    calls.push("findVanityGuild");
                    return null;
                },
                async findOneOrFail() {
                    calls.push("findGuild");
                    return { channel_ordering: ["channel", "other"] };
                },
                async update(_target, criteria, value) {
                    calls.push(`update:${JSON.stringify(criteria)}:${JSON.stringify(value)}`);
                },
            };
            if (options.throwInTransaction) throw new Error("rollback");
            const result = await callback(entityManager);
            calls.push("transaction:commit");
            return result;
        },
    };
}

test("getChannelAttachmentDeletePath builds the internal CDN attachment deletion path", () => {
    assert.equal(getChannelAttachmentDeletePath({ id: "attachment", channel_id: "channel", message_id: "message", filename: "file.png" }), "/attachments/channel/message/file.png");
});

test("getChannelAttachmentDeletePath skips incomplete attachment rows unless a fallback channel id is available", () => {
    assert.equal(getChannelAttachmentDeletePath({ id: "attachment", channel_id: "", message_id: "message", filename: "file.png" }), undefined);
    assert.equal(
        getChannelAttachmentDeletePath({ id: "attachment", channel_id: "", message_id: "message", filename: "file.png" }, "fallback"),
        "/attachments/fallback/message/file.png",
    );
    assert.equal(getChannelAttachmentDeletePath({ id: "attachment", channel_id: "channel", message_id: "", filename: "file.png" }), undefined);
    assert.equal(getChannelAttachmentDeletePath({ id: "attachment", channel_id: "channel", message_id: "message", filename: "" }), undefined);
});

test("getChannelAttachmentDeletePaths snapshots message, legacy, thread-fallback, and cloud upload paths", async () => {
    const calls: string[] = [];
    const database = createFakeDatabase(calls, {
        attachmentRows: [
            { id: "attachment", channel_id: "channel", message_id: "message", filename: "file.png" },
            { id: "same-as-message", channel_id: "channel", message_id: "same-as-message", filename: "dedupe.png" },
            { id: "thread-starter-attachment", channel_id: null, message_id: "thread-starter", filename: "starter.png" },
            { id: "incomplete", channel_id: "channel", message_id: null, filename: "skip.png" },
        ],
        cloudAttachmentRows: [{ uploadFilename: "channel/batch/0/cloud.png" }],
    });

    const paths = await getChannelAttachmentDeletePaths("channel", database as unknown as NonNullable<Parameters<typeof getChannelAttachmentDeletePaths>[1]>);

    assert.deepEqual(paths, [
        "/attachments/channel/message/file.png",
        "/attachments/channel/attachment/file.png",
        "/attachments/channel/same-as-message/dedupe.png",
        "/attachments/channel/thread-starter/starter.png",
        "/attachments/channel/thread-starter-attachment/starter.png",
        "/attachments/channel/batch/0/cloud.png",
    ]);
    assert.ok(calls.some((call) => call.includes('attachment.leftJoin:["attachment.message","message"]')));
    assert.ok(calls.some((call) => call.includes('attachment.orWhere:["message.channel_id = :channelId",{"channelId":"channel"}]')));
    assert.ok(calls.some((call) => call.includes('cloudAttachment.where:["cloudAttachment.channelId = :channelId",{"channelId":"channel"}]')));
});

test("Channel.deleteChannel snapshots CDN attachment paths inside the delete transaction and deletes them after commit", async () => {
    const calls: string[] = [];
    const database = createFakeDatabase(calls);

    const originalEmitGuildUpdate = Invite.emitGuildUpdate;

    try {
        cdnDeleteCalls.length = 0;
        activeDeleteOrderCalls = calls;
        Invite.emitGuildUpdate = (async () => {
            calls.push("emitGuildUpdate");
        }) as typeof Invite.emitGuildUpdate;

        const channel = Object.assign(new Channel(), { id: "channel", guild_id: "guild" });
        await Channel.deleteChannel(channel, database as unknown as NonNullable<Parameters<typeof Channel.deleteChannel>[1]>);
    } finally {
        activeDeleteOrderCalls = undefined;
        Invite.emitGuildUpdate = originalEmitGuildUpdate;
    }

    assert.deepEqual(cdnDeleteCalls, ["/attachments/channel/message/file.png"]);
    assert.ok(calls.indexOf("transaction:start") < calls.indexOf("snapshot:Attachment:attachment"));
    assert.ok(calls.indexOf("transaction:start") < calls.indexOf("snapshot:CloudAttachment:cloudAttachment"));
    assert.ok(calls.indexOf("snapshot:Attachment:attachment") < calls.findIndex((call) => call.startsWith("delete:")));
    assert.ok(calls.indexOf("transaction:commit") < calls.indexOf("deleteFile"));
});

test("Channel.deleteChannel does not delete CDN files when the database transaction rolls back", async () => {
    const calls: string[] = [];
    const database = createFakeDatabase(calls, { throwInTransaction: true });

    try {
        cdnDeleteCalls.length = 0;
        activeDeleteOrderCalls = calls;

        const channel = Object.assign(new Channel(), { id: "channel", guild_id: "guild" });
        await assert.rejects(() => Channel.deleteChannel(channel, database as unknown as NonNullable<Parameters<typeof Channel.deleteChannel>[1]>), /rollback/);
    } finally {
        activeDeleteOrderCalls = undefined;
    }

    assert.equal(calls.includes("transaction:commit"), false);
    assert.deepEqual(cdnDeleteCalls, []);
});
