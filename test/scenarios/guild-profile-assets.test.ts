import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { closeDatabase, Config, generateToken, initDatabase, Member, User } from "@spacebar/util";
import { assertJsonObject, assertStatus } from "../assertions/http";
import { createDisposablePostgresDatabase, hasPostgresAdminUrl } from "../fixtures/database";
import { captureEvents } from "../fixtures/events";
import { createCdnObject, withFileStorage } from "../fixtures/files";
import { startApi } from "../server/startApi";
import { startCdn } from "../server/startCdn";

type EventCapture = Awaited<ReturnType<typeof captureEvents>>;
type CapturedEvent = EventCapture["events"][number];
type StartedApi = Awaited<ReturnType<typeof startApi>>;
type StartedCdn = Awaited<ReturnType<typeof startCdn>>;

const requestSignature = "guild-profile-assets-scenario-signature";
const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
const png = Buffer.from(pngBase64, "base64");
const pngDataUri = `data:image/png;base64,${pngBase64}`;
const pngHash = createHash("md5").update(png).digest("hex");

test(
    "guild profile avatar and banner replacements clean up previous CDN assets after successful updates",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 180_000,
    },
    async () => {
        const database = await createDisposablePostgresDatabase({ prefix: "spacebar_guild_profile_assets" });
        const tempCwd = await mkdtemp(path.join(tmpdir(), "spacebar-guild-profile-assets-"));
        const previous = snapshotProcessState();
        let api: StartedApi | undefined;
        let cdn: StartedCdn | undefined;
        let events: EventCapture | undefined;

        try {
            process.chdir(tempCwd);
            process.env.DATABASE = database.url;
            process.env.APPLY_DB_MIGRATIONS = "true";
            process.env.LOG_ROUTES = "false";
            process.env.CONFIG_PATH = path.join(tempCwd, "config.json");
            process.env.CONFIG_READONLY = "true";
            delete process.env.DB_SYNC;
            delete process.env.EVENT_TRANSMISSION;
            delete process.env.EVENT_SOCKET_PATH;
            await writeFile(
                process.env.CONFIG_PATH,
                JSON.stringify({
                    general: { serverName: "localhost" },
                    api: { endpointPublic: "http://localhost:3001/api/v9" },
                    cdn: { endpointPublic: "http://127.0.0.1:3003", endpointPrivate: "http://127.0.0.1:3003" },
                    gateway: { endpointPublic: "ws://localhost:3002" },
                    guild: {
                        autoJoin: {
                            enabled: false,
                            guilds: [],
                            canLeave: true,
                            bots: false,
                        },
                    },
                    security: { requestSignature },
                }),
            );
            await Config.init(true);
            await initDatabase();

            await withFileStorage(async ({ storage }) => {
                cdn = await startCdn({ registerMetricsEndpoint: false });
                Config.get().cdn.endpointPublic = cdn.baseUrl;
                Config.get().cdn.endpointPrivate = cdn.baseUrl;
                api = await startApi({ registerMetricsEndpoint: false });

                try {
                    const suffix = `${process.pid}${Date.now()}`;
                    const owner = await User.register({
                        username: `assetowner${suffix.slice(-8)}`,
                        email: `guild-profile-assets-${suffix}@example.com`,
                        password: "not-a-real-login-hash",
                    });
                    const ownerToken = await generateToken(owner.id);
                    assert.ok(ownerToken, "owner token generation should return a bearer token");

                    const createdGuild = await postJson(`${api.apiBaseUrl}/guilds`, { name: `assets-${suffix.slice(-8)}` }, ownerToken);
                    await assertStatus(createdGuild, 201);
                    const guildId = (await assertJsonObject(createdGuild)).id as string;
                    events = await captureEvents(guildId);

                    const oldAvatarHash = "old-avatar-hash";
                    const oldAvatarPath = `guilds/${guildId}/users/${owner.id}/avatars/${oldAvatarHash}`;
                    await createCdnObject(storage, oldAvatarPath);
                    await Member.update({ guild_id: guildId, id: owner.id }, { avatar: oldAvatarHash });

                    const beforeAvatar = markCapturedEvents(events);
                    const avatarUpdate = await patchJson(`${api.apiBaseUrl}/guilds/${guildId}/members/@me`, { avatar: pngDataUri }, ownerToken);
                    await assertStatus(avatarUpdate, 200);
                    assert.equal((await assertJsonObject(avatarUpdate)).avatar, pngHash);
                    await waitForEventAfter(
                        events,
                        beforeAvatar,
                        (event) => event.event === "GUILD_MEMBER_UPDATE" && event.guild_id === guildId && event.data?.id === owner.id && event.data.avatar === pngHash,
                    );
                    assert.equal((await Member.findOneByOrFail({ guild_id: guildId, id: owner.id })).avatar, pngHash);
                    assert.equal(await storage.exists(oldAvatarPath), false);
                    assert.equal(await storage.exists(`guilds/${guildId}/users/${owner.id}/avatars/${pngHash}`), true);

                    const oldBannerHash = "old-banner-hash";
                    const oldBannerPath = `guilds/${guildId}/users/${owner.id}/banners/${oldBannerHash}`;
                    await createCdnObject(storage, oldBannerPath);
                    await Member.update({ guild_id: guildId, id: owner.id }, { banner: oldBannerHash });

                    const beforeBanner = markCapturedEvents(events);
                    const bannerUpdate = await patchJson(`${api.apiBaseUrl}/guilds/${guildId}/profile/@me`, { banner: pngDataUri }, ownerToken);
                    await assertStatus(bannerUpdate, 200);
                    assert.equal((await assertJsonObject(bannerUpdate)).banner, pngHash);
                    await waitForEventAfter(
                        events,
                        beforeBanner,
                        (event) => event.event === "GUILD_MEMBER_UPDATE" && event.guild_id === guildId && event.data?.id === owner.id && event.data.banner === pngHash,
                    );
                    assert.equal((await Member.findOneByOrFail({ guild_id: guildId, id: owner.id })).banner, pngHash);
                    assert.equal(await storage.exists(oldBannerPath), false);
                    assert.equal(await storage.exists(`guilds/${guildId}/users/${owner.id}/banners/${pngHash}`), true);

                    const failedEventAvatarHash = "avatar-before-failed-event";
                    const failedEventAvatarPath = `guilds/${guildId}/users/${owner.id}/avatars/${failedEventAvatarHash}`;
                    await createCdnObject(storage, failedEventAvatarPath);
                    await Member.update({ guild_id: guildId, id: owner.id }, { avatar: failedEventAvatarHash });

                    const eventState = snapshotEventTransmission();
                    try {
                        process.env.EVENT_TRANSMISSION = "unix";
                        process.env.EVENT_SOCKET_PATH = path.join(tempCwd, "missing-event-socket");
                        const failedUpdate = await patchJson(`${api.apiBaseUrl}/guilds/${guildId}/members/@me`, { avatar: pngDataUri }, ownerToken);
                        await assertStatus(failedUpdate, 500);
                    } finally {
                        restoreEventTransmission(eventState);
                    }

                    assert.equal((await Member.findOneByOrFail({ guild_id: guildId, id: owner.id })).avatar, pngHash);
                    assert.equal(await storage.exists(failedEventAvatarPath), true);
                } finally {
                    if (events) {
                        await events.stop();
                        events = undefined;
                    }
                    if (api) {
                        await api.stop();
                        api = undefined;
                    }
                    if (cdn) {
                        await cdn.stop();
                        cdn = undefined;
                    }
                }
            });
        } finally {
            if (events) await events.stop();
            if (api) await api.stop();
            if (cdn) await cdn.stop();
            await closeDatabase();
            await database.close();
            restoreProcessState(previous);
            await rm(tempCwd, { recursive: true, force: true });
        }
    },
);

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

function markCapturedEvents(capture: EventCapture) {
    return new Set(capture.events);
}

async function waitForEventAfter(capture: EventCapture, previousEvents: Set<CapturedEvent>, predicate: (event: CapturedEvent) => boolean) {
    return await capture.waitFor((event) => !previousEvents.has(event) && predicate(event));
}

function snapshotProcessState() {
    return {
        cwd: process.cwd(),
        DATABASE: process.env.DATABASE,
        APPLY_DB_MIGRATIONS: process.env.APPLY_DB_MIGRATIONS,
        CONFIG_PATH: process.env.CONFIG_PATH,
        CONFIG_READONLY: process.env.CONFIG_READONLY,
        DB_SYNC: process.env.DB_SYNC,
        EVENT_SOCKET_PATH: process.env.EVENT_SOCKET_PATH,
        EVENT_TRANSMISSION: process.env.EVENT_TRANSMISSION,
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
    restoreEnv("EVENT_SOCKET_PATH", state.EVENT_SOCKET_PATH);
    restoreEnv("EVENT_TRANSMISSION", state.EVENT_TRANSMISSION);
    restoreEnv("LOG_ROUTES", state.LOG_ROUTES);
}

function snapshotEventTransmission() {
    return {
        EVENT_SOCKET_PATH: process.env.EVENT_SOCKET_PATH,
        EVENT_TRANSMISSION: process.env.EVENT_TRANSMISSION,
    };
}

function restoreEventTransmission(state: ReturnType<typeof snapshotEventTransmission>) {
    restoreEnv("EVENT_SOCKET_PATH", state.EVENT_SOCKET_PATH);
    restoreEnv("EVENT_TRANSMISSION", state.EVENT_TRANSMISSION);
}

function restoreEnv(name: string, value: string | undefined) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
}
