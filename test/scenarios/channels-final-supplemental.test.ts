import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { DEFAULT_MESSAGE_DELETE_CHUNK_SIZE } from "@spacebar/api";
import { Channel, closeDatabase, CloudAttachment, Config, generateToken, initDatabase, Message, Recipient, Snowflake, Sticker, User, Webhook } from "@spacebar/util";
import { ChannelType, MessageType, StickerFormatType, StickerType, WebhookType } from "@spacebar/schemas";
import { In } from "typeorm";
import { assertJsonObject, assertStatus } from "../assertions/http";
import { createDisposablePostgresDatabase, hasPostgresAdminUrl } from "../fixtures/database";
import { captureEvents } from "../fixtures/events";
import { startApi } from "../server/startApi";

type EventCapture = Awaited<ReturnType<typeof captureEvents>>;
type CapturedEvent = EventCapture["events"][number];

const coveredManifestIds = [
    "api:http:DELETE:/channels/:channel_id/attachments/:cloud_attachment_url",
    "api:http:DELETE:/channels/:channel_id/recipients/:user_id",
    "api:http:POST:/channels/:channel_id/attachments/",
    "api:http:POST:/channels/:channel_id/followers/",
    "api:http:POST:/channels/:channel_id/greet/",
    "api:http:POST:/channels/:channel_id/purge/",
    "api:http:PUT:/channels/:channel_id/messages/:message_id/",
    "api:http:PUT:/channels/:channel_id/recipients/:user_id",
];
const eventTimeoutMs = 1000;

test(
    "channel recipient, attachment, follower, greet, purge, and backfill routes persist state",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 180_000,
    },
    async () => {
        assert.deepEqual(coveredManifestIds, [
            "api:http:DELETE:/channels/:channel_id/attachments/:cloud_attachment_url",
            "api:http:DELETE:/channels/:channel_id/recipients/:user_id",
            "api:http:POST:/channels/:channel_id/attachments/",
            "api:http:POST:/channels/:channel_id/followers/",
            "api:http:POST:/channels/:channel_id/greet/",
            "api:http:POST:/channels/:channel_id/purge/",
            "api:http:PUT:/channels/:channel_id/messages/:message_id/",
            "api:http:PUT:/channels/:channel_id/recipients/:user_id",
        ]);

        const database = await createDisposablePostgresDatabase({ prefix: "spacebar_channels_final" });
        const tempCwd = await mkdtemp(path.join(tmpdir(), "spacebar-channels-final-"));
        const previous = snapshotProcessState();
        const fakeCdn = await startFakeCdn();
        let api: Awaited<ReturnType<typeof startApi>> | undefined;
        let events: EventCapture | undefined;
        let dmEvents: EventCapture | undefined;

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
                    cdn: { endpointPublic: fakeCdn.url, endpointPrivate: fakeCdn.url },
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
            const owner = await registerUser(`finalowner${suffix.slice(-8)}`, `final-owner-${suffix}@example.com`);
            const firstRecipient = await registerUser(`finaltarget${suffix.slice(-8)}`, `final-target-${suffix}@example.com`);
            const secondRecipient = await registerUser(`finalgroup${suffix.slice(-8)}`, `final-group-${suffix}@example.com`);
            const addedRecipient = await registerUser(`finaladded${suffix.slice(-8)}`, `final-added-${suffix}@example.com`);
            await User.update({ id: owner.id }, { rights: "1" });
            const ownerToken = await generateToken(owner.id);
            assert.ok(ownerToken, "owner token generation should return a bearer token");

            const createdGuild = await postJson(`${api.apiBaseUrl}/guilds`, { name: `channels-final-${suffix.slice(-8)}` }, ownerToken);
            await assertStatus(createdGuild, 201);
            const guildId = (await assertJsonObject(createdGuild)).id as string;
            const initialChannels = await getJsonArray(`${api.apiBaseUrl}/guilds/${guildId}/channels`, ownerToken);
            const textChannelId = initialChannels[0].id as string;
            const sourceNewsChannelId = await createGuildChannel(api.apiBaseUrl, guildId, "scenario-news", ChannelType.GUILD_NEWS, ownerToken);
            const targetTextChannelId = await createGuildChannel(api.apiBaseUrl, guildId, "scenario-follower-target", ChannelType.GUILD_TEXT, ownerToken);
            events = await captureEvents([textChannelId, sourceNewsChannelId, targetTextChannelId, owner.id]);

            const groupDmId = await createGroupDm(api.apiBaseUrl, [firstRecipient.id, secondRecipient.id], ownerToken);
            dmEvents = await captureEvents([groupDmId, addedRecipient.id]);

            await coverRecipientRoutes(api.apiBaseUrl, groupDmId, addedRecipient.id, ownerToken, dmEvents);
            await coverAttachmentRoutes(api.apiBaseUrl, textChannelId, owner.id, ownerToken, fakeCdn);
            await coverFollowerRoute(api.apiBaseUrl, guildId, sourceNewsChannelId, targetTextChannelId, ownerToken);
            await coverGreetRoute(api.apiBaseUrl, guildId, textChannelId, owner.id, ownerToken, events);
            await coverPurgeRoute(api.apiBaseUrl, guildId, textChannelId, owner.id, ownerToken, events);
            await coverBackfillRoute(api.apiBaseUrl, textChannelId, ownerToken, events);
        } finally {
            if (dmEvents) await dmEvents.stop();
            if (events) await events.stop();
            if (api) await api.stop();
            await closeDatabase();
            await database.close();
            await fakeCdn.close();
            restoreProcessState(previous);
            await rm(tempCwd, { recursive: true, force: true });
        }
    },
);

async function coverRecipientRoutes(apiBaseUrl: string, groupDmId: string, addedRecipientId: string, token: string, events: EventCapture) {
    const beforeAdd = markCapturedEvents(events);
    await assertStatus(await putJson(`${apiBaseUrl}/channels/${groupDmId}/recipients/${addedRecipientId}`, {}, token), 204);
    await waitForEventAfter(events, beforeAdd, (event) => event.event === "CHANNEL_CREATE" && event.user_id === addedRecipientId && event.data.id === groupDmId);
    await waitForEventAfter(events, beforeAdd, (event) => event.event === "CHANNEL_RECIPIENT_ADD" && event.channel_id === groupDmId && event.data.user.id === addedRecipientId);
    assert.notEqual(await Recipient.findOneBy({ channel_id: groupDmId, user_id: addedRecipientId }), null);

    const beforeRemove = markCapturedEvents(events);
    await assertStatus(await deleteJson(`${apiBaseUrl}/channels/${groupDmId}/recipients/${addedRecipientId}`, token), 204);
    await waitForEventAfter(events, beforeRemove, (event) => event.event === "CHANNEL_DELETE" && event.user_id === addedRecipientId && event.data.id === groupDmId);
    await waitForEventAfter(
        events,
        beforeRemove,
        (event) => event.event === "CHANNEL_RECIPIENT_REMOVE" && event.channel_id === groupDmId && event.data.user.id === addedRecipientId,
    );
    assert.equal(await Recipient.findOneBy({ channel_id: groupDmId, user_id: addedRecipientId }), null);
}

async function coverAttachmentRoutes(apiBaseUrl: string, channelId: string, ownerId: string, token: string, fakeCdn: FakeCdn) {
    const reserve = await postJson(
        `${apiBaseUrl}/channels/${channelId}/attachments`,
        {
            files: [
                {
                    id: "0",
                    filename: "scenario file.png",
                    file_size: 68,
                    original_content_type: "image/png",
                },
            ],
        },
        token,
    );
    await assertStatus(reserve, 200);
    const reserveBody = await assertJsonObject(reserve);
    const attachments = reserveBody.attachments as Array<Record<string, unknown>>;
    assert.equal(attachments.length, 1);
    assert.equal(attachments[0].id, "0");
    assert.match(attachments[0].upload_url as string, /scenario_file\.png$/);
    const uploadFilename = attachments[0].upload_filename as string;
    const cloudAttachment = await CloudAttachment.findOneByOrFail({ uploadFilename });
    assert.equal(cloudAttachment.userId, ownerId);
    assert.equal(cloudAttachment.channelId, channelId);

    await assertStatus(await deleteJson(`${apiBaseUrl}/channels/${channelId}/attachments/${encodeURIComponent(uploadFilename)}`, token), 204);
    assert.equal(await CloudAttachment.findOneBy({ uploadFilename }), null);
    assert.ok(
        fakeCdn.requests.some(
            (request) =>
                request.method === "DELETE" && request.url === `/_spacebar/cdn/attachments/${uploadFilename}` && request.signature === Config.get().security.requestSignature,
        ),
    );
}

async function coverFollowerRoute(apiBaseUrl: string, guildId: string, sourceNewsChannelId: string, targetTextChannelId: string, token: string) {
    const follow = await postJson(`${apiBaseUrl}/channels/${sourceNewsChannelId}/followers`, { webhook_channel_id: targetTextChannelId }, token);
    await assertStatus(follow, 200);
    const followBody = await assertJsonObject(follow);
    assert.equal(followBody.channel_id, targetTextChannelId);
    const webhook = await Webhook.findOneByOrFail({ id: followBody.webhook_id as string });
    assert.equal(webhook.type, WebhookType.ChannelFollower);
    assert.equal(webhook.guild_id, guildId);
    assert.equal(webhook.channel_id, targetTextChannelId);
    assert.equal(webhook.source_guild_id, guildId);
    assert.equal(webhook.source_channel_id, sourceNewsChannelId);
}

async function coverGreetRoute(apiBaseUrl: string, guildId: string, channelId: string, ownerId: string, token: string, events: EventCapture) {
    const sticker = await Sticker.create({
        name: "scenario-sticker",
        description: "scenario sticker",
        tags: "scenario",
        type: StickerType.GUILD,
        format_type: StickerFormatType.PNG,
        guild_id: guildId,
        user_id: ownerId,
    }).save();
    const joinMessage = await Message.create({
        type: MessageType.GUILD_MEMBER_JOIN,
        guild_id: guildId,
        channel_id: channelId,
        author_id: ownerId,
        timestamp: new Date(),
        reactions: [],
        attachments: [],
        embeds: [],
        sticker_items: [],
        edited_timestamp: undefined,
        mentions: [],
        mention_channels: [],
        mention_roles: [],
        mention_everyone: false,
    }).save();

    const beforeGreet = markCapturedEvents(events);
    const greet = await postJson(
        `${apiBaseUrl}/channels/${channelId}/greet`,
        {
            sticker_ids: [sticker.id],
            message_reference: {
                message_id: joinMessage.id,
                channel_id: channelId,
                guild_id: guildId,
            },
        },
        token,
    );
    await assertStatus(greet, 200);
    const greetBody = await assertJsonObject(greet);
    const greetId = greetBody.id as string;
    await waitForEventAfter(events, beforeGreet, (event) => event.event === "MESSAGE_CREATE" && event.channel_id === channelId && event.data.id === greetId);
    const greetMessage = await Message.findOneOrFail({ where: { id: greetId }, relations: { sticker_items: true } });
    assert.equal(greetMessage.type, MessageType.REPLY);
    assert.equal(greetMessage.sticker_items?.[0].id, sticker.id);
    assert.equal((await Channel.findOneByOrFail({ id: channelId })).last_message_id, greetId);
}

async function coverPurgeRoute(apiBaseUrl: string, guildId: string, channelId: string, ownerId: string, token: string, events: EventCapture) {
    const firstMessageId = await createMessage(apiBaseUrl, channelId, "purge first", token);
    const secondMessageId = await createMessage(apiBaseUrl, channelId, "purge second", token);

    const beforePurge = markCapturedEvents(events);
    await assertStatus(await postJson(`${apiBaseUrl}/channels/${channelId}/purge`, { after: firstMessageId, before: secondMessageId }, token), 204);
    const purgeEvent = await waitForEventAfter(
        events,
        beforePurge,
        (event) => event.event === "MESSAGE_DELETE_BULK" && event.channel_id === channelId && event.data.guild_id === guildId,
    );
    assert.deepEqual([...purgeEvent.data.ids].sort(), [firstMessageId, secondMessageId].sort());
    assert.equal(await Message.findOneBy({ id: firstMessageId }), null);
    assert.equal(await Message.findOneBy({ id: secondMessageId }), null);

    const chunkedMessageIds = await createMessagesForPurgeRange(channelId, guildId, ownerId, DEFAULT_MESSAGE_DELETE_CHUNK_SIZE + 1);
    const outsideBeforeId = await createMessageForPurgeRange(channelId, guildId, ownerId, snowflakeForTimestamp(Date.now() - 120_000), "outside before purge range");
    const outsideAfterId = await createMessageForPurgeRange(channelId, guildId, ownerId, snowflakeForTimestamp(Date.now() + 120_000), "outside after purge range");

    const beforeChunkedPurge = markCapturedEvents(events);
    await assertStatus(
        await postJson(`${apiBaseUrl}/channels/${channelId}/purge`, { after: chunkedMessageIds[0], before: chunkedMessageIds[chunkedMessageIds.length - 1] }, token),
        204,
    );

    const purgeEvents = await waitForEventsAfter(
        events,
        beforeChunkedPurge,
        (event) => event.event === "MESSAGE_DELETE_BULK" && event.channel_id === channelId && event.data.guild_id === guildId,
        2,
    );
    assert.equal(purgeEvents.length, 2);
    assert.ok(purgeEvents.every((event) => event.data.ids.length <= DEFAULT_MESSAGE_DELETE_CHUNK_SIZE));
    assert.deepEqual(purgeEvents.flatMap((event) => event.data.ids).sort(), [...chunkedMessageIds].sort());
    assert.equal(await Message.countBy({ id: In(chunkedMessageIds) }), 0);
    assert.notEqual(await Message.findOneBy({ id: outsideBeforeId }), null);
    assert.notEqual(await Message.findOneBy({ id: outsideAfterId }), null);
}

async function coverBackfillRoute(apiBaseUrl: string, channelId: string, token: string, events: EventCapture) {
    const messageId = snowflakeForTimestamp(Date.now() - 10_000);
    const beforeBackfill = markCapturedEvents(events);
    const backfill = await putJson(`${apiBaseUrl}/channels/${channelId}/messages/${messageId}`, { content: "backfilled message" }, token);
    await assertStatus(backfill, 200);
    const backfillBody = await assertJsonObject(backfill);
    assert.equal(backfillBody.id, messageId);
    assert.equal(backfillBody.content, "backfilled message");
    await waitForEventAfter(events, beforeBackfill, (event) => event.event === "MESSAGE_CREATE" && event.channel_id === channelId && event.data.id === messageId);
    const persisted = await Message.findOneByOrFail({ id: messageId, channel_id: channelId });
    assert.equal(persisted.content, "backfilled message");
    assert.equal(persisted.timestamp.getTime(), Snowflake.deconstruct(messageId).timestamp);
}

async function createGroupDm(apiBaseUrl: string, recipients: string[], token: string) {
    const response = await postJson(`${apiBaseUrl}/users/@me/channels`, { recipients, name: "scenario group" }, token);
    await assertStatus(response, 200);
    const body = await assertJsonObject(response);
    assert.equal(body.type, ChannelType.GROUP_DM);
    return body.id as string;
}

async function createGuildChannel(apiBaseUrl: string, guildId: string, name: string, type: ChannelType, token: string) {
    const response = await postJson(`${apiBaseUrl}/guilds/${guildId}/channels`, { name, type }, token);
    await assertStatus(response, 201);
    const body = await assertJsonObject(response);
    assert.equal(body.type, type);
    return body.id as string;
}

async function createMessage(apiBaseUrl: string, channelId: string, content: string, token: string) {
    const response = await postJson(`${apiBaseUrl}/channels/${channelId}/messages`, { content }, token);
    await assertStatus(response, 200);
    return (await assertJsonObject(response)).id as string;
}

async function createMessagesForPurgeRange(channelId: string, guildId: string, ownerId: string, count: number) {
    const firstTimestamp = Date.now() - 60_000;
    const messages: Message[] = [];
    for (let offset = 0; offset < count; offset += 1) {
        messages.push(buildMessageForPurgeRange(channelId, guildId, ownerId, snowflakeForTimestamp(firstTimestamp + offset), `chunked purge ${offset}`));
    }
    await Message.save(messages);
    return messages.map((message) => message.id);
}

async function createMessageForPurgeRange(channelId: string, guildId: string, ownerId: string, id: string, content: string) {
    await buildMessageForPurgeRange(channelId, guildId, ownerId, id, content).save();
    return id;
}

function buildMessageForPurgeRange(channelId: string, guildId: string, ownerId: string, id: string, content: string) {
    return Message.create({
        id,
        channel_id: channelId,
        guild_id: guildId,
        author_id: ownerId,
        content,
        timestamp: new Date(Snowflake.deconstruct(id).timestamp),
        tts: false,
        mention_everyone: false,
        mentions: [],
        mention_roles: [],
        mention_channels: [],
        attachments: [],
        embeds: [],
        reactions: [],
        type: MessageType.DEFAULT,
        flags: 0,
        components: [],
        message_snapshots: [],
    });
}

function snowflakeForTimestamp(timestamp: number) {
    return (BigInt(timestamp - Snowflake.EPOCH) << 22n).toString();
}

function markCapturedEvents(capture: EventCapture) {
    return new Set(capture.events);
}

async function waitForEventAfter(capture: EventCapture, previousEvents: Set<CapturedEvent>, predicate: (event: CapturedEvent) => boolean) {
    return await capture.waitFor((event) => !previousEvents.has(event) && predicate(event), eventTimeoutMs);
}

async function waitForEventsAfter(capture: EventCapture, previousEvents: Set<CapturedEvent>, predicate: (event: CapturedEvent) => boolean, count: number) {
    const deadline = Date.now() + eventTimeoutMs;

    while (Date.now() <= deadline) {
        const matches = capture.events.filter((event) => !previousEvents.has(event) && predicate(event));
        if (matches.length >= count) return matches;
        await new Promise((resolve) => {
            setTimeout(resolve, 10);
        });
    }

    assert.fail(`Timed out waiting for ${count} events after ${eventTimeoutMs}ms`);
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

type FakeCdn = Awaited<ReturnType<typeof startFakeCdn>>;

async function startFakeCdn() {
    const requests: Array<{ method?: string; url?: string; signature?: string | string[] }> = [];
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
        requests.push({
            method: req.method,
            url: req.url,
            signature: req.headers.signature,
        });
        res.writeHead(req.method === "DELETE" ? 204 : 404);
        res.end();
    });

    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            server.off("error", reject);
            resolve();
        });
    });
    const address = server.address();
    assert.ok(address && typeof address === "object");

    return {
        requests,
        url: `http://127.0.0.1:${address.port}`,
        close: async () => {
            await new Promise<void>((resolve, reject) => {
                server.close((error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });
        },
    };
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
