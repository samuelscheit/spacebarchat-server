import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
    closeDatabase,
    emitEvent,
    events,
    generateToken,
    initDatabase,
    Permissions,
    Snowflake,
    Stream,
    StreamSession,
    User,
    VoiceState,
    type UserUpdateEvent,
} from "@spacebar/util";
import { ChannelType } from "@spacebar/schemas";
import ws from "ws";
import { createDisposablePostgresDatabase, hasPostgresAdminUrl } from "../fixtures/database";
import { makeChannel, makeGuild, makeMember, makeRole } from "../fixtures/entities";
import { startGateway } from "../server/startGateway";

const coveredManifestIds = ["gateway:opcode:2:Identify"];
type GatewayPayload = { op: number; s?: number; t?: string; d?: Record<string, unknown> | boolean };
type BufferedGatewayClientState = {
    messages: ws.RawData[];
    waiters: Array<(message: ws.RawData) => void>;
};

const bufferedGatewayClients = new WeakMap<ws, BufferedGatewayClientState>();

test(
    "Gateway IDENTIFY accepts a persisted user token and sends READY",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 180_000,
    },
    async () => {
        assert.deepEqual(coveredManifestIds, ["gateway:opcode:2:Identify"]);

        const database = await createDisposablePostgresDatabase({ prefix: "spacebar_gateway_identify" });
        const tempCwd = await mkdtemp(path.join(tmpdir(), "spacebar-gateway-identify-"));
        const previous = snapshotProcessState();
        let gateway: Awaited<ReturnType<typeof startGateway>> | undefined;
        let client: ws | undefined;

        try {
            process.chdir(tempCwd);
            process.env.DATABASE = database.url;
            process.env.APPLY_DB_MIGRATIONS = "true";
            delete process.env.CONFIG_PATH;
            delete process.env.DB_SYNC;
            delete process.env.EVENT_TRANSMISSION;
            delete process.env.EVENT_SOCKET_PATH;
            delete process.env.RABBITMQ_HOST;

            await initDatabase();
            const suffix = `${process.pid}${Date.now()}`;
            const user = await User.register({
                username: `gateway${suffix.slice(-8)}`,
                email: `gateway-${suffix}@example.com`,
                password: "gateway-password-fixture",
            });
            const token = await generateToken(user.id);
            assert.equal(typeof token, "string");

            gateway = await startGateway();
            client = new ws(`${gateway.url}/?version=8&encoding=json`, { headers: { "User-Agent": "spacebar-test" } });
            const hello = await readJsonMessage(client);
            assert.equal(hello.op, 10);

            client.send(
                JSON.stringify({
                    op: 2,
                    d: {
                        token,
                        intents: 0,
                        properties: {
                            os: "test",
                            browser: "spacebar-test",
                            device: "spacebar-test",
                        },
                    },
                }),
            );

            const ready = await readUntil(client, (payload) => payload.op === 0 && payload.t === "READY");
            const readyData = ready.d as { user: { id: string }; session_id: string };
            assert.equal(readyData.user.id, user.id);
            assert.equal(typeof readyData.session_id, "string");
            assert.equal(readyData.session_id.length > 0, true);
        } finally {
            if (client) {
                await closeClient(client);
                await waitForCloseHandlers();
            }
            if (gateway) await gateway.stop();
            await closeDatabase();
            await database.close();
            restoreProcessState(previous);
            await rm(tempCwd, { recursive: true, force: true });
        }
    },
);

test("Gateway IDENTIFY closes invalid tokens with authentication failure", { timeout: 30_000 }, async () => {
    const gateway = await startGateway();
    let client: ws | undefined;

    try {
        client = new ws(`${gateway.url}/?version=8&encoding=json`, { headers: { "User-Agent": "spacebar-test" } });
        const hello = await readJsonMessage(client);
        assert.equal(hello.op, 10);

        client.send(
            JSON.stringify({
                op: 2,
                d: {
                    token: "not-a-valid-jwt",
                    intents: 0,
                    properties: {
                        os: "test",
                        browser: "spacebar-test",
                        device: "spacebar-test",
                    },
                },
            }),
        );

        const close = await readClose(client);
        assert.equal(close.code, 4004);
    } finally {
        if (client) {
            await closeClient(client);
            await waitForCloseHandlers();
        }
        await gateway.stop();
    }
});

test(
    "Gateway RESUME reattaches a persisted session and sends RESUMED",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 180_000,
    },
    async () => {
        const database = await createDisposablePostgresDatabase({ prefix: "spacebar_gateway_resume" });
        const tempCwd = await mkdtemp(path.join(tmpdir(), "spacebar-gateway-resume-"));
        const previous = snapshotProcessState();
        let gateway: Awaited<ReturnType<typeof startGateway>> | undefined;
        let firstClient: ws | undefined;
        let resumedClient: ws | undefined;

        try {
            process.chdir(tempCwd);
            process.env.DATABASE = database.url;
            process.env.APPLY_DB_MIGRATIONS = "true";
            delete process.env.CONFIG_PATH;
            delete process.env.DB_SYNC;
            delete process.env.EVENT_TRANSMISSION;
            delete process.env.EVENT_SOCKET_PATH;
            delete process.env.RABBITMQ_HOST;

            await initDatabase();
            const suffix = `${process.pid}${Date.now()}`;
            const user = await User.register({
                username: `resume${suffix.slice(-8)}`,
                email: `resume-${suffix}@example.com`,
                password: "gateway-password-fixture",
            });
            const token = await generateToken(user.id);
            assert.equal(typeof token, "string");
            if (!token) assert.fail("expected generated token");
            const userToken = token;

            gateway = await startGateway();
            firstClient = await connectIdentifiedGatewayClient(gateway.url, userToken);
            const ready = await readUntil(firstClient, (payload) => payload.op === 0 && payload.t === "READY");
            const readyData = ready.d as { user: { id: string }; session_id: string };
            const lastSeq = ready.s ?? 0;
            assert.equal(readyData.user.id, user.id);
            await closeClient(firstClient);
            await waitForCloseHandlers();
            firstClient = undefined;

            resumedClient = new ws(`${gateway.url}/?version=8&encoding=json`, { headers: { "User-Agent": "spacebar-test" } });
            const hello = await readJsonMessage(resumedClient);
            assert.equal(hello.op, 10);

            resumedClient.send(
                JSON.stringify({
                    op: 6,
                    d: {
                        token: userToken,
                        session_id: readyData.session_id,
                        seq: lastSeq,
                    },
                }),
            );

            const resumed = await readJsonMessage(resumedClient);
            assert.equal(resumed.op, 0);
            assert.equal(resumed.t, "RESUMED");
            assert.equal(resumed.s, lastSeq + 1);
            assert.deepEqual((resumed.d as { _trace: unknown[] })._trace, []);

            await waitForEventListener(readyData.session_id);
            await emitEvent({
                event: "USER_UPDATE",
                session_id: readyData.session_id,
                data: user.toPrivateUser() as unknown as UserUpdateEvent["data"],
            } satisfies UserUpdateEvent);

            const userUpdate = await readUntil(resumedClient, (payload) => payload.op === 0 && payload.t === "USER_UPDATE");
            assert.equal(userUpdate.s, lastSeq + 2);
            assert.equal((userUpdate.d as { id: string }).id, user.id);
        } finally {
            if (firstClient) await closeClient(firstClient);
            if (resumedClient) await closeClient(resumedClient);
            if (firstClient || resumedClient) await waitForCloseHandlers();
            if (gateway) await gateway.stop();
            await closeDatabase();
            await database.close();
            restoreProcessState(previous);
            await rm(tempCwd, { recursive: true, force: true });
        }
    },
);

test(
    "Gateway RESUME rejects a valid token with the wrong session id",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 180_000,
    },
    async () => {
        const database = await createDisposablePostgresDatabase({ prefix: "spacebar_gateway_resume_invalid" });
        const tempCwd = await mkdtemp(path.join(tmpdir(), "spacebar-gateway-resume-invalid-"));
        const previous = snapshotProcessState();
        let gateway: Awaited<ReturnType<typeof startGateway>> | undefined;
        let client: ws | undefined;

        try {
            process.chdir(tempCwd);
            process.env.DATABASE = database.url;
            process.env.APPLY_DB_MIGRATIONS = "true";
            delete process.env.CONFIG_PATH;
            delete process.env.DB_SYNC;
            delete process.env.EVENT_TRANSMISSION;
            delete process.env.EVENT_SOCKET_PATH;
            delete process.env.RABBITMQ_HOST;

            await initDatabase();
            const suffix = `${process.pid}${Date.now()}`;
            const user = await User.register({
                username: `badresume${suffix.slice(-8)}`,
                email: `bad-resume-${suffix}@example.com`,
                password: "gateway-password-fixture",
            });
            const token = await generateToken(user.id);
            assert.equal(typeof token, "string");

            gateway = await startGateway();
            client = new ws(`${gateway.url}/?version=8&encoding=json`, { headers: { "User-Agent": "spacebar-test" } });
            const hello = await readJsonMessage(client);
            assert.equal(hello.op, 10);

            client.send(
                JSON.stringify({
                    op: 6,
                    d: {
                        token,
                        session_id: "wrong-session-id",
                        seq: 0,
                    },
                }),
            );

            const invalid = await readJsonMessage(client);
            assert.equal(invalid.op, 9);
            assert.equal(invalid.d, false);
            const close = await readClose(client);
            assert.equal(close.code, 4006);
        } finally {
            if (client) await closeClient(client);
            if (client) await waitForCloseHandlers();
            if (gateway) await gateway.stop();
            await closeDatabase();
            await database.close();
            restoreProcessState(previous);
            await rm(tempCwd, { recursive: true, force: true });
        }
    },
);

test(
    "Gateway channel status and info requests dispatch real websocket responses",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 180_000,
    },
    async () => {
        const coveredChannelManifestIds = ["gateway:opcode:36", "gateway:opcode:43"];
        assert.deepEqual(coveredChannelManifestIds, ["gateway:opcode:36", "gateway:opcode:43"]);

        const database = await createDisposablePostgresDatabase({ prefix: "spacebar_gateway_channel_info" });
        const tempCwd = await mkdtemp(path.join(tmpdir(), "spacebar-gateway-channel-info-"));
        const previous = snapshotProcessState();
        let gateway: Awaited<ReturnType<typeof startGateway>> | undefined;
        let client: ws | undefined;

        try {
            process.chdir(tempCwd);
            process.env.DATABASE = database.url;
            process.env.APPLY_DB_MIGRATIONS = "true";
            delete process.env.CONFIG_PATH;
            delete process.env.DB_SYNC;
            delete process.env.EVENT_TRANSMISSION;
            delete process.env.EVENT_SOCKET_PATH;
            delete process.env.RABBITMQ_HOST;

            await initDatabase();
            const suffix = `${process.pid}${Date.now()}`;
            const user = await User.register({
                username: `channelinfo${suffix.slice(-8)}`,
                email: `channel-info-${suffix}@example.com`,
                password: "gateway-password-fixture",
            });
            const token = await generateToken(user.id);
            assert.equal(typeof token, "string");
            if (!token) assert.fail("expected generated token");

            const guild = await makeGuild(user, { id: Snowflake.generate(), name: "Gateway Channel Info Guild" }).save();
            const voiceChannel = await makeChannel(guild, {
                id: Snowflake.generate(),
                name: "voice",
                type: ChannelType.GUILD_VOICE,
            }).save();
            await VoiceState.create({
                guild_id: guild.id,
                channel_id: voiceChannel.id,
                user_id: user.id,
                session_id: `voice-${Snowflake.generate()}`,
                token: `voice-token-${Snowflake.generate()}`,
                deaf: false,
                mute: false,
                self_deaf: false,
                self_mute: false,
                self_video: false,
                suppress: false,
            }).save();

            gateway = await startGateway();
            client = await connectIdentifiedGatewayClient(gateway.url, token);
            await readUntil(client, (payload) => payload.op === 0 && payload.t === "READY");

            client.send(
                JSON.stringify({
                    op: 36,
                    d: {
                        guild_id: guild.id,
                    },
                }),
            );

            const statuses = await readUntil(client, (payload) => payload.op === 0 && payload.t === "CHANNEL_STATUSES");
            assert.equal(typeof statuses.s, "number");
            assert.deepEqual(statuses.d, {
                guild_id: guild.id,
                channels: [],
            });

            client.send(
                JSON.stringify({
                    op: 43,
                    d: {
                        guild_id: guild.id,
                        fields: ["status", "voice_start_time"],
                    },
                }),
            );

            const info = await readUntil(client, (payload) => payload.op === 0 && payload.t === "CHANNEL_INFO");
            const infoData = info.d as { guild_id: string; channels: Array<{ id: string; status: null; voice_start_time: null }> };
            assert.equal(typeof info.s, "number");
            assert.equal(info.s, (statuses.s ?? 0) + 1);
            assert.equal(infoData.guild_id, guild.id);
            assert.equal(infoData.channels.length, 1);
            assert.equal(infoData.channels[0].id, voiceChannel.id);
            assert.equal(infoData.channels[0].status, null);
            assert.equal(infoData.channels[0].voice_start_time, null);
        } finally {
            if (client) {
                await closeClient(client);
                await waitForCloseHandlers();
            }
            if (gateway) await gateway.stop();
            await closeDatabase();
            await database.close();
            restoreProcessState(previous);
            await rm(tempCwd, { recursive: true, force: true });
        }
    },
);

test(
    "Gateway stream create, watch, and delete persist state and dispatch real websocket events",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 180_000,
    },
    async () => {
        const coveredStreamManifestIds = ["gateway:opcode:18", "gateway:opcode:19", "gateway:opcode:20"];
        assert.deepEqual(coveredStreamManifestIds, ["gateway:opcode:18", "gateway:opcode:19", "gateway:opcode:20"]);

        const database = await createDisposablePostgresDatabase({ prefix: "spacebar_gateway_stream" });
        const tempCwd = await mkdtemp(path.join(tmpdir(), "spacebar-gateway-stream-"));
        const previous = snapshotProcessState();
        let gateway: Awaited<ReturnType<typeof startGateway>> | undefined;
        let ownerClient: ws | undefined;
        let viewerClient: ws | undefined;

        try {
            process.chdir(tempCwd);
            process.env.DATABASE = database.url;
            process.env.APPLY_DB_MIGRATIONS = "true";
            delete process.env.CONFIG_PATH;
            delete process.env.DB_SYNC;
            delete process.env.EVENT_TRANSMISSION;
            delete process.env.EVENT_SOCKET_PATH;
            delete process.env.RABBITMQ_HOST;

            await initDatabase();
            const suffix = `${process.pid}${Date.now()}`;
            const owner = await User.register({
                username: `streamowner${suffix.slice(-8)}`,
                email: `stream-owner-${suffix}@example.com`,
                password: "gateway-password-fixture",
            });
            const viewer = await User.register({
                username: `streamviewer${suffix.slice(-8)}`,
                email: `stream-viewer-${suffix}@example.com`,
                password: "gateway-password-fixture",
            });
            const ownerToken = await generateToken(owner.id);
            const viewerToken = await generateToken(viewer.id);
            assert.equal(typeof ownerToken, "string");
            assert.equal(typeof viewerToken, "string");
            if (!ownerToken || !viewerToken) assert.fail("expected generated tokens");

            const guild = await makeGuild(owner, { id: Snowflake.generate(), name: "Gateway Stream Guild" }).save();
            const everyoneRole = await makeRole(guild, {
                id: guild.id,
                permissions: (Permissions.FLAGS.VIEW_CHANNEL | Permissions.FLAGS.STREAM | Permissions.FLAGS.CONNECT).toString(),
            }).save();
            await makeMember(owner, guild, { roles: [everyoneRole] }).save();
            await makeMember(viewer, guild, { roles: [everyoneRole] }).save();
            const voiceChannel = await makeChannel(guild, {
                id: Snowflake.generate(),
                name: "stream",
                type: ChannelType.GUILD_VOICE,
            }).save();
            await VoiceState.create({
                guild_id: guild.id,
                channel_id: voiceChannel.id,
                user_id: owner.id,
                session_id: `voice-${Snowflake.generate()}`,
                token: `voice-token-${Snowflake.generate()}`,
                deaf: false,
                mute: false,
                self_deaf: false,
                self_mute: false,
                self_stream: false,
                self_video: false,
                suppress: false,
            }).save();

            gateway = await startGateway();
            ownerClient = await connectIdentifiedGatewayClient(gateway.url, ownerToken);
            const ownerReady = await readUntil(ownerClient, (payload) => payload.op === 0 && payload.t === "READY");
            const ownerReadyData = ownerReady.d as { session_id: string };
            await VoiceState.update({ user_id: owner.id }, { session_id: ownerReadyData.session_id });
            await readUntil(ownerClient, (payload) => payload.op === 0 && payload.t === "READY_SUPPLEMENTAL");
            await waitForEventListener(owner.id);
            await waitForEventListener(guild.id);
            await waitForEventListener(voiceChannel.id);

            ownerClient.send(
                JSON.stringify({
                    op: 18,
                    d: {
                        type: "guild",
                        guild_id: guild.id,
                        channel_id: voiceChannel.id,
                        preferred_region: "spacebar",
                    },
                }),
            );

            const streamKey = `guild:${guild.id}:${voiceChannel.id}:${owner.id}`;
            const ownerStreamCreate = await readUntil(ownerClient, (payload) => payload.op === 0 && payload.t === "STREAM_CREATE");
            assert.deepEqual(ownerStreamCreate.d, {
                stream_key: streamKey,
                rtc_server_id: (ownerStreamCreate.d as { rtc_server_id: string }).rtc_server_id,
                viewer_ids: [],
                region: "spacebar",
                paused: false,
            });
            assert.equal(typeof (ownerStreamCreate.d as { rtc_server_id: string }).rtc_server_id, "string");

            const ownerServerUpdate = await readUntil(ownerClient, (payload) => payload.op === 0 && payload.t === "STREAM_SERVER_UPDATE");
            const ownerServerUpdateData = ownerServerUpdate.d as { token: string; stream_key: string; guild_id: null; endpoint: string };
            assert.equal(typeof ownerServerUpdateData.token, "string");
            assert.equal(ownerServerUpdateData.stream_key, streamKey);
            assert.equal(ownerServerUpdateData.guild_id, null);
            assert.equal(ownerServerUpdateData.endpoint, "127.0.0.1:3004");

            const ownerVoiceUpdate = await readUntil(ownerClient, (payload) => payload.op === 0 && payload.t === "VOICE_STATE_UPDATE");
            assert.equal((ownerVoiceUpdate.d as { user_id: string; channel_id: string; self_stream: boolean }).user_id, owner.id);
            assert.equal((ownerVoiceUpdate.d as { user_id: string; channel_id: string; self_stream: boolean }).channel_id, voiceChannel.id);
            assert.equal((ownerVoiceUpdate.d as { user_id: string; channel_id: string; self_stream: boolean }).self_stream, true);

            const stream = await Stream.findOneOrFail({ where: { channel_id: voiceChannel.id, owner_id: owner.id } });
            assert.equal(stream.id, (ownerStreamCreate.d as { rtc_server_id: string }).rtc_server_id);
            const ownerStreamSession = await StreamSession.findOneOrFail({ where: { stream_id: stream.id, user_id: owner.id } });
            assert.equal(ownerStreamSession.token, ownerServerUpdateData.token);
            assert.equal((await VoiceState.findOneByOrFail({ user_id: owner.id })).self_stream, true);

            viewerClient = await connectIdentifiedGatewayClient(gateway.url, viewerToken);
            await readUntil(viewerClient, (payload) => payload.op === 0 && payload.t === "READY_SUPPLEMENTAL");
            await waitForEventListener(viewer.id);

            viewerClient.send(
                JSON.stringify({
                    op: 20,
                    d: {
                        stream_key: streamKey,
                    },
                }),
            );

            const viewerStreamCreate = await readUntil(viewerClient, (payload) => payload.op === 0 && payload.t === "STREAM_CREATE");
            assert.equal((viewerStreamCreate.d as { stream_key: string }).stream_key, streamKey);
            assert.equal((viewerStreamCreate.d as { rtc_server_id: string }).rtc_server_id, stream.id);
            assert.deepEqual((viewerStreamCreate.d as { viewer_ids: string[] }).viewer_ids, []);

            const viewerServerUpdate = await readUntil(viewerClient, (payload) => payload.op === 0 && payload.t === "STREAM_SERVER_UPDATE");
            const viewerServerUpdateData = viewerServerUpdate.d as { token: string; stream_key: string; guild_id: null; endpoint: string };
            assert.equal(typeof viewerServerUpdateData.token, "string");
            assert.equal(viewerServerUpdateData.stream_key, streamKey);
            assert.equal(viewerServerUpdateData.endpoint, "127.0.0.1:3004");
            const viewerStreamSession = await StreamSession.findOneOrFail({ where: { stream_id: stream.id, user_id: viewer.id } });
            assert.equal(viewerStreamSession.token, viewerServerUpdateData.token);

            ownerClient.send(
                JSON.stringify({
                    op: 19,
                    d: {
                        stream_key: streamKey,
                    },
                }),
            );

            const deleteVoiceUpdate = await readUntil(ownerClient, (payload) => payload.op === 0 && payload.t === "VOICE_STATE_UPDATE");
            assert.equal((deleteVoiceUpdate.d as { user_id: string; channel_id: string | null; self_stream: boolean }).user_id, owner.id);
            assert.equal((deleteVoiceUpdate.d as { user_id: string; channel_id: string | null; self_stream: boolean }).channel_id, voiceChannel.id);
            assert.equal((deleteVoiceUpdate.d as { user_id: string; channel_id: string | null; self_stream: boolean }).self_stream, false);

            const streamDelete = await readUntil(ownerClient, (payload) => payload.op === 0 && payload.t === "STREAM_DELETE");
            assert.deepEqual(streamDelete.d, { stream_key: streamKey });
            assert.equal(await Stream.findOneBy({ id: stream.id }), null);
            assert.equal(await StreamSession.countBy({ stream_id: stream.id }), 0);
            assert.equal((await VoiceState.findOneByOrFail({ user_id: owner.id })).self_stream, false);
        } finally {
            if (ownerClient) await closeClient(ownerClient);
            if (viewerClient) await closeClient(viewerClient);
            if (ownerClient || viewerClient) await waitForCloseHandlers();
            if (gateway) await gateway.stop();
            await closeDatabase();
            await database.close();
            restoreProcessState(previous);
            await rm(tempCwd, { recursive: true, force: true });
        }
    },
);

async function connectIdentifiedGatewayClient(gatewayUrl: string, token: string) {
    const client = new ws(`${gatewayUrl}/?version=8&encoding=json`, { headers: { "User-Agent": "spacebar-test" } });
    const hello = await readJsonMessage(client);
    assert.equal(hello.op, 10);

    client.send(
        JSON.stringify({
            op: 2,
            d: {
                token,
                intents: 0,
                properties: {
                    os: "test",
                    browser: "spacebar-test",
                    device: "spacebar-test",
                },
            },
        }),
    );

    return client;
}

async function readUntil(client: ws, predicate: (payload: GatewayPayload) => boolean) {
    for (let i = 0; i < 10; i++) {
        const payload = await readJsonMessage(client);
        if (predicate(payload)) return payload;
    }

    assert.fail("Timed out waiting for matching gateway payload");
}

async function readJsonMessage(client: ws) {
    const state = getBufferedGatewayClientState(client);
    const queued = state.messages.shift();
    if (queued) return JSON.parse(queued.toString()) as GatewayPayload;

    const raw = await new Promise<ws.RawData>((resolve, reject) => {
        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error("Timed out waiting for gateway message"));
        }, 10_000);
        const cleanup = () => {
            clearTimeout(timeout);
            const waiterIndex = state.waiters.indexOf(onMessage);
            if (waiterIndex !== -1) state.waiters.splice(waiterIndex, 1);
            client.off("error", onError);
            client.off("close", onClose);
        };
        const onMessage = (message: ws.RawData) => {
            cleanup();
            resolve(message);
        };
        const onError = (error: Error) => {
            cleanup();
            reject(error);
        };
        const onClose = (code: number) => {
            cleanup();
            reject(new Error(`Gateway closed before message: ${code}`));
        };
        state.waiters.push(onMessage);
        client.once("error", onError);
        client.once("close", onClose);
    });

    return JSON.parse(raw.toString()) as GatewayPayload;
}

function getBufferedGatewayClientState(client: ws) {
    const existing = bufferedGatewayClients.get(client);
    if (existing) return existing;

    const state: BufferedGatewayClientState = {
        messages: [],
        waiters: [],
    };
    client.on("message", (message) => {
        const waiter = state.waiters.shift();
        if (waiter) waiter(message);
        else state.messages.push(message);
    });
    bufferedGatewayClients.set(client, state);

    return state;
}

async function readClose(client: ws) {
    return await new Promise<{ code: number; reason: Buffer }>((resolve, reject) => {
        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error("Timed out waiting for gateway close"));
        }, 10_000);
        const cleanup = () => {
            clearTimeout(timeout);
            client.off("close", onClose);
            client.off("error", onError);
        };
        const onClose = (code: number, reason: Buffer) => {
            cleanup();
            resolve({ code, reason });
        };
        const onError = (error: Error) => {
            cleanup();
            reject(error);
        };
        client.once("close", onClose);
        client.once("error", onError);
    });
}

async function closeClient(client: ws) {
    if (client.readyState === ws.CLOSED) return;
    await new Promise<void>((resolve) => {
        client.once("close", () => resolve());
        if (client.readyState === ws.OPEN || client.readyState === ws.CONNECTING) client.close();
    });
}

async function waitForCloseHandlers() {
    await new Promise<void>((resolve) => {
        setTimeout(resolve, 100);
    });
}

async function waitForEventListener(eventId: string) {
    for (let i = 0; i < 20; i++) {
        if (events.listenerCount(eventId) > 0) return;
        await new Promise<void>((resolve) => {
            setTimeout(resolve, 25);
        });
    }

    assert.fail(`Timed out waiting for event listener ${eventId}`);
}

function snapshotProcessState() {
    return {
        cwd: process.cwd(),
        DATABASE: process.env.DATABASE,
        APPLY_DB_MIGRATIONS: process.env.APPLY_DB_MIGRATIONS,
        CONFIG_PATH: process.env.CONFIG_PATH,
        DB_SYNC: process.env.DB_SYNC,
        EVENT_TRANSMISSION: process.env.EVENT_TRANSMISSION,
        EVENT_SOCKET_PATH: process.env.EVENT_SOCKET_PATH,
        RABBITMQ_HOST: process.env.RABBITMQ_HOST,
    };
}

function restoreProcessState(state: ReturnType<typeof snapshotProcessState>) {
    process.chdir(state.cwd);
    restoreEnv("DATABASE", state.DATABASE);
    restoreEnv("APPLY_DB_MIGRATIONS", state.APPLY_DB_MIGRATIONS);
    restoreEnv("CONFIG_PATH", state.CONFIG_PATH);
    restoreEnv("DB_SYNC", state.DB_SYNC);
    restoreEnv("EVENT_TRANSMISSION", state.EVENT_TRANSMISSION);
    restoreEnv("EVENT_SOCKET_PATH", state.EVENT_SOCKET_PATH);
    restoreEnv("RABBITMQ_HOST", state.RABBITMQ_HOST);
}

function restoreEnv(name: string, value: string | undefined) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
}
