import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { closeDatabase, Config, generateToken, initDatabase, Message, User, Webhook } from "@spacebar/util";
import { assertJsonObject, assertStatus } from "../assertions/http";
import { createDisposablePostgresDatabase, hasPostgresAdminUrl } from "../fixtures/database";
import { captureEvents } from "../fixtures/events";
import { startApi } from "../server/startApi";

type EventCapture = Awaited<ReturnType<typeof captureEvents>>;
type CapturedEvent = EventCapture["events"][number];

const coveredManifestIds = [
    "api:http:GET:/channels/:channel_id/webhooks/",
    "api:http:POST:/channels/:channel_id/webhooks/",
    "api:http:GET:/guilds/:guild_id/webhooks/",
    "api:http:GET:/webhooks/:webhook_id/",
    "api:http:PATCH:/webhooks/:webhook_id/",
    "api:http:DELETE:/webhooks/:webhook_id/",
    "api:http:GET:/webhooks/:webhook_id/:token/",
    "api:http:PATCH:/webhooks/:webhook_id/:token/",
    "api:http:POST:/webhooks/:webhook_id/:token/",
    "api:http:POST:/webhooks/:webhook_id/:token/github/",
    "api:http:DELETE:/webhooks/:webhook_id/:token/",
];

test(
    "webhook create, list, update, execute, github execute, and delete routes persist state and emit events",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 180_000,
    },
    async () => {
        assert.deepEqual(coveredManifestIds, [
            "api:http:GET:/channels/:channel_id/webhooks/",
            "api:http:POST:/channels/:channel_id/webhooks/",
            "api:http:GET:/guilds/:guild_id/webhooks/",
            "api:http:GET:/webhooks/:webhook_id/",
            "api:http:PATCH:/webhooks/:webhook_id/",
            "api:http:DELETE:/webhooks/:webhook_id/",
            "api:http:GET:/webhooks/:webhook_id/:token/",
            "api:http:PATCH:/webhooks/:webhook_id/:token/",
            "api:http:POST:/webhooks/:webhook_id/:token/",
            "api:http:POST:/webhooks/:webhook_id/:token/github/",
            "api:http:DELETE:/webhooks/:webhook_id/:token/",
        ]);

        const database = await createDisposablePostgresDatabase({ prefix: "spacebar_webhooks" });
        const tempCwd = await mkdtemp(path.join(tmpdir(), "spacebar-webhooks-"));
        const previous = snapshotProcessState();
        let api: Awaited<ReturnType<typeof startApi>> | undefined;
        let channelEvents: EventCapture | undefined;
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
            restoreFetch = installWebhookFetchStub();

            await initDatabase();
            api = await startApi();

            const suffix = `${process.pid}${Date.now()}`;
            const owner = await User.register({
                username: `webhookowner${suffix.slice(-8)}`,
                email: `webhook-owner-${suffix}@example.com`,
                password: "not-a-real-login-hash",
            });
            const token = await generateToken(owner.id);
            assert.ok(token, "token generation should return a bearer token");

            const createdGuild = await postJson(`${api.apiBaseUrl}/guilds`, { name: `webhooks-${suffix.slice(-8)}` }, token);
            await assertStatus(createdGuild, 201);
            const guildId = (await assertJsonObject(createdGuild)).id as string;

            const channels = await getJsonArray(`${api.apiBaseUrl}/guilds/${guildId}/channels`, token);
            assert.equal(channels.length, 1);
            const channelId = channels[0].id as string;
            channelEvents = await captureEvents(channelId);

            const createWebhook = await postJson(`${api.apiBaseUrl}/channels/${channelId}/webhooks`, { name: "scenario-hook" }, token);
            await assertStatus(createWebhook, 200);
            const createWebhookBody = await assertJsonObject(createWebhook);
            const webhookId = createWebhookBody.id as string;
            const webhookToken = createWebhookBody.token as string;
            assert.equal(createWebhookBody.guild_id, guildId);
            assert.equal(createWebhookBody.channel_id, channelId);
            assert.equal(createWebhookBody.name, "scenario-hook");
            const persistedWebhook = await Webhook.findOneByOrFail({ id: webhookId });
            assert.equal(persistedWebhook.token, webhookToken);
            assert.equal(persistedWebhook.user_id, owner.id);

            const createTokenWebhook = await postJson(`${api.apiBaseUrl}/channels/${channelId}/webhooks`, { name: "scenario-token-hook" }, token);
            await assertStatus(createTokenWebhook, 200);
            const createTokenWebhookBody = await assertJsonObject(createTokenWebhook);
            const tokenWebhookId = createTokenWebhookBody.id as string;
            const tokenWebhookToken = createTokenWebhookBody.token as string;

            const channelWebhooks = await getJsonArray(`${api.apiBaseUrl}/channels/${channelId}/webhooks`, token);
            assert.deepEqual(channelWebhooks.map((webhook) => webhook.id).sort(), [tokenWebhookId, webhookId].sort());
            const guildWebhooks = await getJsonArray(`${api.apiBaseUrl}/guilds/${guildId}/webhooks`, token);
            assert.deepEqual(guildWebhooks.map((webhook) => webhook.id).sort(), [tokenWebhookId, webhookId].sort());

            const authenticatedGet = await getJson(`${api.apiBaseUrl}/webhooks/${webhookId}`, token);
            await assertStatus(authenticatedGet, 200);
            const authenticatedGetBody = await assertJsonObject(authenticatedGet);
            assert.equal(authenticatedGetBody.id, webhookId);
            assert.equal(authenticatedGetBody.token, webhookToken);

            const beforeAuthenticatedPatch = markCapturedEvents(channelEvents);
            const authenticatedPatch = await patchJson(`${api.apiBaseUrl}/webhooks/${webhookId}`, { name: "scenario-hook-auth-updated" }, token);
            await assertStatus(authenticatedPatch, 200);
            const authenticatedPatchBody = await assertJsonObject(authenticatedPatch);
            assert.equal(authenticatedPatchBody.name, "scenario-hook-auth-updated");
            const authenticatedPatchEvent = await waitForEventAfter(
                channelEvents,
                beforeAuthenticatedPatch,
                (event) => event.event === "WEBHOOKS_UPDATE" && event.channel_id === channelId,
            );
            assert.equal(authenticatedPatchEvent.data.guild_id, guildId);
            assert.equal((await Webhook.findOneByOrFail({ id: webhookId })).name, "scenario-hook-auth-updated");

            const tokenGet = await fetch(`${api.apiBaseUrl}/webhooks/${tokenWebhookId}/${tokenWebhookToken}`);
            await assertStatus(tokenGet, 200);
            const tokenGetBody = await assertJsonObject(tokenGet);
            assert.equal(tokenGetBody.id, tokenWebhookId);
            assert.equal(tokenGetBody.token, tokenWebhookToken);

            const beforeTokenPatch = markCapturedEvents(channelEvents);
            const tokenPatch = await patchPublicJson(`${api.apiBaseUrl}/webhooks/${tokenWebhookId}/${tokenWebhookToken}`, { name: "scenario-hook-token-updated" });
            await assertStatus(tokenPatch, 200);
            const tokenPatchBody = await assertJsonObject(tokenPatch);
            assert.equal(tokenPatchBody.name, "scenario-hook-token-updated");
            const tokenPatchEvent = await waitForEventAfter(channelEvents, beforeTokenPatch, (event) => event.event === "WEBHOOKS_UPDATE" && event.channel_id === channelId);
            assert.equal(tokenPatchEvent.data.guild_id, guildId);
            assert.equal((await Webhook.findOneByOrFail({ id: tokenWebhookId })).name, "scenario-hook-token-updated");

            const webhookContent = "webhook scenario message https://example.com/webhook-scenario";
            const executeWebhook = await postPublicJson(`${api.apiBaseUrl}/webhooks/${webhookId}/${webhookToken}?wait=true`, {
                content: webhookContent,
                username: "ScenarioHook",
            });
            await assertStatus(executeWebhook, 200);
            const executeWebhookBody = await assertJsonObject(executeWebhook);
            const normalMessageId = executeWebhookBody.id as string;
            assert.equal(executeWebhookBody.channel_id, channelId);
            assert.equal(executeWebhookBody.content, webhookContent);
            assert.equal(executeWebhookBody.webhook_id, webhookId);
            const normalMessageEvent = await channelEvents.waitFor(
                (event) => event.event === "MESSAGE_CREATE" && event.channel_id === channelId && event.data.id === normalMessageId,
            );
            assert.equal(normalMessageEvent.data.webhook_id, webhookId);
            const normalMessageUpdateEvent = await channelEvents.waitFor(
                (event) =>
                    event.event === "MESSAGE_UPDATE" &&
                    event.channel_id === channelId &&
                    event.data.id === normalMessageId &&
                    Array.isArray(event.data.embeds) &&
                    event.data.embeds.some((embed: Record<string, unknown>) => embed.title === "Webhook Scenario Link"),
                1000,
            );
            assert.equal(normalMessageUpdateEvent.data.webhook_id, webhookId);
            const persistedNormalMessage = await Message.findOneByOrFail({ id: normalMessageId, channel_id: channelId });
            assert.equal(persistedNormalMessage.webhook_id, webhookId);
            assert.equal(persistedNormalMessage.embeds?.[0]?.title, "Webhook Scenario Link");

            const githubWebhook = await postPublicJson(
                `${api.apiBaseUrl}/webhooks/${webhookId}/${webhookToken}/github`,
                {
                    ref: "refs/heads/main",
                    forced: false,
                    compare: "https://github.example/compare",
                    repository: {
                        name: "scenario-repo",
                        full_name: "spacebar/scenario-repo",
                    },
                    sender: {
                        login: "octocat",
                        avatar_url: "https://github.example/avatar.png",
                        html_url: "https://github.example/octocat",
                    },
                    commits: [
                        {
                            id: "1234567890abcdef",
                            url: "https://github.example/commit/1234567",
                            message: "Add webhook scenario",
                            author: { username: "octocat" },
                        },
                    ],
                    head_commit: {
                        id: "1234567890abcdef",
                        url: "https://github.example/commit/1234567",
                    },
                },
                {
                    "x-github-event": "push",
                },
            );
            await assertStatus(githubWebhook, 200);
            const githubWebhookBody = await assertJsonObject(githubWebhook);
            const githubMessageId = githubWebhookBody.id as string;
            assert.equal(githubWebhookBody.webhook_id, webhookId);
            const githubEmbeds = githubWebhookBody.embeds as Array<Record<string, unknown>>;
            assert.equal(githubEmbeds.length, 1);
            assert.equal(githubEmbeds[0].title, "[scenario-repo:main] 1 new commit");
            const githubMessageEvent = await channelEvents.waitFor(
                (event) => event.event === "MESSAGE_CREATE" && event.channel_id === channelId && event.data.id === githubMessageId,
            );
            assert.equal(githubMessageEvent.data.webhook_id, webhookId);
            assert.equal(await Message.countBy({ webhook_id: webhookId, channel_id: channelId }), 2);

            const beforeAuthenticatedDelete = markCapturedEvents(channelEvents);
            await assertStatus(await deleteJson(`${api.apiBaseUrl}/webhooks/${webhookId}`, token), 204);
            const bulkDeleteEvent = await waitForEventAfter(
                channelEvents,
                beforeAuthenticatedDelete,
                (event) =>
                    event.event === "MESSAGE_DELETE_BULK" &&
                    event.channel_id === channelId &&
                    [githubMessageId, normalMessageId].every((id) => (event.data.ids as string[]).includes(id)),
            );
            assert.equal(bulkDeleteEvent.data.guild_id, guildId);
            const authenticatedDeleteEvent = await waitForEventAfter(
                channelEvents,
                beforeAuthenticatedDelete,
                (event) => event.event === "WEBHOOKS_UPDATE" && event.channel_id === channelId,
            );
            assert.equal(authenticatedDeleteEvent.data.guild_id, guildId);
            assert.equal(await Webhook.findOneBy({ id: webhookId }), null);
            assert.equal(await Message.countBy({ webhook_id: webhookId, channel_id: channelId }), 0);

            const beforeTokenDelete = markCapturedEvents(channelEvents);
            await assertStatus(await fetch(`${api.apiBaseUrl}/webhooks/${tokenWebhookId}/${tokenWebhookToken}`, { method: "DELETE" }), 204);
            const tokenDeleteEvent = await waitForEventAfter(channelEvents, beforeTokenDelete, (event) => event.event === "WEBHOOKS_UPDATE" && event.channel_id === channelId);
            assert.equal(tokenDeleteEvent.data.guild_id, guildId);
            assert.equal(await Webhook.findOneBy({ id: tokenWebhookId }), null);
        } finally {
            if (channelEvents) await channelEvents.stop();
            if (api) await api.stop();
            restoreFetch?.();
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

async function postPublicJson(url: string, body: unknown, headers: Record<string, string> = {}) {
    return await fetch(url, {
        method: "POST",
        headers: {
            ...headers,
            "content-type": "application/json",
        },
        body: JSON.stringify(body),
    });
}

async function patchPublicJson(url: string, body: unknown) {
    return await fetch(url, {
        method: "PATCH",
        headers: {
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

function installWebhookFetchStub() {
    const originalFetch = globalThis.fetch;
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64");
    globalThis.fetch = async (input, init) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

        if (url === "https://github.githubassets.com/assets/GitHub-Mark-ea2971cee799.png") {
            return new Response(png, {
                status: 200,
                headers: { "content-type": "image/png" },
            });
        }

        if (url.startsWith("http://127.0.0.1:3003/avatars/")) {
            return Response.json({
                id: "stubbed-github-avatar",
                content_type: "image/png",
                filename: "avatar.png",
                size: png.length,
                url: "http://localhost:3003/avatars/stubbed-github-avatar",
            });
        }

        if (url === "https://example.com/webhook-scenario") {
            if (init?.method === "HEAD") {
                return new Response(null, {
                    status: 200,
                    headers: { "content-type": "text/html" },
                });
            }

            return new Response(
                `<!doctype html><html><head><title>Webhook Scenario Link</title><meta name="description" content="Generated webhook URL embed"></head><body></body></html>`,
                {
                    status: 200,
                    headers: { "content-type": "text/html" },
                },
            );
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

function restoreEnv(name: string, value: string | undefined) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
}
