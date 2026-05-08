import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { closeDatabase, generateToken, initDatabase, Note, User } from "@spacebar/util";
import { assertJsonError, assertJsonObject, assertStatus } from "../assertions/http";
import { createDisposablePostgresDatabase, hasPostgresAdminUrl } from "../fixtures/database";
import { captureEvents } from "../fixtures/events";
import { startApi } from "../server/startApi";

const coveredManifestIds = ["api:http:GET:/users/@me/notes/:user_id", "api:http:PUT:/users/@me/notes/:user_id"];

test(
    "user notes upsert, fetch, update, and delete persist state and emit note events",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 180_000,
    },
    async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/users/@me/notes/:user_id", "api:http:PUT:/users/@me/notes/:user_id"]);

        const database = await createDisposablePostgresDatabase({ prefix: "spacebar_users_notes" });
        const tempCwd = await mkdtemp(path.join(tmpdir(), "spacebar-users-notes-"));
        const previous = snapshotProcessState();
        let api: Awaited<ReturnType<typeof startApi>> | undefined;
        let noteEvents: Awaited<ReturnType<typeof captureEvents>> | undefined;

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
            const owner = await User.register({
                username: `noteowner${suffix.slice(-8)}`,
                email: `note-owner-${suffix}@example.com`,
                password: "not-a-real-login-hash",
            });
            const target = await User.register({
                username: `notetarget${suffix.slice(-8)}`,
                email: `note-target-${suffix}@example.com`,
                password: "not-a-real-login-hash",
            });
            const token = await generateToken(owner.id);
            assert.ok(token, "token generation should return a bearer token");
            noteEvents = await captureEvents(owner.id);

            await assertJsonError(await getJson(`${api.apiBaseUrl}/users/@me/notes/${target.id}`, token), 404);

            const createdNote = "first scenario note";
            await assertStatus(await putJson(`${api.apiBaseUrl}/users/@me/notes/${target.id}`, { note: createdNote }, token), 204);
            const createEvent = await noteEvents.waitFor((event) => event.event === "USER_NOTE_UPDATE" && event.user_id === owner.id && event.data.id === target.id);
            assert.equal(createEvent.data.note, createdNote);
            const persistedCreatedNote = await Note.findOneOrFail({ where: { owner: { id: owner.id }, target: { id: target.id } } });
            assert.equal(persistedCreatedNote.content, createdNote);

            const fetchedNote = await getJson(`${api.apiBaseUrl}/users/@me/notes/${target.id}`, token);
            await assertStatus(fetchedNote, 200);
            assert.deepEqual(await assertJsonObject(fetchedNote), {
                note: createdNote,
                note_user_id: target.id,
                user_id: owner.id,
            });

            const updatedNote = "updated scenario note";
            await assertStatus(await putJson(`${api.apiBaseUrl}/users/@me/notes/${target.id}`, { note: updatedNote }, token), 204);
            const updateEvent = await noteEvents.waitFor(
                (event) => event.event === "USER_NOTE_UPDATE" && event.user_id === owner.id && event.data.id === target.id && event.data.note === updatedNote,
            );
            assert.equal(updateEvent.data.note, updatedNote);
            const persistedUpdatedNote = await Note.findOneOrFail({ where: { owner: { id: owner.id }, target: { id: target.id } } });
            assert.equal(persistedUpdatedNote.content, updatedNote);
            assert.equal(await Note.countBy({ owner: { id: owner.id }, target: { id: target.id } }), 1);

            await assertStatus(await putJson(`${api.apiBaseUrl}/users/@me/notes/${target.id}`, { note: "" }, token), 204);
            const deleteEvent = await noteEvents.waitFor(
                (event) => event.event === "USER_NOTE_UPDATE" && event.user_id === owner.id && event.data.id === target.id && event.data.note === "",
            );
            assert.equal(deleteEvent.data.note, "");
            assert.equal(await Note.countBy({ owner: { id: owner.id }, target: { id: target.id } }), 0);
            await assertJsonError(await getJson(`${api.apiBaseUrl}/users/@me/notes/${target.id}`, token), 404);
        } finally {
            if (noteEvents) await noteEvents.stop();
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
