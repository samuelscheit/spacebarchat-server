import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { Channel, closeDatabase, Config, generateToken, Guild, initDatabase, Invite, Message, ReadState, User } from "@spacebar/util";
import { ChannelType } from "@spacebar/schemas";
import { assertJsonObject, assertStatus } from "../assertions/http";
import { createDisposablePostgresDatabase, hasPostgresAdminUrl } from "../fixtures/database";
import { captureEvents } from "../fixtures/events";
import { startApi } from "../server/startApi";

type EventCapture = Awaited<ReturnType<typeof captureEvents>>;
type CapturedEvent = EventCapture["events"][number];
const eventTimeoutMs = 1000;

const coveredManifestIds = [
    "api:http:GET:/guilds/:guild_id/channels/",
    "api:http:POST:/guilds/:guild_id/channels/",
    "api:http:PATCH:/guilds/:guild_id/channels/",
    "api:http:GET:/channels/:channel_id/",
    "api:http:PATCH:/channels/:channel_id/",
    "api:http:DELETE:/channels/:channel_id/",
    "api:http:GET:/channels/:channel_id/invites/",
    "api:http:POST:/channels/:channel_id/invites/",
    "api:http:POST:/channels/:channel_id/typing/",
    "api:http:GET:/channels/:channel_id/messages/",
    "api:http:POST:/channels/:channel_id/messages/",
    "api:http:DELETE:/channels/:channel_id/messages/ack",
    "api:http:GET:/channels/:channel_id/messages/:message_id/",
    "api:http:PATCH:/channels/:channel_id/messages/:message_id/",
    "api:http:DELETE:/channels/:channel_id/messages/:message_id/",
    "api:http:GET:/channels/:channel_id/pins/",
    "api:http:PUT:/channels/:channel_id/pins/:message_id",
    "api:http:DELETE:/channels/:channel_id/pins/:message_id",
    "api:http:GET:/channels/:channel_id/messages/pins/",
    "api:http:PUT:/channels/:channel_id/messages/pins/:message_id",
    "api:http:DELETE:/channels/:channel_id/messages/pins/:message_id",
];

test(
    "channels, messages, pins, typing, and invites persist state and emit events",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 180_000,
    },
    async () => {
        assert.deepEqual(coveredManifestIds, [
            "api:http:GET:/guilds/:guild_id/channels/",
            "api:http:POST:/guilds/:guild_id/channels/",
            "api:http:PATCH:/guilds/:guild_id/channels/",
            "api:http:GET:/channels/:channel_id/",
            "api:http:PATCH:/channels/:channel_id/",
            "api:http:DELETE:/channels/:channel_id/",
            "api:http:GET:/channels/:channel_id/invites/",
            "api:http:POST:/channels/:channel_id/invites/",
            "api:http:POST:/channels/:channel_id/typing/",
            "api:http:GET:/channels/:channel_id/messages/",
            "api:http:POST:/channels/:channel_id/messages/",
            "api:http:DELETE:/channels/:channel_id/messages/ack",
            "api:http:GET:/channels/:channel_id/messages/:message_id/",
            "api:http:PATCH:/channels/:channel_id/messages/:message_id/",
            "api:http:DELETE:/channels/:channel_id/messages/:message_id/",
            "api:http:GET:/channels/:channel_id/pins/",
            "api:http:PUT:/channels/:channel_id/pins/:message_id",
            "api:http:DELETE:/channels/:channel_id/pins/:message_id",
            "api:http:GET:/channels/:channel_id/messages/pins/",
            "api:http:PUT:/channels/:channel_id/messages/pins/:message_id",
            "api:http:DELETE:/channels/:channel_id/messages/pins/:message_id",
        ]);

        const database = await createDisposablePostgresDatabase({ prefix: "spacebar_channels_messages" });
        const tempCwd = await mkdtemp(path.join(tmpdir(), "spacebar-channels-messages-"));
        const previous = snapshotProcessState();
        let api: Awaited<ReturnType<typeof startApi>> | undefined;
        let guildEvents: EventCapture | undefined;
        let channelEvents: EventCapture | undefined;

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
            const owner = await User.register({
                username: `channelowner${suffix.slice(-8)}`,
                email: `channel-owner-${suffix}@example.com`,
                password: "not-a-real-login-hash",
            });
            const token = await generateToken(owner.id);
            assert.ok(token, "token generation should return a bearer token");

            const createdGuild = await postJson(`${api.apiBaseUrl}/guilds`, { name: `channels-${suffix.slice(-8)}` }, token);
            await assertStatus(createdGuild, 201);
            const guildId = (await assertJsonObject(createdGuild)).id as string;
            guildEvents = await captureEvents(guildId);

            const initialChannels = await getJsonArray(`${api.apiBaseUrl}/guilds/${guildId}/channels`, token);
            assert.equal(initialChannels.length, 1);
            const defaultChannelId = initialChannels[0].id as string;

            const createChannel = await postJson(
                `${api.apiBaseUrl}/guilds/${guildId}/channels`,
                {
                    name: "scenario-text",
                    type: ChannelType.GUILD_TEXT,
                    topic: "initial topic",
                    icon_emoji: { id: null, name: "💬" },
                },
                token,
            );
            await assertStatus(createChannel, 201);
            const createChannelBody = await assertJsonObject(createChannel);
            const channelId = createChannelBody.id as string;
            assert.equal(createChannelBody.guild_id, guildId);
            assert.equal(createChannelBody.name, "scenario-text");
            assert.equal(createChannelBody.type, ChannelType.GUILD_TEXT);
            assertIconEmoji(createChannelBody.icon_emoji, { id: null, name: "💬" });
            const channelCreateEvent = await guildEvents.waitFor(
                (event) => event.event === "CHANNEL_CREATE" && event.guild_id === guildId && event.data.id === channelId,
                eventTimeoutMs,
            );
            assert.equal(channelCreateEvent.data.name, "scenario-text");
            assertIconEmoji(channelCreateEvent.data.icon_emoji, { id: null, name: "💬" });
            const persistedCreatedChannel = await Channel.findOneByOrFail({ id: channelId });
            assert.equal(persistedCreatedChannel.name, "scenario-text");
            assertIconEmoji(persistedCreatedChannel.icon_emoji, { id: null, name: "💬" });
            channelEvents = await captureEvents(channelId);

            const channelsAfterCreate = await getJsonArray(`${api.apiBaseUrl}/guilds/${guildId}/channels`, token);
            assert.deepEqual(channelsAfterCreate.map((channel) => channel.id).sort(), [defaultChannelId, channelId].sort());

            const reorderChannels = await patchJson(`${api.apiBaseUrl}/guilds/${guildId}/channels`, [{ id: channelId, position: 0 }], token);
            await assertStatus(reorderChannels, 204);
            const reorderEvent = await guildEvents.waitFor((event) => event.event === "CHANNEL_UPDATE" && event.channel_id === channelId, eventTimeoutMs);
            assert.equal(reorderEvent.data.id, channelId);
            const guildAfterReorder = await Guild.findOneOrFail({
                where: { id: guildId },
                select: { id: true, channel_ordering: true },
            });
            assert.equal(guildAfterReorder.channel_ordering[0], channelId);

            const getChannel = await getJson(`${api.apiBaseUrl}/channels/${channelId}`, token);
            await assertStatus(getChannel, 200);
            const getChannelBody = await assertJsonObject(getChannel);
            assert.equal(getChannelBody.id, channelId);
            assert.equal(getChannelBody.name, "scenario-text");

            const updateChannel = await patchJson(
                `${api.apiBaseUrl}/channels/${channelId}`,
                {
                    name: "scenario-renamed",
                    topic: "updated topic",
                    icon_emoji: { id: "123456789012345678", name: null },
                },
                token,
            );
            await assertStatus(updateChannel, 200);
            const updateChannelBody = await assertJsonObject(updateChannel);
            assert.equal(updateChannelBody.name, "scenario-renamed");
            assert.equal(updateChannelBody.topic, "updated topic");
            assertIconEmoji(updateChannelBody.icon_emoji, { id: "123456789012345678", name: null });
            const channelUpdateEvent = await channelEvents.waitFor(
                (event) => event.event === "CHANNEL_UPDATE" && event.channel_id === channelId && event.data.name === "scenario-renamed",
                eventTimeoutMs,
            );
            assert.equal(channelUpdateEvent.data.topic, "updated topic");
            assertIconEmoji(channelUpdateEvent.data.icon_emoji, { id: "123456789012345678", name: null });
            const persistedChannel = await Channel.findOneByOrFail({ id: channelId });
            assert.equal(persistedChannel.name, "scenario-renamed");
            assert.equal(persistedChannel.topic, "updated topic");
            assertIconEmoji(persistedChannel.icon_emoji, { id: "123456789012345678", name: null });

            const getChannelAfterIconEmojiUpdate = await getJson(`${api.apiBaseUrl}/channels/${channelId}`, token);
            await assertStatus(getChannelAfterIconEmojiUpdate, 200);
            assertIconEmoji((await assertJsonObject(getChannelAfterIconEmojiUpdate)).icon_emoji, { id: "123456789012345678", name: null });

            const beforeClearIconEmoji = markCapturedEvents(channelEvents);
            const clearIconEmoji = await patchJson(`${api.apiBaseUrl}/channels/${channelId}`, { icon_emoji: null }, token);
            await assertStatus(clearIconEmoji, 200);
            const clearIconEmojiBody = await assertJsonObject(clearIconEmoji);
            assert.equal(clearIconEmojiBody.icon_emoji, null);
            const clearIconEmojiEvent = await waitForEventAfter(
                channelEvents,
                beforeClearIconEmoji,
                (event) => event.event === "CHANNEL_UPDATE" && event.channel_id === channelId && event.data.id === channelId && event.data.icon_emoji === null,
            );
            assert.equal(clearIconEmojiEvent.data.icon_emoji, null);
            assert.equal((await Channel.findOneByOrFail({ id: channelId })).icon_emoji, null);

            const createInvite = await postJson(`${api.apiBaseUrl}/channels/${channelId}/invites`, { max_age: 3600, max_uses: 1, temporary: false, unique: true }, token);
            assert.ok(createInvite.status === 200 || createInvite.status === 201);
            const inviteBody = await assertJsonObject(createInvite);
            assert.equal(inviteBody.channel_id, channelId);
            assert.equal(inviteBody.guild_id, guildId);
            assert.equal(await Invite.countBy({ channel_id: channelId, guild_id: guildId }), 1);

            const listInvites = await getJsonArray(`${api.apiBaseUrl}/channels/${channelId}/invites`, token);
            assert.equal(listInvites.length, 1);
            assert.equal(listInvites[0].code, inviteBody.code);

            const typing = await postJson(`${api.apiBaseUrl}/channels/${channelId}/typing`, {}, token);
            await assertStatus(typing, 204);
            const typingEvent = await channelEvents.waitFor(
                (event) => event.event === "TYPING_START" && event.channel_id === channelId && event.data.user_id === owner.id,
                eventTimeoutMs,
            );
            assert.equal(typingEvent.data.guild_id, guildId);

            const createMessage = await postJson(
                `${api.apiBaseUrl}/channels/${channelId}/messages`,
                {
                    content: "scenario message",
                    nonce: `nonce-${suffix}`,
                },
                token,
            );
            await assertStatus(createMessage, 200);
            const createMessageBody = await assertJsonObject(createMessage);
            const messageId = createMessageBody.id as string;
            assert.equal(createMessageBody.channel_id, channelId);
            assert.equal(createMessageBody.content, "scenario message");
            const messageCreateEvent = await channelEvents.waitFor(
                (event) => event.event === "MESSAGE_CREATE" && event.channel_id === channelId && event.data.id === messageId,
                eventTimeoutMs,
            );
            assert.equal(messageCreateEvent.data.content, "scenario message");
            const persistedMessage = await Message.findOneByOrFail({ id: messageId, channel_id: channelId });
            assert.equal(persistedMessage.content, "scenario message");
            const readState = await ReadState.findOneByOrFail({ user_id: owner.id, channel_id: channelId });
            assert.equal(readState.last_message_id, messageId);

            const listMessages = await getJsonArray(`${api.apiBaseUrl}/channels/${channelId}/messages?limit=10`, token);
            assert.equal(listMessages[0].id, messageId);
            assert.equal(listMessages[0].content, "scenario message");

            const getMessage = await getJson(`${api.apiBaseUrl}/channels/${channelId}/messages/${messageId}`, token);
            await assertStatus(getMessage, 200);
            const getMessageBody = await assertJsonObject(getMessage);
            assert.equal(getMessageBody.id, messageId);
            assert.equal(getMessageBody.content, "scenario message");

            const editMessage = await patchJson(`${api.apiBaseUrl}/channels/${channelId}/messages/${messageId}`, { content: "scenario message edited" }, token);
            await assertStatus(editMessage, 200);
            const editMessageBody = await assertJsonObject(editMessage);
            assert.equal(editMessageBody.content, "scenario message edited");
            const messageUpdateEvent = await channelEvents.waitFor(
                (event) => event.event === "MESSAGE_UPDATE" && event.channel_id === channelId && event.data.id === messageId && event.data.content === "scenario message edited",
                eventTimeoutMs,
            );
            assert.equal(messageUpdateEvent.data.id, messageId);
            assert.equal((await Message.findOneByOrFail({ id: messageId, channel_id: channelId })).content, "scenario message edited");

            await assertStatus(await deleteJsonWithBody(`${api.apiBaseUrl}/channels/${channelId}/messages/ack`, { version: 2, read_state_type: 0 }, token), 204);
            assert.equal(await ReadState.findOneBy({ user_id: owner.id, channel_id: channelId }), null);

            const beforeOldPin = markCapturedEvents(channelEvents);
            await assertStatus(await putJson(`${api.apiBaseUrl}/channels/${channelId}/pins/${messageId}`, {}, token), 204);
            const oldPinEvent = await waitForEventAfter(
                channelEvents,
                beforeOldPin,
                (event) => event.event === "MESSAGE_UPDATE" && event.channel_id === channelId && event.data.id === messageId && event.data.pinned === true,
            );
            assert.equal(oldPinEvent.data.id, messageId);
            assert.notEqual((await Message.findOneByOrFail({ id: messageId })).pinned_at, null);

            const oldPins = await getJsonArray(`${api.apiBaseUrl}/channels/${channelId}/pins`, token);
            assert.equal(oldPins.length, 1);
            assert.equal(oldPins[0].id, messageId);

            const beforeOldUnpin = markCapturedEvents(channelEvents);
            await assertStatus(await deleteJson(`${api.apiBaseUrl}/channels/${channelId}/pins/${messageId}`, token), 204);
            const oldUnpinEvent = await waitForEventAfter(
                channelEvents,
                beforeOldUnpin,
                (event) => event.event === "MESSAGE_UPDATE" && event.channel_id === channelId && event.data.id === messageId && event.data.pinned === false,
            );
            assert.equal(oldUnpinEvent.data.id, messageId);
            assert.equal((await Message.findOneByOrFail({ id: messageId })).pinned_at, null);

            await assertStatus(await putJson(`${api.apiBaseUrl}/channels/${channelId}/messages/pins/${messageId}`, {}, token), 204);
            const newPins = await getJsonObject(`${api.apiBaseUrl}/channels/${channelId}/messages/pins`, token);
            assert.equal(newPins.has_more, false);
            const newPinItems = newPins.items as Array<{ message: { id: string } }>;
            assert.equal(newPinItems.length, 1);
            assert.equal(newPinItems[0].message.id, messageId);

            await assertStatus(await deleteJson(`${api.apiBaseUrl}/channels/${channelId}/messages/pins/${messageId}`, token), 204);
            assert.equal((await Message.findOneByOrFail({ id: messageId })).pinned_at, null);

            await assertStatus(await deleteJson(`${api.apiBaseUrl}/channels/${channelId}/messages/${messageId}`, token), 204);
            const messageDeleteEvent = await channelEvents.waitFor(
                (event) => event.event === "MESSAGE_DELETE" && event.channel_id === channelId && event.data.id === messageId,
                eventTimeoutMs,
            );
            assert.equal(messageDeleteEvent.data.guild_id, guildId);
            assert.equal(await Message.findOneBy({ id: messageId }), null);

            const deleteChannel = await deleteJson(`${api.apiBaseUrl}/channels/${channelId}`, token);
            await assertStatus(deleteChannel, 200);
            const deleteChannelBody = await assertJsonObject(deleteChannel);
            assert.equal(deleteChannelBody.id, channelId);
            const channelDeleteEvent = await channelEvents.waitFor(
                (event) => event.event === "CHANNEL_DELETE" && event.channel_id === channelId && event.data.id === channelId,
                eventTimeoutMs,
            );
            assert.equal(channelDeleteEvent.data.guild_id, guildId);
            assert.equal(await Channel.findOneBy({ id: channelId }), null);
        } finally {
            if (channelEvents) await channelEvents.stop();
            if (guildEvents) await guildEvents.stop();
            if (api) await api.stop();
            await closeDatabase();
            await database.close();
            restoreProcessState(previous);
            await rm(tempCwd, { recursive: true, force: true });
        }
    },
);

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

async function getJsonObject(url: string, token: string) {
    const response = await getJson(url, token);
    await assertStatus(response, 200);
    return await assertJsonObject(response);
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

async function patchJson(url: string, body: unknown, token: string) {
    return await fetch(url, {
        method: "PATCH",
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

async function deleteJsonWithBody(url: string, body: unknown, token: string) {
    return await fetch(url, {
        method: "DELETE",
        headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
        },
        body: JSON.stringify(body),
    });
}

function assertIconEmoji(value: unknown, expected: { id: string | null; name: string | null }) {
    assert.ok(value && typeof value === "object");
    const iconEmoji = value as Record<string, unknown>;
    assert.deepEqual(Object.keys(iconEmoji).sort(), ["id", "name"]);
    assert.equal(iconEmoji.id, expected.id);
    assert.equal(iconEmoji.name, expected.name);
}

function markCapturedEvents(capture: EventCapture) {
    return new Set(capture.events);
}

async function waitForEventAfter(capture: EventCapture, previousEvents: Set<CapturedEvent>, predicate: (event: CapturedEvent) => boolean) {
    return await capture.waitFor((event) => !previousEvents.has(event) && predicate(event), eventTimeoutMs);
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
