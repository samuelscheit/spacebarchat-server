import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { closeDatabase, Config, generateToken, Guild, initDatabase, Member, Role, User } from "@spacebar/util";
import { assertJsonObject, assertStatus } from "../assertions/http";
import { createDisposablePostgresDatabase, hasPostgresAdminUrl } from "../fixtures/database";
import { captureEvents } from "../fixtures/events";
import { startApi } from "../server/startApi";

type EventCapture = Awaited<ReturnType<typeof captureEvents>>;
type CapturedEvent = EventCapture["events"][number];

const coveredManifestIds = [
    "api:http:GET:/guilds/:guild_id/members/",
    "api:http:GET:/guilds/:guild_id/members/:member_id/",
    "api:http:PATCH:/guilds/:guild_id/members/:member_id/",
    "api:http:PUT:/guilds/:guild_id/members/:member_id/",
    "api:http:DELETE:/guilds/:guild_id/members/:member_id/",
    "api:http:PATCH:/guilds/:guild_id/members/:member_id/nick/",
    "api:http:PUT:/guilds/:guild_id/members/:member_id/roles/:role_id/",
    "api:http:DELETE:/guilds/:guild_id/members/:member_id/roles/:role_id/",
    "api:http:GET:/guilds/:guild_id/roles/",
    "api:http:POST:/guilds/:guild_id/roles/",
    "api:http:PATCH:/guilds/:guild_id/roles/",
    "api:http:GET:/guilds/:guild_id/roles/:role_id/",
    "api:http:PATCH:/guilds/:guild_id/roles/:role_id/",
    "api:http:DELETE:/guilds/:guild_id/roles/:role_id/",
    "api:http:GET:/guilds/:guild_id/roles/:role_id/member-ids/",
    "api:http:PATCH:/guilds/:guild_id/roles/:role_id/members/",
    "api:http:GET:/guilds/:guild_id/roles/member-counts/",
];

test(
    "guild member and role routes persist membership state and emit role/member events",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 180_000,
    },
    async () => {
        assert.deepEqual(coveredManifestIds, [
            "api:http:GET:/guilds/:guild_id/members/",
            "api:http:GET:/guilds/:guild_id/members/:member_id/",
            "api:http:PATCH:/guilds/:guild_id/members/:member_id/",
            "api:http:PUT:/guilds/:guild_id/members/:member_id/",
            "api:http:DELETE:/guilds/:guild_id/members/:member_id/",
            "api:http:PATCH:/guilds/:guild_id/members/:member_id/nick/",
            "api:http:PUT:/guilds/:guild_id/members/:member_id/roles/:role_id/",
            "api:http:DELETE:/guilds/:guild_id/members/:member_id/roles/:role_id/",
            "api:http:GET:/guilds/:guild_id/roles/",
            "api:http:POST:/guilds/:guild_id/roles/",
            "api:http:PATCH:/guilds/:guild_id/roles/",
            "api:http:GET:/guilds/:guild_id/roles/:role_id/",
            "api:http:PATCH:/guilds/:guild_id/roles/:role_id/",
            "api:http:DELETE:/guilds/:guild_id/roles/:role_id/",
            "api:http:GET:/guilds/:guild_id/roles/:role_id/member-ids/",
            "api:http:PATCH:/guilds/:guild_id/roles/:role_id/members/",
            "api:http:GET:/guilds/:guild_id/roles/member-counts/",
        ]);

        const database = await createDisposablePostgresDatabase({ prefix: "spacebar_guilds_members_roles" });
        const tempCwd = await mkdtemp(path.join(tmpdir(), "spacebar-guilds-members-roles-"));
        const previous = snapshotProcessState();
        let api: Awaited<ReturnType<typeof startApi>> | undefined;
        let events: Awaited<ReturnType<typeof captureEvents>> | undefined;

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
                username: `roleowner${suffix.slice(-8)}`,
                email: `role-owner-${suffix}@example.com`,
                password: "not-a-real-login-hash",
            });
            const member = await User.register({
                username: `rolemember${suffix.slice(-8)}`,
                email: `role-member-${suffix}@example.com`,
                password: "not-a-real-login-hash",
            });
            const ownerToken = await generateToken(owner.id);
            const memberToken = await generateToken(member.id);
            assert.ok(ownerToken, "owner token generation should return a bearer token");
            assert.ok(memberToken, "member token generation should return a bearer token");

            const createdGuild = await postJson(`${api.apiBaseUrl}/guilds`, { name: `roles-${suffix.slice(-8)}` }, ownerToken);
            await assertStatus(createdGuild, 201);
            const guildId = (await assertJsonObject(createdGuild)).id as string;
            await Guild.update({ id: guildId }, { features: ["DISCOVERABLE"] });
            events = await captureEvents([guildId, member.id]);

            const joinGuild = await putJson(`${api.apiBaseUrl}/guilds/${guildId}/members/@me`, {}, memberToken);
            await assertStatus(joinGuild, 200);
            const joinEvent = await events.waitFor((event) => event.event === "GUILD_MEMBER_ADD" && event.guild_id === guildId && event.data.user.id === member.id);
            assert.equal(joinEvent.data.guild_id, guildId);
            const readyEvent = await events.waitFor((event) => event.event === "GUILD_CREATE" && event.user_id === member.id && event.data.id === guildId);
            assert.equal(readyEvent.data.member_count, 2);
            assert.notEqual(await Member.findOneBy({ guild_id: guildId, id: member.id }), null);
            assert.equal((await Guild.findOneByOrFail({ id: guildId })).member_count, 2);

            const members = await getJsonArray(`${api.apiBaseUrl}/guilds/${guildId}/members?limit=10`, ownerToken);
            assert.deepEqual(members.map((x) => x.id).sort(), [member.id, owner.id].sort());

            const fetchedMember = await getJson(`${api.apiBaseUrl}/guilds/${guildId}/members/${member.id}`, ownerToken);
            await assertStatus(fetchedMember, 200);
            const fetchedMemberBody = await assertJsonObject(fetchedMember);
            assert.equal(fetchedMemberBody.id, member.id);
            assert.equal((fetchedMemberBody.user as Record<string, unknown>).id, member.id);
            assert.deepEqual(fetchedMemberBody.roles, [guildId]);

            const initialRoles = await getJsonArray(`${api.apiBaseUrl}/guilds/${guildId}/roles`, ownerToken);
            assert.deepEqual(
                initialRoles.map((role) => role.id),
                [guildId],
            );
            const everyonePermissions = initialRoles[0].permissions;

            const createRole = await postJson(
                `${api.apiBaseUrl}/guilds/${guildId}/roles`,
                {
                    name: "scenario-role",
                    permissions: "0",
                    color: 3447003,
                    hoist: true,
                    mentionable: true,
                },
                ownerToken,
            );
            await assertStatus(createRole, 200);
            const createRoleBody = await assertJsonObject(createRole);
            const roleId = createRoleBody.id as string;
            assert.equal(createRoleBody.guild_id, guildId);
            assert.equal(createRoleBody.name, "scenario-role");
            assert.equal(createRoleBody.permissions, everyonePermissions);
            const roleCreateEvent = await events.waitFor((event) => event.event === "GUILD_ROLE_CREATE" && event.guild_id === guildId && event.data.role.id === roleId);
            assert.equal(roleCreateEvent.data.role.name, "scenario-role");
            assert.equal((await Role.findOneByOrFail({ guild_id: guildId, id: roleId })).name, "scenario-role");

            const fetchedRole = await getJson(`${api.apiBaseUrl}/guilds/${guildId}/roles/${roleId}`, ownerToken);
            await assertStatus(fetchedRole, 200);
            const fetchedRoleBody = await assertJsonObject(fetchedRole);
            assert.equal(fetchedRoleBody.id, roleId);
            assert.equal(fetchedRoleBody.name, "scenario-role");

            const updateRole = await patchJson(
                `${api.apiBaseUrl}/guilds/${guildId}/roles/${roleId}`,
                {
                    name: "scenario-role-updated",
                    permissions: "0",
                    color: 15158332,
                    hoist: false,
                    mentionable: false,
                },
                ownerToken,
            );
            await assertStatus(updateRole, 200);
            const updateRoleBody = await assertJsonObject(updateRole);
            assert.equal(updateRoleBody.name, "scenario-role-updated");
            assert.equal(updateRoleBody.color, 15158332);
            const roleUpdateEvent = await events.waitFor(
                (event) => event.event === "GUILD_ROLE_UPDATE" && event.guild_id === guildId && event.data.role.id === roleId && event.data.role.name === "scenario-role-updated",
            );
            assert.equal(roleUpdateEvent.data.role.color, 15158332);
            assert.equal((await Role.findOneByOrFail({ guild_id: guildId, id: roleId })).name, "scenario-role-updated");

            const moveRole = await patchJson(`${api.apiBaseUrl}/guilds/${guildId}/roles`, [{ id: roleId, position: 3 }], ownerToken);
            await assertStatus(moveRole, 200);
            const movedRoles = await jsonArray(moveRole);
            assert.equal(movedRoles.length, 1);
            assert.equal(movedRoles[0].id, roleId);
            assert.equal(movedRoles[0].position, 3);
            const roleMoveEvent = await events.waitFor(
                (event) => event.event === "GUILD_ROLE_UPDATE" && event.guild_id === guildId && event.data.role.id === roleId && event.data.role.position === 3,
            );
            assert.equal(roleMoveEvent.data.role.position, 3);

            const managedNick = "managed member";
            const patchMember = await patchJson(`${api.apiBaseUrl}/guilds/${guildId}/members/${member.id}`, { nick: managedNick, roles: [roleId] }, ownerToken);
            await assertStatus(patchMember, 200);
            const patchMemberBody = await assertJsonObject(patchMember);
            assert.equal(patchMemberBody.nick, managedNick);
            const patchMemberRoles = patchMemberBody.roles as Array<{ id: string }>;
            assert.deepEqual(
                patchMemberRoles.map((role) => role.id),
                [roleId],
            );
            const memberPatchEvent = await events.waitFor(
                (event) => event.event === "GUILD_MEMBER_UPDATE" && event.guild_id === guildId && event.data.user.id === member.id && event.data.nick === managedNick,
            );
            assert.deepEqual(memberPatchEvent.data.roles, [roleId]);
            assert.deepEqual(await memberRoleIds(member.id, guildId), [guildId, roleId].sort());

            const nickname = "nick route member";
            const patchNick = await patchJson(`${api.apiBaseUrl}/guilds/${guildId}/members/${member.id}/nick`, { nick: nickname }, ownerToken);
            await assertStatus(patchNick, 200);
            const patchNickBody = await assertJsonObject(patchNick);
            assert.equal(patchNickBody.nick, nickname);
            const nickEvent = await events.waitFor(
                (event) => event.event === "GUILD_MEMBER_UPDATE" && event.guild_id === guildId && event.data.user.id === member.id && event.data.nick === nickname,
            );
            assert.equal(nickEvent.data.nick, nickname);

            const roleMembersAfterPatch = await getJsonArray(`${api.apiBaseUrl}/guilds/${guildId}/roles/${roleId}/member-ids`, ownerToken);
            assert.deepEqual(roleMembersAfterPatch, [member.id]);
            const memberCountsAfterPatch = await getJsonObject(`${api.apiBaseUrl}/guilds/${guildId}/roles/member-counts`, ownerToken);
            assert.equal(memberCountsAfterPatch[guildId], 2);
            assert.equal(memberCountsAfterPatch[roleId], 1);

            const beforeRemoveRole = markCapturedEvents(events);
            await assertStatus(await deleteJson(`${api.apiBaseUrl}/guilds/${guildId}/members/${member.id}/roles/${roleId}`, ownerToken), 204);
            const removeRoleEvent = await waitForEventAfter(
                events,
                beforeRemoveRole,
                (event) =>
                    event.event === "GUILD_MEMBER_UPDATE" &&
                    event.guild_id === guildId &&
                    event.data.user.id === member.id &&
                    event.data.roles.includes(guildId) &&
                    !event.data.roles.includes(roleId) &&
                    event.data.nick === undefined,
            );
            assert.deepEqual(removeRoleEvent.data.roles, [guildId]);
            assert.deepEqual(await memberRoleIds(member.id, guildId), [guildId]);

            const beforeBulkRole = markCapturedEvents(events);
            await assertStatus(await patchJson(`${api.apiBaseUrl}/guilds/${guildId}/roles/${roleId}/members`, { member_ids: [member.id] }, ownerToken), 204);
            const bulkRoleEvent = await waitForEventAfter(
                events,
                beforeBulkRole,
                (event) =>
                    event.event === "GUILD_MEMBER_UPDATE" &&
                    event.guild_id === guildId &&
                    event.data.user.id === member.id &&
                    event.data.roles.includes(guildId) &&
                    event.data.roles.includes(roleId),
            );
            assert.deepEqual(bulkRoleEvent.data.roles.sort(), [guildId, roleId].sort());
            assert.deepEqual(await memberRoleIds(member.id, guildId), [guildId, roleId].sort());

            const beforePutRole = markCapturedEvents(events);
            await assertStatus(await deleteJson(`${api.apiBaseUrl}/guilds/${guildId}/members/${member.id}/roles/${roleId}`, ownerToken), 204);
            await assertStatus(await putJson(`${api.apiBaseUrl}/guilds/${guildId}/members/${member.id}/roles/${roleId}`, {}, ownerToken), 204);
            const putRoleEvent = await waitForEventAfter(
                events,
                beforePutRole,
                (event) =>
                    event.event === "GUILD_MEMBER_UPDATE" &&
                    event.guild_id === guildId &&
                    event.data.user.id === member.id &&
                    event.data.roles.includes(guildId) &&
                    event.data.roles.includes(roleId),
            );
            assert.deepEqual(putRoleEvent.data.roles.sort(), [guildId, roleId].sort());
            assert.deepEqual(await getJsonArray(`${api.apiBaseUrl}/guilds/${guildId}/roles/${roleId}/member-ids`, ownerToken), [member.id]);

            await assertStatus(await deleteJson(`${api.apiBaseUrl}/guilds/${guildId}/members/${member.id}`, ownerToken), 204);
            const memberRemoveEvent = await events.waitFor((event) => event.event === "GUILD_MEMBER_REMOVE" && event.guild_id === guildId && event.data.user.id === member.id);
            assert.equal(memberRemoveEvent.data.guild_id, guildId);
            const guildDeleteForMember = await events.waitFor((event) => event.event === "GUILD_DELETE" && event.user_id === member.id && event.data.id === guildId);
            assert.equal(guildDeleteForMember.data.id, guildId);
            assert.equal(await Member.countBy({ guild_id: guildId, id: member.id }), 0);
            assert.equal((await Guild.findOneByOrFail({ id: guildId })).member_count, 1);

            await assertStatus(await deleteJson(`${api.apiBaseUrl}/guilds/${guildId}/roles/${roleId}`, ownerToken), 204);
            const roleDeleteEvent = await events.waitFor((event) => event.event === "GUILD_ROLE_DELETE" && event.guild_id === guildId && event.data.role_id === roleId);
            assert.equal(roleDeleteEvent.data.guild_id, guildId);
            assert.equal(await Role.findOneBy({ guild_id: guildId, id: roleId }), null);
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

async function memberRoleIds(userId: string, guildId: string) {
    const member = await Member.findOneOrFail({
        where: { id: userId, guild_id: guildId },
        relations: { roles: true },
    });
    return member.roles.map((role) => role.id).sort();
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
