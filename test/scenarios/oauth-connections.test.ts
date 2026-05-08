import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import type { ConnectedAccountCommonOAuthTokenResponse, ConnectionCallbackSchema } from "@spacebar/schemas";
import {
    closeDatabase,
    Config,
    ConnectedAccount,
    ConnectionConfig,
    ConnectionStore,
    DiscordApiErrors,
    generateToken,
    initDatabase,
    Member,
    RefreshableConnection,
    Role,
    User,
} from "@spacebar/util";
import { assertJsonError, assertJsonObject, assertStatus } from "../assertions/http";
import { createDisposablePostgresDatabase, hasPostgresAdminUrl } from "../fixtures/database";
import { captureEvents } from "../fixtures/events";
import { startApi } from "../server/startApi";

const coveredManifestIds = [
    "api:http:GET:/oauth2/applications/@me/",
    "api:http:GET:/oauth2/authorize/",
    "api:http:POST:/oauth2/authorize/",
    "api:http:GET:/oauth2/tokens/",
    "api:http:GET:/connections/",
    "api:http:GET:/connections/:connection_name/authorize/",
    "api:http:POST:/connections/:connection_name/callback/",
    "api:http:POST:/connections/:connection_name/:connection_id/refresh/",
    "api:http:GET:/users/@me/connections/",
    "api:http:PATCH:/users/@me/connections/:connection_name/:connection_id/",
    "api:http:GET:/users/@me/connections/:connection_name/:connection_id/access-token/",
    "api:http:DELETE:/users/@me/connections/:connection_name/:connection_id/",
];

test(
    "oauth authorization and connected accounts persist state and redact provider secrets",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 180_000,
    },
    async () => {
        assert.deepEqual(coveredManifestIds, [
            "api:http:GET:/oauth2/applications/@me/",
            "api:http:GET:/oauth2/authorize/",
            "api:http:POST:/oauth2/authorize/",
            "api:http:GET:/oauth2/tokens/",
            "api:http:GET:/connections/",
            "api:http:GET:/connections/:connection_name/authorize/",
            "api:http:POST:/connections/:connection_name/callback/",
            "api:http:POST:/connections/:connection_name/:connection_id/refresh/",
            "api:http:GET:/users/@me/connections/",
            "api:http:PATCH:/users/@me/connections/:connection_name/:connection_id/",
            "api:http:GET:/users/@me/connections/:connection_name/:connection_id/access-token/",
            "api:http:DELETE:/users/@me/connections/:connection_name/:connection_id/",
        ]);

        const database = await createDisposablePostgresDatabase({ prefix: "spacebar_oauth_connections" });
        const tempCwd = await mkdtemp(path.join(tmpdir(), "spacebar-oauth-connections-"));
        const previous = snapshotProcessState();
        let api: Awaited<ReturnType<typeof startApi>> | undefined;
        let eventCapture: Awaited<ReturnType<typeof captureEvents>> | undefined;
        let restoreConnections: (() => void) | undefined;

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
                    general: {
                        serverName: "localhost",
                        frontPage: "https://front.example",
                        autoCreateBotUsers: false,
                    },
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
            await ConnectionConfig.init();

            const scenarioConnection = new ScenarioYoutubeConnection();
            restoreConnections = installScenarioConnection(scenarioConnection);

            api = await startApi();

            const suffix = `${process.pid}${Date.now()}`;
            const owner = await User.register({
                username: `oauthowner${suffix.slice(-8)}`,
                email: `oauth-owner-${suffix}@example.com`,
                password: "not-a-real-login-hash",
            });
            const ownerToken = await generateToken(owner.id);
            assert.ok(ownerToken, "owner token generation should return a bearer token");

            const createdGuild = await postJson(`${api.apiBaseUrl}/guilds`, { name: `oauth-${suffix.slice(-8)}` }, ownerToken);
            await assertStatus(createdGuild, 201);
            const guildId = (await assertJsonObject(createdGuild)).id as string;

            const missingClientId = "999999999999999999";
            await assertApiError(await getJson(`${api.apiBaseUrl}/oauth2/authorize?client_id=${missingClientId}`, ownerToken), 404, DiscordApiErrors.UNKNOWN_APPLICATION);
            await assertApiError(
                await postJson(
                    `${api.apiBaseUrl}/oauth2/authorize?client_id=${missingClientId}`,
                    {
                        authorize: true,
                        guild_id: guildId,
                        permissions: "8",
                    },
                    ownerToken,
                ),
                404,
                DiscordApiErrors.UNKNOWN_APPLICATION,
            );

            const createdBotlessApplication = await postJson(`${api.apiBaseUrl}/applications`, { name: "OAuth Botless Scenario App" }, ownerToken);
            await assertStatus(createdBotlessApplication, 200);
            const botlessApplicationId = (await assertJsonObject(createdBotlessApplication)).id as string;
            await assertApiError(
                await getJson(`${api.apiBaseUrl}/oauth2/authorize?client_id=${botlessApplicationId}`, ownerToken),
                400,
                DiscordApiErrors.OAUTH2_APPLICATION_BOT_ABSENT,
            );
            await assertApiError(
                await postJson(
                    `${api.apiBaseUrl}/oauth2/authorize?client_id=${botlessApplicationId}`,
                    {
                        authorize: true,
                        guild_id: guildId,
                        permissions: "8",
                    },
                    ownerToken,
                ),
                400,
                DiscordApiErrors.OAUTH2_APPLICATION_BOT_ABSENT,
            );

            const createdApplication = await postJson(`${api.apiBaseUrl}/applications`, { name: "OAuth Scenario App" }, ownerToken);
            await assertStatus(createdApplication, 200);
            const applicationId = (await assertJsonObject(createdApplication)).id as string;
            const createdBot = await postJson(`${api.apiBaseUrl}/applications/${applicationId}/bot`, {}, ownerToken);
            await assertStatus(createdBot, 200);
            const botToken = (await assertJsonObject(createdBot)).token as string;
            assert.ok(botToken);

            const oauthApplication = await getJson(`${api.apiBaseUrl}/oauth2/applications/@me`, botToken);
            await assertStatus(oauthApplication, 200);
            const oauthApplicationBody = await assertJsonObject(oauthApplication);
            assert.equal(oauthApplicationBody.id, applicationId);
            assert.equal((oauthApplicationBody.owner as Record<string, unknown>).id, owner.id);

            const authorizeInfo = await getJson(`${api.apiBaseUrl}/oauth2/authorize?client_id=${applicationId}`, ownerToken);
            await assertStatus(authorizeInfo, 200);
            const authorizeInfoBody = await assertJsonObject(authorizeInfo);
            assert.equal((authorizeInfoBody.application as Record<string, unknown>).id, applicationId);
            assert.equal((authorizeInfoBody.bot as Record<string, unknown>).id, applicationId);
            assert.deepEqual(
                (authorizeInfoBody.guilds as Array<Record<string, unknown>>).map((guild) => guild.id),
                [guildId],
            );

            const oauthAuthorize = await postJson(
                `${api.apiBaseUrl}/oauth2/authorize?client_id=${applicationId}`,
                {
                    authorize: true,
                    guild_id: guildId,
                    permissions: "8",
                },
                ownerToken,
            );
            await assertStatus(oauthAuthorize, 200);
            assert.equal((await assertJsonObject(oauthAuthorize)).location, "/oauth2/authorized");

            const botMember = await Member.findOneOrFail({ where: { id: applicationId, guild_id: guildId }, relations: { roles: true } });
            const managedBotRole = await Role.findOneByOrFail({ guild_id: guildId, managed: true, name: "OAuth Scenario App" });
            assert.equal(managedBotRole.permissions, "8");
            assert.equal(managedBotRole.tags?.bot_id, applicationId);
            assert.ok(botMember.roles.some((role) => role.id === managedBotRole.id));
            const ownerMember = await Member.findOneOrFail({ where: { id: owner.id, guild_id: guildId }, relations: { roles: true } });
            assert.equal(
                ownerMember.roles.some((role) => role.id === managedBotRole.id),
                false,
            );

            const oauthTokens = await getJson(`${api.apiBaseUrl}/oauth2/tokens`, ownerToken);
            await assertStatus(oauthTokens, 200);
            assert.deepEqual(await oauthTokens.json(), []);

            const connectionConfig = ConnectionConfig.get() as ScenarioConnectionConfig;
            assert.equal(connectionConfig.youtube.clientSecret, "scenario-secret");
            const publicConnections = await getJson(`${api.apiBaseUrl}/connections`, ownerToken);
            await assertStatus(publicConnections, 200);
            const publicConnectionsBody = await assertJsonObject(publicConnections);
            assert.equal((publicConnectionsBody.youtube as Record<string, unknown>).enabled, true);
            assert.equal((publicConnectionsBody.youtube as Record<string, unknown>).clientId, undefined);
            assert.equal((publicConnectionsBody.youtube as Record<string, unknown>).clientSecret, undefined);
            assert.equal(connectionConfig.youtube.clientSecret, "scenario-secret");

            eventCapture = await captureEvents(owner.id);
            const connectionAuthorize = await getJson(`${api.apiBaseUrl}/connections/youtube/authorize`, ownerToken);
            await assertStatus(connectionAuthorize, 200);
            const connectionAuthorizeBody = await assertJsonObject(connectionAuthorize);
            const oauthState = new URL(connectionAuthorizeBody.url as string).searchParams.get("state");
            assert.ok(oauthState);
            assert.equal(scenarioConnection.getUserId(oauthState), owner.id);

            const callback = await postPublicJson(`${api.apiBaseUrl}/connections/youtube/callback`, {
                code: "scenario-external",
                state: oauthState,
                friend_sync: true,
            });
            await assertStatus(callback, 204);
            assert.ok(await eventCapture.waitFor((event) => event.event === "USER_CONNECTIONS_UPDATE" && event.user_id === owner.id && event.data.id === "scenario-external"));
            const connectedAccount = await ConnectedAccount.findOneOrFail({
                where: {
                    user_id: owner.id,
                    type: "youtube",
                    external_id: "scenario-external",
                },
                select: {
                    friend_sync: true,
                    token_data: true,
                },
            });
            assert.equal(connectedAccount.friend_sync, true);
            assert.equal(connectedAccount.token_data?.access_token, "callback-token");

            const listedConnections = await getJsonArray(`${api.apiBaseUrl}/users/@me/connections`, ownerToken);
            assert.equal(listedConnections.length, 1);
            assert.equal(listedConnections[0].id, "scenario-external");
            assert.equal(listedConnections[0].access_token, "callback-token");

            const patchedConnection = await patchJson(
                `${api.apiBaseUrl}/users/@me/connections/youtube/scenario-external`,
                {
                    visibility: true,
                    show_activity: true,
                    metadata_visibility: false,
                },
                ownerToken,
            );
            await assertStatus(patchedConnection, 200);
            const patchedConnectionBody = await assertJsonObject(patchedConnection);
            assert.equal(patchedConnectionBody.visibility, 1);
            assert.equal(patchedConnectionBody.show_activity, 1);
            assert.equal(
                (
                    await ConnectedAccount.findOneOrFail({
                        where: { user_id: owner.id, type: "youtube", external_id: "scenario-external" },
                        select: { visibility: true },
                    })
                ).visibility,
                1,
            );
            await ConnectedAccount.update(
                { user_id: owner.id, type: "youtube", external_id: "scenario-external" },
                {
                    token_data: {
                        access_token: "expired-token",
                        token_type: "Bearer",
                        scope: "identify",
                        refresh_token: "refresh-token",
                        expires_at: 1,
                        expires_in: 1,
                        fetched_at: Date.now() - 2000,
                    },
                },
            );
            const expiredConnection = await ConnectedAccount.findOne({
                where: { user_id: owner.id, type: "youtube", external_id: "scenario-external" },
                select: { token_data: true },
            });
            assert.equal(expiredConnection?.token_data?.access_token, "expired-token");
            assert.equal(expiredConnection?.token_data?.expires_at, 1);

            const accessToken = await getJson(`${api.apiBaseUrl}/users/@me/connections/youtube/scenario-external/access-token`, ownerToken);
            await assertStatus(accessToken, 200);
            assert.equal((await assertJsonObject(accessToken)).access_token, "refreshed-token");
            assert.equal(
                (
                    await ConnectedAccount.findOne({
                        where: { user_id: owner.id, type: "youtube", external_id: "scenario-external" },
                        select: { token_data: true },
                    })
                )?.token_data?.access_token,
                "refreshed-token",
            );

            await assertStatus(await postJson(`${api.apiBaseUrl}/connections/youtube/scenario-external/refresh`, {}, ownerToken), 204);

            await eventCapture.stop();
            eventCapture = await captureEvents(owner.id);
            await assertStatus(await deleteJson(`${api.apiBaseUrl}/users/@me/connections/youtube/scenario-external`, ownerToken), 200);
            assert.ok(await eventCapture.waitFor((event) => event.event === "USER_CONNECTIONS_UPDATE" && event.user_id === owner.id && event.data.id === "scenario-external"));
            assert.equal(await ConnectedAccount.findOneBy({ user_id: owner.id, type: "youtube", external_id: "scenario-external" }), null);
        } finally {
            if (eventCapture) await eventCapture.stop();
            if (api) await api.stop();
            restoreConnections?.();
            await closeDatabase();
            await database.close();
            restoreProcessState(previous);
            await rm(tempCwd, { recursive: true, force: true });
        }
    },
);

class ScenarioYoutubeConnection extends RefreshableConnection {
    id = "youtube";
    settings = { enabled: true };
    friendlyName = "Scenario YouTube";
    setupUrl = "https://connections.example/setup";
    requiredScopes = ["identify"];

    init(): void {
        // no-op for scenario connection
    }

    get isConfigured(): boolean {
        return true;
    }

    getAuthorizationUrl(userId: string): string {
        const state = this.createState(userId, { scenario: true });
        return `https://connections.example/youtube/authorize?state=${state}`;
    }

    async handleCallback(params: ConnectionCallbackSchema) {
        const state = this.consumeState(params.state);
        return await this.createConnection({
            external_id: params.code,
            user_id: state.userId,
            token_data: {
                access_token: "callback-token",
                token_type: "Bearer",
                scope: "identify",
                refresh_token: "refresh-token",
                expires_at: Date.now() - 1000,
                fetched_at: Date.now() - 2000,
            },
            friend_sync: params.friend_sync ?? false,
            name: "Scenario External Account",
            revoked: false,
            show_activity: 0,
            type: this.id,
            verified: true,
            visibility: 0,
            integrations: [],
            metadata_: { scenario: "connected" },
            metadata_visibility: 0,
            two_way_link: false,
        });
    }

    async refreshToken(): Promise<ConnectedAccountCommonOAuthTokenResponse> {
        return {
            access_token: "refreshed-token",
            token_type: "Bearer",
            scope: "identify",
            refresh_token: "refresh-token",
            expires_in: 3600,
        };
    }
}

type ScenarioConnectionConfig = Record<
    string,
    {
        enabled?: boolean;
        clientId?: string;
        clientSecret?: string;
        scopes?: string[];
    }
>;

function installScenarioConnection(connection: ScenarioYoutubeConnection) {
    const hadConnection = ConnectionStore.connections.has(connection.id);
    const previousConnection = ConnectionStore.connections.get(connection.id);
    ConnectionStore.connections.set(connection.id, connection);

    const config = ConnectionConfig.get() as ScenarioConnectionConfig;
    const hadConfig = Object.hasOwn(config, connection.id);
    const previousConfig = hadConfig ? { ...config[connection.id] } : undefined;
    config[connection.id] = {
        enabled: true,
        clientId: "scenario-client",
        clientSecret: "scenario-secret",
        scopes: ["identify"],
    };

    return () => {
        if (hadConnection && previousConnection) {
            ConnectionStore.connections.set(connection.id, previousConnection);
        } else {
            ConnectionStore.connections.delete(connection.id);
        }

        if (hadConfig && previousConfig) {
            config[connection.id] = previousConfig;
        } else {
            delete config[connection.id];
        }
    };
}

async function assertApiError(response: Response, expectedStatus: number, expectedError: { code: number; message: string }) {
    const body = await assertJsonError(response, expectedStatus);
    assert.equal(body.code, expectedError.code);
    assert.equal(body.message, expectedError.message);
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

function restoreEnv(key: string, value: string | undefined) {
    if (value === undefined) {
        delete process.env[key];
    } else {
        process.env[key] = value;
    }
}
