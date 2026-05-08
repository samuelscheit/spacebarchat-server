import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { Channel, closeDatabase, Config, generateToken, Guild, initDatabase, Member, Role, User } from "@spacebar/util";
import { assertJsonError, assertJsonObject, assertStatus } from "../assertions/http";
import { createDisposablePostgresDatabase, hasPostgresAdminUrl } from "../fixtures/database";
import { captureEvents } from "../fixtures/events";
import { startApi } from "../server/startApi";

const coveredManifestIds = ["api:http:POST:/guilds/", "api:http:GET:/guilds/:guild_id/", "api:http:PATCH:/guilds/:guild_id/", "api:http:POST:/guilds/:guild_id/delete/"];

test(
    "guild create, read, update, and delete persist state and emit guild events",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 180_000,
    },
    async () => {
        assert.deepEqual(coveredManifestIds, [
            "api:http:POST:/guilds/",
            "api:http:GET:/guilds/:guild_id/",
            "api:http:PATCH:/guilds/:guild_id/",
            "api:http:POST:/guilds/:guild_id/delete/",
        ]);

        const database = await createDisposablePostgresDatabase({ prefix: "spacebar_guilds_crud" });
        const tempCwd = await mkdtemp(path.join(tmpdir(), "spacebar-guilds-crud-"));
        const previous = snapshotProcessState();
        let api: Awaited<ReturnType<typeof startApi>> | undefined;
        let ownerEvents: Awaited<ReturnType<typeof captureEvents>> | undefined;
        let guildEvents: Awaited<ReturnType<typeof captureEvents>> | undefined;

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
                username: `guildowner${suffix.slice(-8)}`,
                email: `guild-owner-${suffix}@example.com`,
                password: "not-a-real-login-hash",
            });
            const token = await generateToken(owner.id);
            assert.ok(token, "token generation should return a bearer token");
            ownerEvents = await captureEvents(owner.id);

            const createdName = `scenario-guild-${suffix.slice(-8)}`;
            const createGuild = await postJson(
                `${api.apiBaseUrl}/guilds`,
                {
                    name: createdName,
                },
                token,
            );
            await assertStatus(createGuild, 201);
            const createBody = await assertJsonObject(createGuild);
            assert.equal(typeof createBody.id, "string");
            const guildId = createBody.id as string;
            assert.equal(createBody.name, createdName);
            assert.equal(createBody.owner_id, owner.id);

            const createEvent = await ownerEvents.waitFor((event) => event.event === "GUILD_CREATE" && event.user_id === owner.id && event.data.id === guildId);
            assert.equal(createEvent.data.properties.name, createdName);
            assert.equal(createEvent.data.properties.owner_id, owner.id);
            assert.equal(createEvent.data.member_count, 1);

            const persistedCreatedGuild = await Guild.findOneByOrFail({ id: guildId });
            assert.equal(persistedCreatedGuild.name, createdName);
            assert.equal(persistedCreatedGuild.owner_id, owner.id);
            assert.equal(persistedCreatedGuild.member_count, 1);
            assert.notEqual(await Member.findOneBy({ guild_id: guildId, id: owner.id }), null);
            const everyoneRole = await Role.findOneByOrFail({ id: guildId, guild_id: guildId });
            assert.equal(everyoneRole.name, "@everyone");
            assert.equal(everyoneRole.permissions, "2251804225");
            assert.equal(await Channel.countBy({ guild_id: guildId }), 1);
            const generalChannel = await Channel.findOneByOrFail({ guild_id: guildId, name: "general" });
            assert.equal(generalChannel.type, 0);

            const getGuild = await getJson(`${api.apiBaseUrl}/guilds/${guildId}`, token);
            await assertStatus(getGuild, 200);
            const getBody = await assertJsonObject(getGuild);
            assert.equal(getBody.id, guildId);
            assert.equal(getBody.name, createdName);
            assert.equal(getBody.owner_id, owner.id);
            assert.equal(getBody.member_count, 1);
            assert.equal(typeof getBody.joined_at, "string");

            guildEvents = await captureEvents(guildId);
            const updatedName = `${createdName}-renamed`;
            const updatedDescription = "updated by guild CRUD scenario";
            const updateGuild = await patchJson(
                `${api.apiBaseUrl}/guilds/${guildId}`,
                {
                    name: updatedName,
                    description: updatedDescription,
                    profile_tag: "sb",
                },
                token,
            );
            await assertStatus(updateGuild, 200);
            const updateBody = await assertJsonObject(updateGuild);
            assert.equal(updateBody.id, guildId);
            assert.equal(updateBody.name, updatedName);
            assert.equal(updateBody.description, updatedDescription);
            assert.equal(updateBody.profile_tag, "SB");
            const updateEvent = await guildEvents.waitFor((event) => event.event === "GUILD_UPDATE" && event.guild_id === guildId);
            assert.equal(updateEvent.data.id, guildId);
            assert.equal(updateEvent.data.name, updatedName);
            assert.equal(updateEvent.data.description, updatedDescription);
            assert.equal(updateEvent.data.profile_tag, "SB");
            const persistedUpdatedGuild = await Guild.findOneByOrFail({ id: guildId });
            assert.equal(persistedUpdatedGuild.name, updatedName);
            assert.equal(persistedUpdatedGuild.description, updatedDescription);
            assert.equal(persistedUpdatedGuild.profile_tag, "SB");

            const profile = await getJson(`${api.apiBaseUrl}/guilds/${guildId}/profile`, token);
            await assertStatus(profile, 200);
            const profileBody = await assertJsonObject(profile);
            assert.equal(profileBody.id, guildId);
            assert.equal(profileBody.tag, "SB");

            const deleteGuild = await postJson(`${api.apiBaseUrl}/guilds/${guildId}/delete`, {}, token);
            await assertStatus(deleteGuild, 204);
            const deleteEvent = await guildEvents.waitFor((event) => event.event === "GUILD_DELETE" && event.guild_id === guildId);
            assert.deepEqual(deleteEvent.data, { id: guildId });
            assert.equal(await Guild.findOneBy({ id: guildId }), null);
            assert.equal(await Member.countBy({ guild_id: guildId }), 0);
            assert.equal(await Role.countBy({ guild_id: guildId }), 0);
            assert.equal(await Channel.countBy({ guild_id: guildId }), 0);
            await assertJsonError(await getJson(`${api.apiBaseUrl}/guilds/${guildId}`, token), 404);
        } finally {
            if (guildEvents) await guildEvents.stop();
            if (ownerEvents) await ownerEvents.stop();
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
