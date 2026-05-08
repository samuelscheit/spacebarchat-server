import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { closeDatabase, Config, generateToken, initDatabase, Message, ReadState, User } from "@spacebar/util";
import { ChannelType } from "@spacebar/schemas";
import { assertNoEvent } from "../assertions/events";
import { assertJsonObject, assertStatus } from "../assertions/http";
import { createDisposablePostgresDatabase, hasPostgresAdminUrl } from "../fixtures/database";
import { captureEvents } from "../fixtures/events";
import { startApi } from "../server/startApi";

type EventCapture = Awaited<ReturnType<typeof captureEvents>>;
type CapturedEvent = EventCapture["events"][number];

const coveredManifestIds = [
    "api:http:DELETE:/channels/:channel_id/messages/:message_id/reactions/",
    "api:http:DELETE:/channels/:channel_id/messages/:message_id/reactions/:emoji",
    "api:http:DELETE:/channels/:channel_id/messages/:message_id/reactions/:emoji/:burst/:user_id",
    "api:http:DELETE:/channels/:channel_id/messages/:message_id/reactions/:emoji/:user_id",
    "api:http:DELETE:/channels/:channel_id/messages/:message_id/reactions/:emoji/@me",
    "api:http:GET:/channels/:channel_id/directory-entries/",
    "api:http:GET:/channels/:channel_id/messages/:message_id/reactions/:emoji",
    "api:http:GET:/channels/:channel_id/messages/search/",
    "api:http:POST:/channels/:channel_id/messages/:message_id/ack/",
    "api:http:POST:/channels/:channel_id/messages/:message_id/crosspost/",
    "api:http:POST:/channels/:channel_id/messages/bulk-delete/",
    "api:http:POST:/channels/:channel_id/post-data/",
    "api:http:POST:/channels/preload-messages/",
    "api:http:PUT:/channels/:channel_id/messages/:message_id/reactions/:emoji/@me",
];
const eventTimeoutMs = 1000;
const reactionEmoji = encodeURIComponent("😀");

test(
    "channel supplemental routes persist reactions, read acknowledgements, search, preload, and bulk delete state",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 180_000,
    },
    async () => {
        assert.deepEqual(coveredManifestIds, [
            "api:http:DELETE:/channels/:channel_id/messages/:message_id/reactions/",
            "api:http:DELETE:/channels/:channel_id/messages/:message_id/reactions/:emoji",
            "api:http:DELETE:/channels/:channel_id/messages/:message_id/reactions/:emoji/:burst/:user_id",
            "api:http:DELETE:/channels/:channel_id/messages/:message_id/reactions/:emoji/:user_id",
            "api:http:DELETE:/channels/:channel_id/messages/:message_id/reactions/:emoji/@me",
            "api:http:GET:/channels/:channel_id/directory-entries/",
            "api:http:GET:/channels/:channel_id/messages/:message_id/reactions/:emoji",
            "api:http:GET:/channels/:channel_id/messages/search/",
            "api:http:POST:/channels/:channel_id/messages/:message_id/ack/",
            "api:http:POST:/channels/:channel_id/messages/:message_id/crosspost/",
            "api:http:POST:/channels/:channel_id/messages/bulk-delete/",
            "api:http:POST:/channels/:channel_id/post-data/",
            "api:http:POST:/channels/preload-messages/",
            "api:http:PUT:/channels/:channel_id/messages/:message_id/reactions/:emoji/@me",
        ]);

        const database = await createDisposablePostgresDatabase({ prefix: "spacebar_channels_supplemental" });
        const tempCwd = await mkdtemp(path.join(tmpdir(), "spacebar-channels-supplemental-"));
        const previous = snapshotProcessState();
        let api: Awaited<ReturnType<typeof startApi>> | undefined;
        let events: EventCapture | undefined;

        try {
            process.chdir(tempCwd);
            process.env.DATABASE = database.url;
            process.env.APPLY_DB_MIGRATIONS = "true";
            process.env.LOG_ROUTES = "false";
            process.env.CONFIG_PATH = path.join(tempCwd, "config.json");
            process.env.CONFIG_READONLY = "true";
            delete process.env.DB_SYNC;
            await writeFile(
                process.env.CONFIG_PATH,
                JSON.stringify({
                    general: { serverName: "localhost" },
                    api: { endpointPublic: "http://localhost:3001/api/v9" },
                    cdn: { endpointPublic: "http://localhost:3003", endpointPrivate: "http://127.0.0.1:3003" },
                    gateway: { endpointPublic: "ws://localhost:3002" },
                    guild: {
                        autoJoin: {
                            enabled: false,
                            guilds: [],
                            canLeave: true,
                            bots: false,
                        },
                    },
                }),
            );
            await Config.init(true);
            await initDatabase();
            api = await startApi();

            const suffix = `${process.pid}${Date.now()}`;
            const owner = await registerUser(`channelsupp${suffix.slice(-8)}`, `channel-supp-${suffix}@example.com`);
            const token = await generateToken(owner.id);
            assert.ok(token, "token generation should return a bearer token");

            const createdGuild = await postJson(`${api.apiBaseUrl}/guilds`, { name: `channel-supp-${suffix.slice(-8)}` }, token);
            await assertStatus(createdGuild, 201);
            const guildId = (await assertJsonObject(createdGuild)).id as string;
            const channels = await getJsonArray(`${api.apiBaseUrl}/guilds/${guildId}/channels`, token);
            const channelId = channels[0].id as string;
            const createNews = await postJson(`${api.apiBaseUrl}/guilds/${guildId}/channels`, { name: "scenario-news", type: ChannelType.GUILD_NEWS }, token);
            await assertStatus(createNews, 201);
            const newsChannelId = (await assertJsonObject(createNews)).id as string;
            events = await captureEvents([channelId, newsChannelId, owner.id]);

            const messageId = await createMessage(api.apiBaseUrl, channelId, "channel supplemental searchable marker", token);
            const newsMessageId = await createMessage(api.apiBaseUrl, newsChannelId, "channel supplemental crosspost marker", token);
            await coverReactionRoutes(api.apiBaseUrl, channelId, messageId, token, owner.id, events);
            await coverAckSearchPreloadAndStubs(api.apiBaseUrl, channelId, messageId, newsChannelId, newsMessageId, token, owner.id, events);
            await coverBulkDelete(api.apiBaseUrl, channelId, token, events);
        } finally {
            if (events) await events.stop();
            if (api) await api.stop();
            await closeDatabase();
            await database.close();
            restoreProcessState(previous);
            await rm(tempCwd, { recursive: true, force: true });
        }
    },
);

async function coverReactionRoutes(apiBaseUrl: string, channelId: string, messageId: string, token: string, ownerId: string, events: EventCapture) {
    await addReaction(apiBaseUrl, channelId, messageId, token, events);
    const reactionUsers = await getJsonArray(`${apiBaseUrl}/channels/${channelId}/messages/${messageId}/reactions/${reactionEmoji}`, token);
    assert.deepEqual(
        reactionUsers.map((user) => user.id),
        [ownerId],
    );

    await removeOwnReaction(apiBaseUrl, channelId, messageId, token, ownerId, events);

    await addReaction(apiBaseUrl, channelId, messageId, token, events);
    await removeUserReaction(apiBaseUrl, channelId, messageId, ownerId, token, events, `${reactionEmoji}/${ownerId}`);

    await addReaction(apiBaseUrl, channelId, messageId, token, events);
    await removeUserReaction(apiBaseUrl, channelId, messageId, ownerId, token, events, `${reactionEmoji}/0/${ownerId}`);

    await addReaction(apiBaseUrl, channelId, messageId, token, events);
    const beforeRemoveEmoji = markCapturedEvents(events);
    await assertStatus(await deleteJson(`${apiBaseUrl}/channels/${channelId}/messages/${messageId}/reactions/${reactionEmoji}`, token), 204);
    await waitForEventAfter(
        events,
        beforeRemoveEmoji,
        (event) => event.event === "MESSAGE_REACTION_REMOVE_EMOJI" && event.channel_id === channelId && event.data.message_id === messageId && event.data.emoji.name === "😀",
    );
    assert.deepEqual((await Message.findOneByOrFail({ id: messageId })).reactions, []);

    await addReaction(apiBaseUrl, channelId, messageId, token, events);
    const beforeRemoveAll = markCapturedEvents(events);
    await assertStatus(await deleteJson(`${apiBaseUrl}/channels/${channelId}/messages/${messageId}/reactions`, token), 204);
    await waitForEventAfter(
        events,
        beforeRemoveAll,
        (event) => event.event === "MESSAGE_REACTION_REMOVE_ALL" && event.channel_id === channelId && event.data.message_id === messageId,
    );
    assert.deepEqual((await Message.findOneByOrFail({ id: messageId })).reactions, []);
}

async function coverAckSearchPreloadAndStubs(
    apiBaseUrl: string,
    channelId: string,
    messageId: string,
    newsChannelId: string,
    newsMessageId: string,
    token: string,
    ownerId: string,
    events: EventCapture,
) {
    assert.deepEqual(await getJsonArray(`${apiBaseUrl}/channels/${channelId}/directory-entries`, token), []);

    const beforeAck = markCapturedEvents(events);
    const ack = await postJson(`${apiBaseUrl}/channels/${channelId}/messages/${messageId}/ack`, { manual: true, mention_count: 2, last_viewed: 42, flags: 1 }, token);
    await assertStatus(ack, 200);
    assert.deepEqual(await assertJsonObject(ack), { token: null });
    await waitForEventAfter(
        events,
        beforeAck,
        (event) => event.event === "MESSAGE_ACK" && event.user_id === ownerId && event.data.channel_id === channelId && event.data.message_id === messageId,
    );
    const readState = await ReadState.findOneByOrFail({ user_id: ownerId, channel_id: channelId });
    assert.equal(readState.last_message_id, messageId);
    assert.equal(readState.last_viewed, 42);
    assert.equal(readState.flags, 1);
    assert.equal(readState.mention_count, 0);

    const search = await assertJsonObject(await getJson(`${apiBaseUrl}/channels/${channelId}/messages/search?content=searchable%20marker`, token));
    assert.equal(search.total_results, 1);
    const searchMessages = search.messages as Array<Array<Record<string, unknown>>>;
    assert.equal(searchMessages[0][0].id, messageId);

    const preload = await jsonArray(await postJson(`${apiBaseUrl}/channels/preload-messages`, { channels: [channelId] }, token));
    assert.equal(preload.length, 1);
    assert.equal(preload[0].id, messageId);
    assert.equal("reactions" in preload[0], false);

    const readStateBeforePostData = readStateCursorSnapshot(readState);
    const beforePostData = markCapturedEvents(events);
    const postData = await assertJsonObject(await postJson(`${apiBaseUrl}/channels/${channelId}/post-data`, { thread_ids: [] }, token));
    assert.deepEqual(postData, { threads: {} });
    assert.deepEqual(readStateCursorSnapshot(await ReadState.findOneByOrFail({ user_id: ownerId, channel_id: channelId })), readStateBeforePostData);
    await assertNoEvent(events, (event) => !beforePostData.has(event) && event.event === "MESSAGE_ACK" && event.user_id === ownerId && event.data.channel_id === channelId, 50);

    const beforeCrosspost = markCapturedEvents(events);
    const crosspost = await assertJsonObject(await postJson(`${apiBaseUrl}/channels/${newsChannelId}/messages/${newsMessageId}/crosspost`, {}, token));
    assert.equal(crosspost.id, newsMessageId);
    assert.equal(crosspost.channel_id, newsChannelId);
    await waitForEventAfter(events, beforeCrosspost, (event) => event.event === "MESSAGE_UPDATE" && event.channel_id === newsChannelId && event.data.id === newsMessageId);
}

async function coverBulkDelete(apiBaseUrl: string, channelId: string, token: string, events: EventCapture) {
    const firstMessageId = await createMessage(apiBaseUrl, channelId, "bulk delete first", token);
    const secondMessageId = await createMessage(apiBaseUrl, channelId, "bulk delete second", token);

    const beforeBulkDelete = markCapturedEvents(events);
    const bulkDelete = await postJson(`${apiBaseUrl}/channels/${channelId}/messages/bulk-delete`, { messages: [firstMessageId, secondMessageId] }, token);
    await assertStatus(bulkDelete, 204);
    const event = await waitForEventAfter(
        events,
        beforeBulkDelete,
        (candidate) => candidate.event === "MESSAGE_DELETE_BULK" && candidate.channel_id === channelId && candidate.data.ids.includes(firstMessageId),
    );
    assert.deepEqual([...event.data.ids].sort(), [firstMessageId, secondMessageId].sort());
    assert.equal(await Message.findOneBy({ id: firstMessageId }), null);
    assert.equal(await Message.findOneBy({ id: secondMessageId }), null);
}

async function addReaction(apiBaseUrl: string, channelId: string, messageId: string, token: string, events: EventCapture) {
    const beforeAdd = markCapturedEvents(events);
    await assertStatus(await putJson(`${apiBaseUrl}/channels/${channelId}/messages/${messageId}/reactions/${reactionEmoji}/@me`, {}, token), 204);
    await waitForEventAfter(
        events,
        beforeAdd,
        (event) => event.event === "MESSAGE_REACTION_ADD" && event.channel_id === channelId && event.data.message_id === messageId && event.data.emoji.name === "😀",
    );
    const reactions = (await Message.findOneByOrFail({ id: messageId })).reactions;
    assert.equal(reactions.length, 1);
    assert.equal(reactions[0].count, 1);
    assert.equal(reactions[0].emoji.name, "😀");
}

async function removeOwnReaction(apiBaseUrl: string, channelId: string, messageId: string, token: string, ownerId: string, events: EventCapture) {
    await removeUserReaction(apiBaseUrl, channelId, messageId, ownerId, token, events, `${reactionEmoji}/@me`);
}

async function removeUserReaction(apiBaseUrl: string, channelId: string, messageId: string, ownerId: string, token: string, events: EventCapture, reactionPath: string) {
    const beforeRemove = markCapturedEvents(events);
    await assertStatus(await deleteJson(`${apiBaseUrl}/channels/${channelId}/messages/${messageId}/reactions/${reactionPath}`, token), 204);
    await waitForEventAfter(
        events,
        beforeRemove,
        (event) =>
            event.event === "MESSAGE_REACTION_REMOVE" &&
            event.channel_id === channelId &&
            event.data.message_id === messageId &&
            event.data.user_id === ownerId &&
            event.data.emoji.name === "😀",
    );
    assert.deepEqual((await Message.findOneByOrFail({ id: messageId })).reactions, []);
}

async function createMessage(apiBaseUrl: string, channelId: string, content: string, token: string) {
    const response = await postJson(`${apiBaseUrl}/channels/${channelId}/messages`, { content }, token);
    await assertStatus(response, 200);
    return (await assertJsonObject(response)).id as string;
}

function markCapturedEvents(capture: EventCapture) {
    return new Set(capture.events);
}

function readStateCursorSnapshot(readState: ReadState) {
    return {
        flags: readState.flags,
        last_message_id: readState.last_message_id,
        last_viewed: readState.last_viewed,
        mention_count: readState.mention_count,
        notifications_cursor: readState.notifications_cursor,
    };
}

async function waitForEventAfter(capture: EventCapture, previousEvents: Set<CapturedEvent>, predicate: (event: CapturedEvent) => boolean) {
    return await capture.waitFor((event) => !previousEvents.has(event) && predicate(event), eventTimeoutMs);
}

async function registerUser(username: string, email: string) {
    return await User.register({
        username,
        email,
        password: "not-a-real-login-hash",
    });
}

async function getJson(url: string, token: string) {
    return await fetch(url, {
        headers: {
            authorization: `Bearer ${token}`,
        },
    });
}

async function getJsonArray(url: string, token: string) {
    const response = await getJson(url, token);
    await assertStatus(response, 200);
    return await jsonArray(response);
}

async function jsonArray(response: Response) {
    const body = await response.json();
    assert.ok(Array.isArray(body));
    return body as Array<Record<string, unknown>>;
}

async function postJson(url: string, body: unknown, token: string) {
    return await fetch(url, {
        method: "POST",
        headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
        },
        body: JSON.stringify(body),
    });
}

async function putJson(url: string, body: unknown, token: string) {
    return await fetch(url, {
        method: "PUT",
        headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
        },
        body: JSON.stringify(body),
    });
}

async function deleteJson(url: string, token: string) {
    return await fetch(url, {
        method: "DELETE",
        headers: {
            authorization: `Bearer ${token}`,
        },
    });
}

function snapshotProcessState() {
    return {
        cwd: process.cwd(),
        DATABASE: process.env.DATABASE,
        APPLY_DB_MIGRATIONS: process.env.APPLY_DB_MIGRATIONS,
        CONFIG_PATH: process.env.CONFIG_PATH,
        CONFIG_READONLY: process.env.CONFIG_READONLY,
        DB_SYNC: process.env.DB_SYNC,
        LOG_ROUTES: process.env.LOG_ROUTES,
    };
}

function restoreProcessState(state: ReturnType<typeof snapshotProcessState>) {
    process.chdir(state.cwd);
    restoreEnv("DATABASE", state.DATABASE);
    restoreEnv("APPLY_DB_MIGRATIONS", state.APPLY_DB_MIGRATIONS);
    restoreEnv("CONFIG_PATH", state.CONFIG_PATH);
    restoreEnv("CONFIG_READONLY", state.CONFIG_READONLY);
    restoreEnv("DB_SYNC", state.DB_SYNC);
    restoreEnv("LOG_ROUTES", state.LOG_ROUTES);
}

function restoreEnv(name: string, value: string | undefined) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
}
