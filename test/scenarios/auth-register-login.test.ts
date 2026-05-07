import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { closeDatabase, initDatabase, Session, User } from "@spacebar/util";
import { assertJsonObject, assertStatus } from "../assertions/http";
import { createDisposablePostgresDatabase, hasPostgresAdminUrl } from "../fixtures/database";
import { startApi } from "../server/startApi";

const coveredManifestIds = ["api:http:POST:/auth/register/", "api:http:POST:/auth/login/"];

test(
    "register then login persists the user and creates independent sessions",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 180_000,
    },
    async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:POST:/auth/register/", "api:http:POST:/auth/login/"]);

        const database = await createDisposablePostgresDatabase({ prefix: "spacebar_auth_scenario" });
        const tempCwd = await mkdtemp(path.join(tmpdir(), "spacebar-auth-scenario-"));
        const previous = snapshotProcessState();
        let api: Awaited<ReturnType<typeof startApi>> | undefined;

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
            const email = `auth-scenario-${suffix}@example.com`;
            const password = "scenario-password-42";
            const username = `scenario${suffix.slice(-8)}`;

            const register = await postJson(`${api.apiBaseUrl}/auth/register`, {
                username,
                email,
                password,
                consent: true,
                date_of_birth: "2000-04-04",
                fingerprint: `fingerprint-${suffix}`,
            });
            await assertStatus(register, 200);
            const registerBody = await assertJsonObject(register);
            assert.equal(typeof registerBody.token, "string");
            assert.match(registerBody.token as string, /^.+\..+\..+$/);

            const user = await User.findOne({
                where: { email },
                select: { id: true, username: true, email: true, data: true },
            });
            assert.ok(user, "registration should persist a user");
            assert.equal(user.username, username);
            assert.equal(user.email, email);
            assert.equal(typeof user.data?.hash, "string");
            assert.notEqual(user.data.hash, password);

            const sessionsAfterRegister = await Session.find({ where: { user_id: user.id }, select: { session_id: true, user_id: true } });
            assert.equal(sessionsAfterRegister.length, 1, "registration token generation should persist one session");

            const login = await postJson(`${api.apiBaseUrl}/auth/login`, {
                login: email,
                password,
                undelete: false,
            });
            await assertStatus(login, 200);
            const loginBody = await assertJsonObject(login);
            assert.equal(loginBody.user_id, user.id);
            assert.equal(typeof loginBody.token, "string");
            assert.match(loginBody.token as string, /^.+\..+\..+$/);
            assert.notEqual(loginBody.token, registerBody.token);

            const sessionsAfterLogin = await Session.find({ where: { user_id: user.id }, select: { session_id: true, user_id: true } });
            assert.equal(sessionsAfterLogin.length, 2, "login should persist a second session");
        } finally {
            if (api) await api.stop();
            await closeDatabase();
            await database.close();
            restoreProcessState(previous);
            await rm(tempCwd, { recursive: true, force: true });
        }
    },
);

async function postJson(url: string, body: unknown) {
    return await fetch(url, {
        method: "POST",
        headers: {
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
