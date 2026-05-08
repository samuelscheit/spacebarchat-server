import assert from "node:assert/strict";
import test from "node:test";
import { Channel, getChannelAttachmentDeletePath, getChannelAttachmentDeletePaths } from "./Channel.js";
import { Config } from "../util/Config.js";
import { Invite } from "./Invite.js";

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

function createJsonResponse(status = 200) {
    return new Response(JSON.stringify({ success: status === 200 }), { status });
}

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
    const fetchCalls: { url: string; init?: RequestInit }[] = [];
    const database = createFakeDatabase(calls);

    const originalGet = Config.get;
    const originalFetch = globalThis.fetch;
    const originalEmitGuildUpdate = Invite.emitGuildUpdate;

    try {
        Config.get = () =>
            ({
                cdn: { endpointPrivate: "https://cdn.example" },
                security: { requestSignature: "signature" },
            }) as ReturnType<typeof Config.get>;
        globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
            fetchCalls.push({ url: String(url), init });
            calls.push("deleteFile");
            return createJsonResponse();
        }) as typeof fetch;
        Invite.emitGuildUpdate = (async () => {
            calls.push("emitGuildUpdate");
        }) as typeof Invite.emitGuildUpdate;

        const channel = Object.assign(new Channel(), { id: "channel", guild_id: "guild" });
        await Channel.deleteChannel(channel, database as unknown as NonNullable<Parameters<typeof Channel.deleteChannel>[1]>);
    } finally {
        Config.get = originalGet;
        globalThis.fetch = originalFetch;
        Invite.emitGuildUpdate = originalEmitGuildUpdate;
    }

    assert.deepEqual(fetchCalls, [
        {
            url: "https://cdn.example/_spacebar/cdn/attachments/channel/message/file.png",
            init: {
                headers: { signature: "signature" },
                method: "DELETE",
            },
        },
    ]);
    assert.ok(calls.indexOf("transaction:start") < calls.indexOf("snapshot:Attachment:attachment"));
    assert.ok(calls.indexOf("transaction:start") < calls.indexOf("snapshot:CloudAttachment:cloudAttachment"));
    assert.ok(calls.indexOf("snapshot:Attachment:attachment") < calls.findIndex((call) => call.startsWith("delete:")));
    assert.ok(calls.indexOf("transaction:commit") < calls.indexOf("deleteFile"));
});

test("Channel.deleteChannel does not delete CDN files when the database transaction rolls back", async () => {
    const calls: string[] = [];
    const fetchCalls: string[] = [];
    const database = createFakeDatabase(calls, { throwInTransaction: true });

    const originalGet = Config.get;
    const originalFetch = globalThis.fetch;

    try {
        Config.get = () =>
            ({
                cdn: { endpointPrivate: "https://cdn.example" },
                security: { requestSignature: "signature" },
            }) as ReturnType<typeof Config.get>;
        globalThis.fetch = (async (url: string | URL | Request) => {
            fetchCalls.push(String(url));
            return createJsonResponse();
        }) as typeof fetch;

        const channel = Object.assign(new Channel(), { id: "channel", guild_id: "guild" });
        await assert.rejects(() => Channel.deleteChannel(channel, database as unknown as NonNullable<Parameters<typeof Channel.deleteChannel>[1]>), /rollback/);
    } finally {
        Config.get = originalGet;
        globalThis.fetch = originalFetch;
    }

    assert.equal(calls.includes("transaction:commit"), false);
    assert.deepEqual(fetchCalls, []);
});
