import assert from "node:assert/strict";
import test from "node:test";
import { Channel, getChannelAttachmentDeletePath } from "./Channel.js";
import { Config } from "../util/Config.js";
import { Invite } from "./Invite.js";

type QueryBuilder = {
    leftJoin(): QueryBuilder;
    select(): QueryBuilder;
    addSelect(): QueryBuilder;
    where(): QueryBuilder;
    orWhere(): QueryBuilder;
    getRawMany(): Promise<{ channel_id?: string; message_id?: string; filename?: string }[]>;
};

type FakeEntityManager = {
    delete(target: unknown, criteria: unknown): Promise<void>;
    findOne(target: unknown, options: unknown): Promise<null>;
    findOneOrFail(target: unknown, options: unknown): Promise<{ channel_ordering: string[] }>;
    update(target: unknown, criteria: unknown, value: unknown): Promise<void>;
};

type FakeDatabase = {
    getRepository(target: unknown): { createQueryBuilder(alias: string): QueryBuilder };
    transaction<T>(callback: (entityManager: FakeEntityManager) => Promise<T>): Promise<T>;
};

function createJsonResponse(status = 200) {
    return {
        status,
        json: async () => ({ success: status === 200 }),
    } as Response;
}

function createFakeDatabase(calls: string[]): FakeDatabase {
    return {
        getRepository: () => ({
            createQueryBuilder: () => {
                calls.push("snapshot");
                const queryBuilder: QueryBuilder = {
                    leftJoin: () => queryBuilder,
                    select: () => queryBuilder,
                    addSelect: () => queryBuilder,
                    where: () => queryBuilder,
                    orWhere: () => queryBuilder,
                    getRawMany: async () => [{ channel_id: null as unknown as string, message_id: "message", filename: "file.png" }],
                };
                return queryBuilder;
            },
        }),
        async transaction(callback) {
            calls.push("transaction:start");
            const entityManager: FakeEntityManager = {
                async delete(_target, criteria) {
                    calls.push(`delete:${JSON.stringify(criteria)}`);
                },
                async findOne() {
                    calls.push("findVanityInvite");
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
            const result = await callback(entityManager);
            calls.push("transaction:commit");
            return result;
        },
    };
}

test("getChannelAttachmentDeletePath builds the internal CDN attachment deletion path", () => {
    assert.equal(getChannelAttachmentDeletePath({ channel_id: "channel", message_id: "message", filename: "file.png" }), "/attachments/channel/message/file.png");
});

test("getChannelAttachmentDeletePath skips incomplete attachment rows unless a fallback channel id is available", () => {
    assert.equal(getChannelAttachmentDeletePath({ channel_id: "", message_id: "message", filename: "file.png" }), undefined);
    assert.equal(getChannelAttachmentDeletePath({ channel_id: "", message_id: "message", filename: "file.png" }, "fallback"), "/attachments/fallback/message/file.png");
    assert.equal(getChannelAttachmentDeletePath({ channel_id: "channel", message_id: "", filename: "file.png" }), undefined);
    assert.equal(getChannelAttachmentDeletePath({ channel_id: "channel", message_id: "message", filename: "" }), undefined);
});

test("Channel.deleteChannel snapshots CDN attachment paths before the delete transaction and deletes them after commit", async () => {
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
    assert.ok(calls.indexOf("snapshot") < calls.indexOf("transaction:start"));
    assert.ok(calls.indexOf("transaction:commit") < calls.indexOf("deleteFile"));
});
