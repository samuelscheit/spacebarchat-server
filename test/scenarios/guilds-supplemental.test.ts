import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { Ban, closeDatabase, Config, Emoji, generateToken, Guild, initDatabase, Invite, Member, Sticker, Template, User } from "@spacebar/util";
import { assertJsonObject, assertStatus } from "../assertions/http";
import { createDisposablePostgresDatabase, hasPostgresAdminUrl } from "../fixtures/database";
import { captureEvents } from "../fixtures/events";
import { startApi } from "../server/startApi";

const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
const pngDataUri = `data:image/png;base64,${pngBase64}`;

const coveredManifestIds = [
    "api:http:GET:/guilds/:guild_id/audit-logs/",
    "api:http:DELETE:/guilds/:guild_id/bans/:user_id",
    "api:http:GET:/guilds/:guild_id/bans/:user_id",
    "api:http:PUT:/guilds/:guild_id/bans/:user_id",
    "api:http:GET:/guilds/:guild_id/bans/",
    "api:http:GET:/guilds/:guild_id/bans/search",
    "api:http:DELETE:/guilds/:guild_id/emojis/:emoji_id",
    "api:http:GET:/guilds/:guild_id/emojis/:emoji_id",
    "api:http:PATCH:/guilds/:guild_id/emojis/:emoji_id",
    "api:http:GET:/guilds/:guild_id/emojis/",
    "api:http:POST:/guilds/:guild_id/emojis/",
    "api:http:GET:/guilds/:guild_id/shield.svg/",
    "api:http:DELETE:/guilds/:guild_id/stickers/:sticker_id",
    "api:http:GET:/guilds/:guild_id/stickers/:sticker_id",
    "api:http:PATCH:/guilds/:guild_id/stickers/:sticker_id",
    "api:http:GET:/guilds/:guild_id/stickers/",
    "api:http:POST:/guilds/:guild_id/stickers/",
    "api:http:DELETE:/guilds/:guild_id/templates/:code",
    "api:http:PATCH:/guilds/:guild_id/templates/:code",
    "api:http:PUT:/guilds/:guild_id/templates/:code",
    "api:http:GET:/guilds/:guild_id/templates/",
    "api:http:POST:/guilds/:guild_id/templates/",
    "api:http:GET:/guilds/:guild_id/welcome-screen/",
    "api:http:PATCH:/guilds/:guild_id/welcome-screen/",
    "api:http:GET:/guilds/:guild_id/widget.json/",
    "api:http:GET:/guilds/:guild_id/widget/",
    "api:http:PATCH:/guilds/:guild_id/widget/",
    "api:http:GET:/guilds/templates/:template_code",
    "api:http:POST:/guilds/templates/:template_code",
];

test(
    "guild supplemental routes persist moderation, customization, template, and widget state",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 180_000,
    },
    async () => {
        assert.deepEqual(coveredManifestIds, [
            "api:http:GET:/guilds/:guild_id/audit-logs/",
            "api:http:DELETE:/guilds/:guild_id/bans/:user_id",
            "api:http:GET:/guilds/:guild_id/bans/:user_id",
            "api:http:PUT:/guilds/:guild_id/bans/:user_id",
            "api:http:GET:/guilds/:guild_id/bans/",
            "api:http:GET:/guilds/:guild_id/bans/search",
            "api:http:DELETE:/guilds/:guild_id/emojis/:emoji_id",
            "api:http:GET:/guilds/:guild_id/emojis/:emoji_id",
            "api:http:PATCH:/guilds/:guild_id/emojis/:emoji_id",
            "api:http:GET:/guilds/:guild_id/emojis/",
            "api:http:POST:/guilds/:guild_id/emojis/",
            "api:http:GET:/guilds/:guild_id/shield.svg/",
            "api:http:DELETE:/guilds/:guild_id/stickers/:sticker_id",
            "api:http:GET:/guilds/:guild_id/stickers/:sticker_id",
            "api:http:PATCH:/guilds/:guild_id/stickers/:sticker_id",
            "api:http:GET:/guilds/:guild_id/stickers/",
            "api:http:POST:/guilds/:guild_id/stickers/",
            "api:http:DELETE:/guilds/:guild_id/templates/:code",
            "api:http:PATCH:/guilds/:guild_id/templates/:code",
            "api:http:PUT:/guilds/:guild_id/templates/:code",
            "api:http:GET:/guilds/:guild_id/templates/",
            "api:http:POST:/guilds/:guild_id/templates/",
            "api:http:GET:/guilds/:guild_id/welcome-screen/",
            "api:http:PATCH:/guilds/:guild_id/welcome-screen/",
            "api:http:GET:/guilds/:guild_id/widget.json/",
            "api:http:GET:/guilds/:guild_id/widget/",
            "api:http:PATCH:/guilds/:guild_id/widget/",
            "api:http:GET:/guilds/templates/:template_code",
            "api:http:POST:/guilds/templates/:template_code",
        ]);

        const database = await createDisposablePostgresDatabase({ prefix: "spacebar_guilds_supplemental" });
        const tempCwd = await mkdtemp(path.join(tmpdir(), "spacebar-guilds-supplemental-"));
        const previous = snapshotProcessState();
        let api: Awaited<ReturnType<typeof startApi>> | undefined;
        let events: Awaited<ReturnType<typeof captureEvents>> | undefined;
        let restoreFetch: (() => void) | undefined;

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
                    general: { serverName: "localhost", autoCreateBotUsers: false },
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
                    templates: {
                        enabled: true,
                        allowDiscordTemplates: false,
                        allowRaws: false,
                    },
                }),
            );
            await Config.init(true);
            restoreFetch = installCdnUploadFetchStub();
            await initDatabase();
            api = await startApi();

            const suffix = `${process.pid}${Date.now()}`;
            const owner = await User.register({
                username: `guildsuppowner${suffix.slice(-8)}`,
                email: `guild-supp-owner-${suffix}@example.com`,
                password: "not-a-real-login-hash",
            });
            const ownerToken = await generateToken(owner.id);
            assert.ok(ownerToken, "owner token generation should return a bearer token");

            const target = await User.register({
                username: `guildsuppbanned${suffix.slice(-8)}`,
                email: `guild-supp-banned-${suffix}@example.com`,
                password: "not-a-real-login-hash",
            });

            const createdGuild = await postJson(`${api.apiBaseUrl}/guilds`, { name: `supplemental-${suffix.slice(-8)}` }, ownerToken);
            await assertStatus(createdGuild, 201);
            const guildId = (await assertJsonObject(createdGuild)).id as string;
            const channels = await getJsonArray(`${api.apiBaseUrl}/guilds/${guildId}/channels`, ownerToken);
            const channelId = channels[0].id as string;
            await Member.addToGuild(target.id, guildId);
            events = await captureEvents(guildId);

            await assertStatus(
                await putJson(
                    `${api.apiBaseUrl}/guilds/${guildId}/bans/${target.id}`,
                    {
                        reason: "scenario ban",
                        delete_message_seconds: 30,
                    },
                    ownerToken,
                ),
                204,
            );
            const banAdd = await waitForLabeledEvent(
                events,
                (event) => event.event === "GUILD_BAN_ADD" && event.guild_id === guildId && event.data.user.id === target.id,
                "GUILD_BAN_ADD",
            );
            assert.equal(banAdd.data.delete_message_secs, 30);
            assert.equal((await Ban.findOneByOrFail({ guild_id: guildId, user_id: target.id })).reason, "scenario ban");
            assert.equal(await Member.findOneBy({ guild_id: guildId, id: target.id }), null);
            assert.equal(((await getJsonArray(`${api.apiBaseUrl}/guilds/${guildId}/bans`, ownerToken))[0].user as Record<string, unknown>).id, target.id);
            assert.equal((await assertJsonObject(await getJson(`${api.apiBaseUrl}/guilds/${guildId}/bans/${target.id}`, ownerToken))).reason, "scenario ban");
            assert.equal(
                ((await getJsonArray(`${api.apiBaseUrl}/guilds/${guildId}/bans/search?query=guildsuppbanned&limit=1`, ownerToken))[0].user as Record<string, unknown>).id,
                target.id,
            );
            await assertStatus(await deleteJson(`${api.apiBaseUrl}/guilds/${guildId}/bans/${target.id}`, ownerToken), 204);
            await waitForLabeledEvent(events, (event) => event.event === "GUILD_BAN_REMOVE" && event.guild_id === guildId && event.data.user.id === target.id, "GUILD_BAN_REMOVE");
            assert.equal(await Ban.findOneBy({ guild_id: guildId, user_id: target.id }), null);

            const createdEmoji = await postJson(
                `${api.apiBaseUrl}/guilds/${guildId}/emojis`,
                {
                    name: "scenario-emoji",
                    image: pngDataUri,
                },
                ownerToken,
            );
            await assertStatus(createdEmoji, 201);
            const createdEmojiBody = await assertJsonObject(createdEmoji);
            const emojiId = createdEmojiBody.id as string;
            assert.equal(createdEmojiBody.name, "scenarioemoji");
            await waitForLabeledEvent(
                events,
                (event) => event.event === "GUILD_EMOJIS_UPDATE" && event.guild_id === guildId && event.data.emojis.some((emoji: Record<string, unknown>) => emoji.id === emojiId),
                "emoji create update",
            );
            assert.equal((await getJsonArray(`${api.apiBaseUrl}/guilds/${guildId}/emojis`, ownerToken))[0].id, emojiId);
            assert.equal((await assertJsonObject(await getJson(`${api.apiBaseUrl}/guilds/${guildId}/emojis/${emojiId}`, ownerToken))).id, emojiId);
            const patchedEmoji = await patchJson(`${api.apiBaseUrl}/guilds/${guildId}/emojis/${emojiId}`, { name: "scenario-renamed" }, ownerToken);
            await assertStatus(patchedEmoji, 200);
            assert.equal((await assertJsonObject(patchedEmoji)).name, "scenariorenamed");
            assert.equal((await Emoji.findOneByOrFail({ guild_id: guildId, id: emojiId })).name, "scenariorenamed");
            await assertStatus(await deleteJson(`${api.apiBaseUrl}/guilds/${guildId}/emojis/${emojiId}`, ownerToken), 204);
            await waitForLabeledEvent(
                events,
                (event) => event.event === "GUILD_EMOJIS_UPDATE" && event.guild_id === guildId && event.data.emojis.length === 0,
                "emoji delete update",
            );
            assert.equal(await Emoji.findOneBy({ guild_id: guildId, id: emojiId }), null);

            const createdSticker = await postMultipart(`${api.apiBaseUrl}/guilds/${guildId}/stickers`, stickerForm("scenario-sticker", "scenario"), ownerToken);
            await assertStatus(createdSticker, 200);
            const createdStickerBody = await assertJsonObject(createdSticker);
            const stickerId = createdStickerBody.id as string;
            await waitForLabeledEvent(
                events,
                (event) =>
                    event.event === "GUILD_STICKERS_UPDATE" &&
                    event.guild_id === guildId &&
                    event.data.stickers.some((sticker: Record<string, unknown>) => sticker.id === stickerId),
                "sticker create update",
            );
            assert.equal((await getJsonArray(`${api.apiBaseUrl}/guilds/${guildId}/stickers`, ownerToken))[0].id, stickerId);
            assert.equal((await assertJsonObject(await getJson(`${api.apiBaseUrl}/guilds/${guildId}/stickers/${stickerId}`, ownerToken))).id, stickerId);
            const patchedSticker = await patchJson(`${api.apiBaseUrl}/guilds/${guildId}/stickers/${stickerId}`, { name: "scenario-sticker-renamed", tags: "updated" }, ownerToken);
            await assertStatus(patchedSticker, 200);
            assert.equal((await assertJsonObject(patchedSticker)).name, "scenario-sticker-renamed");
            assert.equal((await Sticker.findOneByOrFail({ guild_id: guildId, id: stickerId })).tags, "updated");
            await assertStatus(await deleteJson(`${api.apiBaseUrl}/guilds/${guildId}/stickers/${stickerId}`, ownerToken), 204);
            await waitForLabeledEvent(
                events,
                (event) => event.event === "GUILD_STICKERS_UPDATE" && event.guild_id === guildId && event.data.stickers.length === 0,
                "sticker delete update",
            );
            assert.equal(await Sticker.findOneBy({ guild_id: guildId, id: stickerId }), null);

            const createdTemplate = await postJson(
                `${api.apiBaseUrl}/guilds/${guildId}/templates`,
                {
                    name: "scenario-template",
                    description: "scenario template description",
                },
                ownerToken,
            );
            await assertStatus(createdTemplate, 200);
            const createdTemplateBody = await assertJsonObject(createdTemplate);
            const templateCode = createdTemplateBody.code as string;
            assert.equal(createdTemplateBody.source_guild_id, guildId);
            assert.equal((await Template.findOneByOrFail({ code: templateCode })).creator_id, owner.id);
            assert.equal((await getJsonArray(`${api.apiBaseUrl}/guilds/${guildId}/templates`, ownerToken))[0].code, templateCode);
            assert.equal((await assertJsonObject(await getJson(`${api.apiBaseUrl}/guilds/templates/${templateCode}`, ownerToken))).code, templateCode);
            const templatedGuild = await postJson(`${api.apiBaseUrl}/guilds/templates/${templateCode}`, { name: `from-template-${suffix.slice(-8)}` }, ownerToken);
            await assertStatus(templatedGuild, 201);
            const templatedGuildId = (await assertJsonObject(templatedGuild)).id as string;
            assert.equal((await Guild.findOneByOrFail({ id: templatedGuildId })).name, `from-template-${suffix.slice(-8)}`);
            await assertStatus(await patchJson(`${api.apiBaseUrl}/guilds/${guildId}/templates/${templateCode}`, { name: "scenario-template-updated" }, ownerToken), 200);
            assert.equal((await Template.findOneByOrFail({ code: templateCode })).name, "scenario-template-updated");
            await assertStatus(await putJson(`${api.apiBaseUrl}/guilds/${guildId}/templates/${templateCode}`, {}, ownerToken), 200);
            assert.equal((await Template.findOneByOrFail({ code: templateCode })).serialized_source_guild.id, guildId);
            const deletedTemplate = await deleteJson(`${api.apiBaseUrl}/guilds/${guildId}/templates/${templateCode}`, ownerToken);
            await assertStatus(deletedTemplate, 200);
            assert.equal((await assertJsonObject(deletedTemplate)).code, templateCode);
            assert.equal(await Template.findOneBy({ code: templateCode }), null);

            const patchedWelcome = await patchJson(
                `${api.apiBaseUrl}/guilds/${guildId}/welcome-screen`,
                {
                    enabled: true,
                    description: "Welcome to the supplemental scenario",
                    welcome_channels: [
                        {
                            channel_id: channelId,
                            description: "Read this first",
                            emoji_name: "wave",
                        },
                    ],
                },
                ownerToken,
            );
            await assertStatus(patchedWelcome, 200);
            assert.equal((await assertJsonObject(patchedWelcome)).enabled, true);
            const welcome = await assertJsonObject(await getJson(`${api.apiBaseUrl}/guilds/${guildId}/welcome-screen`, ownerToken));
            assert.equal(welcome.description, "Welcome to the supplemental scenario");
            assert.equal((await Guild.findOneByOrFail({ id: guildId })).welcome_screen.welcome_channels[0].channel_id, channelId);

            const patchedWidget = await patchJson(`${api.apiBaseUrl}/guilds/${guildId}/widget`, { enabled: true, channel_id: channelId }, ownerToken);
            await assertStatus(patchedWidget, 200);
            assert.deepEqual(await assertJsonObject(patchedWidget), { enabled: true, channel_id: channelId });
            const widgetSettings = await assertJsonObject(await getJson(`${api.apiBaseUrl}/guilds/${guildId}/widget`, ownerToken));
            assert.deepEqual(widgetSettings, { enabled: true, channel_id: channelId });
            const widgetJson = await getJson(`${api.apiBaseUrl}/guilds/${guildId}/widget.json`, ownerToken);
            await assertStatus(widgetJson, 200);
            assert.match(widgetJson.headers.get("cache-control") ?? "", /public/);
            const widgetJsonBody = await assertJsonObject(widgetJson);
            assert.equal(widgetJsonBody.id, guildId);
            assert.equal(widgetJsonBody.name, `supplemental-${suffix.slice(-8)}`);
            assert.ok(await Invite.findOneBy({ guild_id: guildId, channel_id: channelId }));
            const shield = await getJson(`${api.apiBaseUrl}/guilds/${guildId}/shield.svg`, ownerToken);
            await assertStatus(shield, 200);
            assert.match(shield.headers.get("content-type") ?? "", /image\/svg\+xml/);

            const auditLogs = await assertJsonObject(await getJson(`${api.apiBaseUrl}/guilds/${guildId}/audit-logs`, ownerToken));
            assert.deepEqual(Object.keys(auditLogs).sort(), [
                "application_commands",
                "audit_log_entries",
                "auto_moderation_rules",
                "guild_scheduled_events",
                "integrations",
                "threads",
                "users",
                "webhooks",
            ]);
        } finally {
            if (events) await events.stop();
            if (api) await api.stop();
            restoreFetch?.();
            await closeDatabase();
            await database.close();
            restoreProcessState(previous);
            await rm(tempCwd, { recursive: true, force: true });
        }
    },
);

function stickerForm(name: string, tags: string) {
    const form = new FormData();
    form.set("name", name);
    form.set("description", `${name} description`);
    form.set("tags", tags);
    form.set("file", new Blob([Buffer.from(pngBase64, "base64")], { type: "image/png" }), `${name}.png`);
    return form;
}

async function waitForLabeledEvent(capture: Awaited<ReturnType<typeof captureEvents>>, predicate: Parameters<typeof capture.waitFor>[0], label: string) {
    try {
        return await capture.waitFor(predicate, 1000);
    } catch (error) {
        throw new Error(`Timed out waiting for ${label}`, { cause: error });
    }
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

async function postMultipart(url: string, body: FormData, token: string) {
    return await fetch(url, {
        method: "POST",
        headers: {
            authorization: `Bearer ${token}`,
        },
        body,
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

function installCdnUploadFetchStub() {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const method = init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET");

        if (method === "POST" && (url.startsWith("http://127.0.0.1:3003/emojis/") || url.startsWith("http://127.0.0.1:3003/stickers/"))) {
            return Response.json({ id: `cdn-${url.split("/").pop()}`, filename: "scenario.png" });
        }

        return await originalFetch(input, init);
    };

    return () => {
        globalThis.fetch = originalFetch;
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

function restoreEnv(key: string, value: string | undefined) {
    if (value === undefined) {
        delete process.env[key];
    } else {
        process.env[key] = value;
    }
}
