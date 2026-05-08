import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { Application, ApplicationCommand, closeDatabase, Config, generateToken, initDatabase, Member, Message, pendingInteractions, User } from "@spacebar/util";
import { assertJsonObject, assertStatus } from "../assertions/http";
import { createDisposablePostgresDatabase, hasPostgresAdminUrl } from "../fixtures/database";
import { captureEvents } from "../fixtures/events";
import { startApi } from "../server/startApi";

const coveredManifestIds = [
    "api:http:GET:/applications/",
    "api:http:POST:/applications/",
    "api:http:GET:/applications/:application_id/",
    "api:http:PATCH:/applications/:application_id/",
    "api:http:POST:/applications/:application_id/delete",
    "api:http:POST:/applications/:application_id/bot/",
    "api:http:PATCH:/applications/:application_id/bot/",
    "api:http:POST:/applications/:application_id/bot/reset",
    "api:http:GET:/applications/:application_id/commands/",
    "api:http:POST:/applications/:application_id/commands/",
    "api:http:PUT:/applications/:application_id/commands/",
    "api:http:GET:/applications/:application_id/commands/:command_id/",
    "api:http:PATCH:/applications/:application_id/commands/:command_id/",
    "api:http:DELETE:/applications/:application_id/commands/:command_id/",
    "api:http:GET:/applications/:application_id/guilds/:guild_id/commands/",
    "api:http:POST:/applications/:application_id/guilds/:guild_id/commands/",
    "api:http:PUT:/applications/:application_id/guilds/:guild_id/commands/",
    "api:http:GET:/applications/:application_id/guilds/:guild_id/commands/:command_id/",
    "api:http:PATCH:/applications/:application_id/guilds/:guild_id/commands/:command_id/",
    "api:http:DELETE:/applications/:application_id/guilds/:guild_id/commands/:command_id/",
    "api:http:GET:/applications/:application_id/entitlements/",
    "api:http:GET:/applications/:application_id/skus/",
    "api:http:GET:/applications/@me/",
    "api:http:PATCH:/applications/@me/",
    "api:http:GET:/applications/detectable/",
    "api:http:GET:/guilds/:guild_id/application-command-index/",
    "api:http:POST:/interactions/",
    "api:http:POST:/interactions/:interaction_id/:interaction_token/callback/",
];

test(
    "applications, bots, commands, and interactions persist state and dispatch interaction events",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 180_000,
    },
    async () => {
        assert.deepEqual(coveredManifestIds, [
            "api:http:GET:/applications/",
            "api:http:POST:/applications/",
            "api:http:GET:/applications/:application_id/",
            "api:http:PATCH:/applications/:application_id/",
            "api:http:POST:/applications/:application_id/delete",
            "api:http:POST:/applications/:application_id/bot/",
            "api:http:PATCH:/applications/:application_id/bot/",
            "api:http:POST:/applications/:application_id/bot/reset",
            "api:http:GET:/applications/:application_id/commands/",
            "api:http:POST:/applications/:application_id/commands/",
            "api:http:PUT:/applications/:application_id/commands/",
            "api:http:GET:/applications/:application_id/commands/:command_id/",
            "api:http:PATCH:/applications/:application_id/commands/:command_id/",
            "api:http:DELETE:/applications/:application_id/commands/:command_id/",
            "api:http:GET:/applications/:application_id/guilds/:guild_id/commands/",
            "api:http:POST:/applications/:application_id/guilds/:guild_id/commands/",
            "api:http:PUT:/applications/:application_id/guilds/:guild_id/commands/",
            "api:http:GET:/applications/:application_id/guilds/:guild_id/commands/:command_id/",
            "api:http:PATCH:/applications/:application_id/guilds/:guild_id/commands/:command_id/",
            "api:http:DELETE:/applications/:application_id/guilds/:guild_id/commands/:command_id/",
            "api:http:GET:/applications/:application_id/entitlements/",
            "api:http:GET:/applications/:application_id/skus/",
            "api:http:GET:/applications/@me/",
            "api:http:PATCH:/applications/@me/",
            "api:http:GET:/applications/detectable/",
            "api:http:GET:/guilds/:guild_id/application-command-index/",
            "api:http:POST:/interactions/",
            "api:http:POST:/interactions/:interaction_id/:interaction_token/callback/",
        ]);

        const database = await createDisposablePostgresDatabase({ prefix: "spacebar_applications_commands" });
        const tempCwd = await mkdtemp(path.join(tmpdir(), "spacebar-applications-commands-"));
        const previous = snapshotProcessState();
        let api: Awaited<ReturnType<typeof startApi>> | undefined;
        let eventCapture: Awaited<ReturnType<typeof captureEvents>> | undefined;
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
                }),
            );
            await Config.init(true);
            restoreFetch = installApplicationsFetchStub();

            await initDatabase();
            api = await startApi();

            const suffix = `${process.pid}${Date.now()}`;
            const owner = await User.register({
                username: `appowner${suffix.slice(-8)}`,
                email: `app-owner-${suffix}@example.com`,
                password: "not-a-real-login-hash",
            });
            const ownerToken = await generateToken(owner.id);
            assert.ok(ownerToken, "owner token generation should return a bearer token");

            const intruder = await User.register({
                username: `appintruder${suffix.slice(-8)}`,
                email: `app-intruder-${suffix}@example.com`,
                password: "not-a-real-login-hash",
            });
            const intruderToken = await generateToken(intruder.id);
            assert.ok(intruderToken, "intruder token generation should return a bearer token");

            const createdGuild = await postJson(`${api.apiBaseUrl}/guilds`, { name: `apps-${suffix.slice(-8)}` }, ownerToken);
            await assertStatus(createdGuild, 201);
            const guildId = (await assertJsonObject(createdGuild)).id as string;
            const channels = await getJsonArray(`${api.apiBaseUrl}/guilds/${guildId}/channels`, ownerToken);
            assert.equal(channels.length, 1);
            const channelId = channels[0].id as string;

            const createdApplication = await postJson(`${api.apiBaseUrl}/applications`, { name: " Scenario App " }, ownerToken);
            await assertStatus(createdApplication, 200);
            const createdApplicationBody = await assertJsonObject(createdApplication);
            const applicationId = createdApplicationBody.id as string;
            assert.equal(createdApplicationBody.name, "Scenario App");
            const persistedApplication = await Application.findOneOrFail({
                where: { id: applicationId },
                relations: { owner: true, bot: true },
            });
            assert.equal(persistedApplication.owner.id, owner.id);
            assert.equal(persistedApplication.bot, null);

            const listedApplications = await getJsonArray(`${api.apiBaseUrl}/applications`, ownerToken);
            assert.deepEqual(
                listedApplications.map((application) => application.id),
                [applicationId],
            );

            const intruderGet = await getJson(`${api.apiBaseUrl}/applications/${applicationId}`, intruderToken);
            await assertStatus(intruderGet, 400);
            assert.equal((await assertJsonObject(intruderGet)).code, 20012);
            const fetchedApplication = await getJson(`${api.apiBaseUrl}/applications/${applicationId}`, ownerToken);
            await assertStatus(fetchedApplication, 200);
            assert.equal((await assertJsonObject(fetchedApplication)).id, applicationId);

            const patchedApplication = await patchJson(
                `${api.apiBaseUrl}/applications/${applicationId}`,
                {
                    name: "scenario-app-updated",
                    description: "Application scenario description",
                    bot_public: false,
                    guild_id: guildId,
                },
                ownerToken,
            );
            await assertStatus(patchedApplication, 200);
            const patchedApplicationBody = await assertJsonObject(patchedApplication);
            assert.equal(patchedApplicationBody.name, "scenario-app-updated");
            assert.equal(patchedApplicationBody.guild_id, guildId);
            assert.equal((await Application.findOneByOrFail({ id: applicationId })).bot_public, false);

            const createdBot = await postJson(`${api.apiBaseUrl}/applications/${applicationId}/bot`, {}, ownerToken);
            await assertStatus(createdBot, 200);
            const createdBotBody = await assertJsonObject(createdBot);
            const botToken = createdBotBody.token as string;
            assert.ok(botToken);
            assert.ok(await User.findOneBy({ id: applicationId, bot: true }));

            await Member.addToGuild(applicationId, guildId);
            assert.ok(await Member.findOneBy({ id: applicationId, guild_id: guildId }));

            const patchedBot = await patchJson(`${api.apiBaseUrl}/applications/${applicationId}/bot`, { username: "ScenarioBot" }, ownerToken);
            await assertStatus(patchedBot, 200);
            assert.equal((await User.findOneByOrFail({ id: applicationId })).username, "ScenarioBot");

            const resetBot = await postJson(`${api.apiBaseUrl}/applications/${applicationId}/bot/reset`, {}, ownerToken);
            await assertStatus(resetBot, 200);
            const resetBotBody = await assertJsonObject(resetBot);
            assert.ok(resetBotBody.token);

            const meApplication = await getJson(`${api.apiBaseUrl}/applications/@me`, botToken);
            await assertStatus(meApplication, 200);
            assert.equal((await assertJsonObject(meApplication)).id, applicationId);

            const patchedMeApplication = await patchJson(`${api.apiBaseUrl}/applications/@me`, { description: "Bot self-managed description" }, botToken);
            await assertStatus(patchedMeApplication, 200);
            assert.equal((await Application.findOneByOrFail({ id: applicationId })).description, "Bot self-managed description");

            assert.deepEqual(await getJsonArray(`${api.apiBaseUrl}/applications/${applicationId}/skus`, ownerToken), []);
            assert.deepEqual(await getJsonArray(`${api.apiBaseUrl}/applications/${applicationId}/entitlements`, ownerToken), []);

            const detectable = await getJson(`${api.apiBaseUrl}/applications/detectable`, ownerToken);
            await assertStatus(detectable, 200);
            assert.deepEqual(await detectable.json(), { scenario: true, games: [] });

            const globalCreate = await postJson(`${api.apiBaseUrl}/applications/${applicationId}/commands`, commandBody("scenario-global", "Global scenario command"), ownerToken);
            await assertStatus(globalCreate, 200);
            const globalCreateBody = await assertJsonObject(globalCreate);
            const globalCommand = await ApplicationCommand.findOneByOrFail({ application_id: applicationId, guild_id: undefined, name: "scenario-global" });
            assert.equal(globalCreateBody.id, globalCommand.id);
            assert.equal(globalCreateBody.version, globalCommand.version);
            assert.equal(globalCommand.description, "Global scenario command");

            const globalGet = await getJson(`${api.apiBaseUrl}/applications/${applicationId}/commands/${globalCommand.id}`, ownerToken);
            await assertStatus(globalGet, 200);
            assert.equal((await assertJsonObject(globalGet)).id, globalCommand.id);

            const globalPatch = await patchJson(
                `${api.apiBaseUrl}/applications/${applicationId}/commands/${globalCommand.id}`,
                commandBody("scenario-global-updated", "Updated global command"),
                ownerToken,
            );
            await assertStatus(globalPatch, 200);
            const globalPatchBody = await assertJsonObject(globalPatch);
            assert.equal(globalPatchBody.id, globalCommand.id);
            assert.equal(globalPatchBody.name, "scenario-global-updated");
            assert.equal((await ApplicationCommand.findOneByOrFail({ id: globalCommand.id })).name, "scenario-global-updated");

            const globalBulk = await putJson(
                `${api.apiBaseUrl}/applications/${applicationId}/commands`,
                [commandBody("scenario-global-updated", "Updated global command"), commandBody("scenario-global-bulk", "Bulk global command")],
                ownerToken,
            );
            await assertStatus(globalBulk, 200);
            const globalBulkBody = await assertJsonArray(globalBulk);
            assert.deepEqual(globalBulkBody.map((command) => command.name).sort(), ["scenario-global-bulk", "scenario-global-updated"]);
            assert.ok(globalBulkBody.every((command) => typeof command.id === "string" && typeof command.version === "string"));
            const globalCommands = await ApplicationCommand.findBy({ application_id: applicationId, guild_id: undefined });
            assert.deepEqual(globalCommands.map((command) => command.name).sort(), ["scenario-global-bulk", "scenario-global-updated"]);

            const guildCreate = await postJson(
                `${api.apiBaseUrl}/applications/${applicationId}/guilds/${guildId}/commands`,
                commandBody("scenario-guild", "Guild scenario command"),
                ownerToken,
            );
            await assertStatus(guildCreate, 200);
            const guildCreateBody = await assertJsonObject(guildCreate);
            const guildCommand = await ApplicationCommand.findOneByOrFail({ application_id: applicationId, guild_id: guildId, name: "scenario-guild" });
            assert.equal(guildCreateBody.id, guildCommand.id);
            assert.equal(guildCreateBody.version, guildCommand.version);
            assert.equal(guildCommand.description, "Guild scenario command");

            const guildCommandsList = await getJsonArray(`${api.apiBaseUrl}/applications/${applicationId}/guilds/${guildId}/commands`, ownerToken);
            assert.deepEqual(
                guildCommandsList.map((command) => command.id),
                [guildCommand.id],
            );

            const guildGet = await getJson(`${api.apiBaseUrl}/applications/${applicationId}/guilds/${guildId}/commands/${guildCommand.id}`, ownerToken);
            await assertStatus(guildGet, 200);
            assert.equal((await assertJsonObject(guildGet)).id, guildCommand.id);

            const guildPatch = await patchJson(
                `${api.apiBaseUrl}/applications/${applicationId}/guilds/${guildId}/commands/${guildCommand.id}`,
                commandBody("scenario-guild-updated", "Updated guild command"),
                ownerToken,
            );
            await assertStatus(guildPatch, 200);
            const guildPatchBody = await assertJsonObject(guildPatch);
            assert.equal(guildPatchBody.id, guildCommand.id);
            assert.equal(guildPatchBody.name, "scenario-guild-updated");
            assert.equal((await ApplicationCommand.findOneByOrFail({ id: guildCommand.id })).name, "scenario-guild-updated");

            const guildBulk = await putJson(
                `${api.apiBaseUrl}/applications/${applicationId}/guilds/${guildId}/commands`,
                [commandBody("scenario-guild-updated", "Updated guild command"), commandBody("scenario-guild-bulk", "Bulk guild command")],
                ownerToken,
            );
            await assertStatus(guildBulk, 200);
            const guildBulkBody = await assertJsonArray(guildBulk);
            assert.deepEqual(guildBulkBody.map((command) => command.name).sort(), ["scenario-guild-bulk", "scenario-guild-updated"]);
            assert.ok(guildBulkBody.every((command) => typeof command.id === "string" && typeof command.version === "string"));
            const guildCommands = await ApplicationCommand.findBy({ application_id: applicationId, guild_id: guildId });
            assert.deepEqual(guildCommands.map((command) => command.name).sort(), ["scenario-guild-bulk", "scenario-guild-updated"]);

            const commandIndex = await getJson(`${api.apiBaseUrl}/guilds/${guildId}/application-command-index`, ownerToken);
            await assertStatus(commandIndex, 200);
            const commandIndexBody = await assertJsonObject(commandIndex);
            const indexedApplications = commandIndexBody.applications as Array<Record<string, unknown>>;
            assert.equal(indexedApplications.length, 1);
            assert.equal(indexedApplications[0].id, applicationId);
            assert.equal(indexedApplications[0].bot_id, applicationId);
            const indexedCommands = commandIndexBody.application_commands as Array<Record<string, unknown>>;
            assert.deepEqual(indexedCommands.map((command) => command.name).sort(), [
                "scenario-global-bulk",
                "scenario-global-updated",
                "scenario-guild-bulk",
                "scenario-guild-updated",
            ]);

            eventCapture = await captureEvents([owner.id, applicationId, channelId]);
            const interaction = await postJson(
                `${api.apiBaseUrl}/interactions`,
                {
                    type: 2,
                    application_id: applicationId,
                    guild_id: guildId,
                    channel_id: channelId,
                    nonce: `interaction-${suffix}`,
                    data: {
                        id: guildCommand.id,
                        name: "scenario-guild-updated",
                        type: 1,
                        version: guildCommand.version,
                    },
                },
                ownerToken,
            );
            await assertStatus(interaction, 204);
            const userInteractionEvent = await waitForLabeledEvent(
                eventCapture,
                (event) => event.event === "INTERACTION_CREATE" && event.user_id === owner.id && event.data.nonce === `interaction-${suffix}`,
                "user INTERACTION_CREATE",
            );
            assert.equal(pendingInteractions.get(userInteractionEvent.data.id as string)?.applicationId, applicationId);
            const applicationInteractionEvent = await waitForLabeledEvent(
                eventCapture,
                (event) => event.event === "INTERACTION_CREATE" && event.user_id === applicationId,
                "application INTERACTION_CREATE",
            );
            assert.equal(applicationInteractionEvent.data.application_id, applicationId);
            assert.equal(Object.hasOwn(applicationInteractionEvent.data, "member_id"), false);
            assert.equal(applicationInteractionEvent.data.member.id, owner.id);
            assert.equal(applicationInteractionEvent.data.member.guild_id, guildId);
            assert.equal(applicationInteractionEvent.data.member.user.id, owner.id);
            const interactionId = applicationInteractionEvent.data.id as string;
            const interactionToken = applicationInteractionEvent.data.token as string;
            assert.ok(interactionToken);
            assert.equal(userInteractionEvent.data.id, interactionId);

            const callback = await postPublicJson(`${api.apiBaseUrl}/interactions/${interactionId}/${interactionToken}/callback`, {
                type: 4,
                data: {
                    content: "interaction callback response",
                },
            });
            await assertStatus(callback, 204);
            assert.ok(
                await waitForLabeledEvent(
                    eventCapture,
                    (event) =>
                        event.event === "INTERACTION_SUCCESS" && event.user_id === owner.id && event.data.id === interactionId && event.data.nonce === `interaction-${suffix}`,
                    "INTERACTION_SUCCESS",
                ),
            );
            const interactionMessageEvent = await waitForLabeledEvent(
                eventCapture,
                (event) =>
                    event.event === "MESSAGE_CREATE" &&
                    event.channel_id === channelId &&
                    (event.data.application_id === applicationId || event.data.application?.id === applicationId),
                "interaction MESSAGE_CREATE",
            );
            assert.equal(interactionMessageEvent.data.content, "interaction callback response");
            assert.ok(await Message.findOneBy({ id: interactionMessageEvent.data.id as string, application_id: applicationId }));

            const globalBulkCommand = await ApplicationCommand.findOneByOrFail({ application_id: applicationId, guild_id: undefined, name: "scenario-global-bulk" });
            await assertStatus(await deleteJson(`${api.apiBaseUrl}/applications/${applicationId}/commands/${globalBulkCommand.id}`, ownerToken), 204);
            assert.equal(await ApplicationCommand.findOneBy({ id: globalBulkCommand.id }), null);

            const guildBulkCommand = await ApplicationCommand.findOneByOrFail({ application_id: applicationId, guild_id: guildId, name: "scenario-guild-bulk" });
            await assertStatus(await deleteJson(`${api.apiBaseUrl}/applications/${applicationId}/guilds/${guildId}/commands/${guildBulkCommand.id}`, ownerToken), 204);
            assert.equal(await ApplicationCommand.findOneBy({ id: guildBulkCommand.id }), null);

            await assertStatus(await postJson(`${api.apiBaseUrl}/applications/${applicationId}/delete`, {}, ownerToken), 200);
            assert.equal(await Application.findOneBy({ id: applicationId }), null);
            assert.equal(await User.findOneBy({ id: applicationId }), null);
        } finally {
            if (eventCapture) await eventCapture.stop();
            if (api) await api.stop();
            restoreFetch?.();
            await closeDatabase();
            await database.close();
            restoreProcessState(previous);
            await rm(tempCwd, { recursive: true, force: true });
        }
    },
);

function commandBody(name: string, description: string) {
    return {
        name,
        description,
        type: 1,
    };
}

async function getJson(url: string, token: string) {
    return await fetch(url, {
        headers: {
            authorization: `Bearer ${token}`,
        },
    });
}

async function waitForLabeledEvent(capture: Awaited<ReturnType<typeof captureEvents>>, predicate: Parameters<typeof capture.waitFor>[0], label: string) {
    try {
        return await capture.waitFor(predicate, 1000);
    } catch (error) {
        throw new Error(`Timed out waiting for ${label}`, { cause: error });
    }
}

async function getJsonArray(url: string, token: string) {
    const response = await getJson(url, token);
    await assertStatus(response, 200);
    const body = await response.json();
    assert.ok(Array.isArray(body));
    return body as Array<Record<string, unknown>>;
}

async function assertJsonArray(response: Response) {
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

async function postPublicJson(url: string, body: unknown) {
    return await fetch(url, {
        method: "POST",
        headers: {
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

function installApplicationsFetchStub() {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

        if (url === "https://discord.com/api/v10/games/detectable") {
            return Response.json({ scenario: true, games: [] });
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
