import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { closeDatabase, generateToken, initDatabase, Session, User, UserSettings } from "@spacebar/util";
import { assertJsonObject, assertStatus } from "../assertions/http";
import { createDisposablePostgresDatabase, hasPostgresAdminUrl } from "../fixtures/database";
import { captureEvents } from "../fixtures/events";
import { startApi } from "../server/startApi";

const coveredManifestIds = ["api:http:GET:/users/@me/", "api:http:PATCH:/users/@me/", "api:http:GET:/users/@me/settings/", "api:http:PATCH:/users/@me/settings/"];

test(
    "user profile and settings updates persist state and emit user-scoped events",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 180_000,
    },
    async () => {
        assert.deepEqual(coveredManifestIds, [
            "api:http:GET:/users/@me/",
            "api:http:PATCH:/users/@me/",
            "api:http:GET:/users/@me/settings/",
            "api:http:PATCH:/users/@me/settings/",
        ]);

        const database = await createDisposablePostgresDatabase({ prefix: "spacebar_users_scenario" });
        const tempCwd = await mkdtemp(path.join(tmpdir(), "spacebar-users-scenario-"));
        const previous = snapshotProcessState();
        let api: Awaited<ReturnType<typeof startApi>> | undefined;
        let userEvents: Awaited<ReturnType<typeof captureEvents>> | undefined;

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
            const email = `users-scenario-${suffix}@example.com`;
            const username = `profile${suffix.slice(-8)}`;
            const user = await User.register({
                username,
                email,
                password: "not-a-real-login-hash",
            });
            const token = await generateToken(user.id);
            assert.ok(token, "token generation should return a bearer token");
            const session = await Session.findOneByOrFail({ user_id: user.id });
            userEvents = await captureEvents(user.id);

            const self = await getJson(`${api.apiBaseUrl}/users/@me`, token);
            await assertStatus(self, 200);
            const selfBody = await assertJsonObject(self);
            assert.equal(selfBody.id, user.id);
            assert.equal(selfBody.username, username);
            assert.equal(selfBody.email, email);
            assert.equal(selfBody.bot, false);
            assert.equal("data" in selfBody, false);

            const updatedBio = "Profile settings scenario bio";
            const profileUpdate = await patchJson(
                `${api.apiBaseUrl}/users/@me`,
                {
                    bio: updatedBio,
                },
                token,
            );
            await assertStatus(profileUpdate, 200);
            const profileUpdateBody = await assertJsonObject(profileUpdate);
            assert.equal(profileUpdateBody.id, user.id);
            assert.equal(profileUpdateBody.bio, updatedBio);

            const userUpdateEvent = await userEvents.waitFor((event) => event.event === "USER_UPDATE" && event.user_id === user.id);
            assert.equal(userUpdateEvent.data.id, user.id);
            assert.equal(userUpdateEvent.data.bio, updatedBio);
            const persistedProfile = await User.findOneOrFail({
                where: { id: user.id },
                select: { id: true, bio: true },
            });
            assert.equal(persistedProfile.bio, updatedBio);

            const initialSettings = await getJson(`${api.apiBaseUrl}/users/@me/settings`, token);
            await assertStatus(initialSettings, 200);
            const initialSettingsBody = await assertJsonObject(initialSettings);
            assert.equal(initialSettingsBody.locale, "en-US");
            assert.equal(initialSettingsBody.theme, "dark");

            const settingsUpdate = await patchJson(
                `${api.apiBaseUrl}/users/@me/settings`,
                {
                    locale: "en",
                    status: "idle",
                    theme: "light",
                    developer_mode: false,
                },
                token,
            );
            await assertStatus(settingsUpdate, 200);
            const settingsUpdateBody = await assertJsonObject(settingsUpdate);
            assert.equal(settingsUpdateBody.locale, "en-US");
            assert.equal(settingsUpdateBody.status, "idle");
            assert.equal(settingsUpdateBody.theme, "light");
            assert.equal(settingsUpdateBody.developer_mode, false);

            const presenceEvent = await userEvents.waitFor((event) => event.event === "PRESENCE_UPDATE" && event.user_id === user.id);
            assert.equal(presenceEvent.data.user.id, user.id);
            assert.equal(presenceEvent.data.status, "idle");

            const persistedSession = await Session.findOneByOrFail({ session_id: session.session_id });
            assert.equal(persistedSession.status, "idle");
            const persistedSettings = await UserSettings.getOrDefault(user.id);
            assert.equal(persistedSettings.locale, "en-US");
            assert.equal(persistedSettings.status, "idle");
            assert.equal(persistedSettings.theme, "light");
            assert.equal(persistedSettings.developer_mode, false);

            const settingsAfterUpdate = await getJson(`${api.apiBaseUrl}/users/@me/settings`, token);
            await assertStatus(settingsAfterUpdate, 200);
            const settingsAfterUpdateBody = await assertJsonObject(settingsAfterUpdate);
            assert.equal(settingsAfterUpdateBody.locale, "en-US");
            assert.equal(settingsAfterUpdateBody.status, "idle");
            assert.equal(settingsAfterUpdateBody.theme, "light");
            assert.equal(settingsAfterUpdateBody.developer_mode, false);
        } finally {
            if (userEvents) await userEvents.stop();
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
