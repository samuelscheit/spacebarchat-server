import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { closeDatabase, generateToken, initDatabase, Relationship, User } from "@spacebar/util";
import { RelationshipType } from "@spacebar/schemas";
import { assertJsonObject, assertStatus } from "../assertions/http";
import { createDisposablePostgresDatabase, hasPostgresAdminUrl } from "../fixtures/database";
import { captureEvents } from "../fixtures/events";
import { startApi } from "../server/startApi";

const coveredManifestIds = [
    "api:http:GET:/users/@me/relationships/",
    "api:http:PUT:/users/@me/relationships/:user_id",
    "api:http:PATCH:/users/@me/relationships/:user_id",
    "api:http:POST:/users/@me/relationships/",
    "api:http:DELETE:/users/@me/relationships/:user_id",
];

test(
    "user relationships add, list, update, delete, and username lookup persist state and emit events",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 180_000,
    },
    async () => {
        assert.deepEqual(coveredManifestIds, [
            "api:http:GET:/users/@me/relationships/",
            "api:http:PUT:/users/@me/relationships/:user_id",
            "api:http:PATCH:/users/@me/relationships/:user_id",
            "api:http:POST:/users/@me/relationships/",
            "api:http:DELETE:/users/@me/relationships/:user_id",
        ]);

        const database = await createDisposablePostgresDatabase({ prefix: "spacebar_users_relationships" });
        const tempCwd = await mkdtemp(path.join(tmpdir(), "spacebar-users-relationships-"));
        const previous = snapshotProcessState();
        let api: Awaited<ReturnType<typeof startApi>> | undefined;
        let relationshipEvents: Awaited<ReturnType<typeof captureEvents>> | undefined;

        try {
            process.chdir(tempCwd);
            process.env.DATABASE = database.url;
            process.env.APPLY_DB_MIGRATIONS = "true";
            process.env.LOG_ROUTES = "false";
            delete process.env.CONFIG_PATH;
            delete process.env.DB_SYNC;

            await initDatabase();
            api = await startApi();

            const suffix = `${process.pid}${Date.now()}`;
            const requester = await User.register({
                username: `requester${suffix.slice(-8)}`,
                email: `requester-${suffix}@example.com`,
                password: "not-a-real-login-hash",
            });
            const friendById = await User.register({
                username: `friendid${suffix.slice(-8)}`,
                email: `friend-id-${suffix}@example.com`,
                password: "not-a-real-login-hash",
            });
            const friendByName = await User.register({
                username: `friendname${suffix.slice(-8)}`,
                email: `friend-name-${suffix}@example.com`,
                password: "not-a-real-login-hash",
            });
            const token = await generateToken(requester.id);
            assert.ok(token, "token generation should return a bearer token");
            relationshipEvents = await captureEvents([requester.id, friendById.id, friendByName.id]);

            const addById = await putJson(`${api.apiBaseUrl}/users/@me/relationships/${friendById.id}`, {}, token);
            await assertStatus(addById, 204);

            const requesterAddEvent = await relationshipEvents.waitFor(
                (event) => event.event === "RELATIONSHIP_ADD" && event.user_id === requester.id && event.data.id === friendById.id,
            );
            assert.equal(requesterAddEvent.data.type, RelationshipType.outgoing);
            assert.equal(requesterAddEvent.data.user.id, friendById.id);

            const friendAddEvent = await relationshipEvents.waitFor(
                (event) => event.event === "RELATIONSHIP_ADD" && event.user_id === friendById.id && event.data.id === requester.id,
            );
            assert.equal(friendAddEvent.data.type, RelationshipType.incoming);
            assert.equal(friendAddEvent.data.should_notify, true);

            const relationshipsAfterAdd = await listRelationships(`${api.apiBaseUrl}/users/@me/relationships`, token);
            assert.equal(relationshipsAfterAdd.length, 1);
            assert.equal(relationshipsAfterAdd[0].id, friendById.id);
            assert.equal(relationshipsAfterAdd[0].type, RelationshipType.outgoing);
            assert.equal(await Relationship.countBy({ from_id: requester.id, to_id: friendById.id }), 1);
            assert.equal(await Relationship.countBy({ from_id: friendById.id, to_id: requester.id }), 1);

            const updateNickname = await patchJson(
                `${api.apiBaseUrl}/users/@me/relationships/${friendById.id}`,
                {
                    nickname: "scenario friend",
                },
                token,
            );
            await assertStatus(updateNickname, 204);
            const updateEvent = await relationshipEvents.waitFor(
                (event) => event.event === "RELATIONSHIP_UPDATE" && event.user_id === requester.id && event.data.id === friendById.id,
            );
            assert.equal(updateEvent.data.nickname, "scenario friend");
            assert.equal(updateEvent.data.user.id, friendById.id);
            const updatedRelationship = await Relationship.findOneByOrFail({ from_id: requester.id, to_id: friendById.id });
            assert.equal(updatedRelationship.nickname, "scenario friend");

            const removeById = await deleteJson(`${api.apiBaseUrl}/users/@me/relationships/${friendById.id}`, token);
            await assertStatus(removeById, 204);
            const requesterRemoveEvent = await relationshipEvents.waitFor(
                (event) => event.event === "RELATIONSHIP_REMOVE" && event.user_id === requester.id && event.data.id === friendById.id,
            );
            assert.equal(requesterRemoveEvent.data.type, RelationshipType.outgoing);
            assert.equal(requesterRemoveEvent.data.user.id, friendById.id);
            const friendRemoveEvent = await relationshipEvents.waitFor(
                (event) => event.event === "RELATIONSHIP_REMOVE" && event.user_id === friendById.id && event.data.id === requester.id,
            );
            assert.equal(friendRemoveEvent.data.type, RelationshipType.incoming);
            assert.equal(friendRemoveEvent.data.user.id, requester.id);
            assert.equal(await Relationship.countBy({ from_id: requester.id, to_id: friendById.id }), 0);
            assert.equal(await Relationship.countBy({ from_id: friendById.id, to_id: requester.id }), 0);

            const addByUsername = await postJson(
                `${api.apiBaseUrl}/users/@me/relationships`,
                {
                    username: friendByName.username,
                    discriminator: friendByName.discriminator,
                },
                token,
            );
            await assertStatus(addByUsername, 204);
            const usernameAddEvent = await relationshipEvents.waitFor(
                (event) => event.event === "RELATIONSHIP_ADD" && event.user_id === requester.id && event.data.id === friendByName.id,
            );
            assert.equal(usernameAddEvent.data.type, RelationshipType.outgoing);
            assert.equal(await Relationship.countBy({ from_id: requester.id, to_id: friendByName.id }), 1);
        } finally {
            if (relationshipEvents) await relationshipEvents.stop();
            if (api) await api.stop();
            await closeDatabase();
            await database.close();
            restoreProcessState(previous);
            await rm(tempCwd, { recursive: true, force: true });
        }
    },
);

async function listRelationships(url: string, token: string) {
    const response = await fetch(url, {
        headers: {
            authorization: `Bearer ${token}`,
        },
    });
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

function snapshotProcessState() {
    return {
        cwd: process.cwd(),
        DATABASE: process.env.DATABASE,
        APPLY_DB_MIGRATIONS: process.env.APPLY_DB_MIGRATIONS,
        CONFIG_PATH: process.env.CONFIG_PATH,
        DB_SYNC: process.env.DB_SYNC,
        LOG_ROUTES: process.env.LOG_ROUTES,
    };
}

function restoreProcessState(state: ReturnType<typeof snapshotProcessState>) {
    process.chdir(state.cwd);
    restoreEnv("DATABASE", state.DATABASE);
    restoreEnv("APPLY_DB_MIGRATIONS", state.APPLY_DB_MIGRATIONS);
    restoreEnv("CONFIG_PATH", state.CONFIG_PATH);
    restoreEnv("DB_SYNC", state.DB_SYNC);
    restoreEnv("LOG_ROUTES", state.LOG_ROUTES);
}

function restoreEnv(name: string, value: string | undefined) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
}
