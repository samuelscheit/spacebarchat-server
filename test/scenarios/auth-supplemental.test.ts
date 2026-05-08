import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import bcrypt from "bcrypt";
import { generateSecret, generateToken as generateTotpToken } from "node-2fa";
import {
    BackupCode,
    closeDatabase,
    Config,
    EmailActionTokenPurpose,
    generateEmailActionToken,
    generateToken,
    generateWebAuthnTicket,
    initDatabase,
    SecurityKey,
    User,
    ValidRegistrationToken,
    WebAuthn,
} from "@spacebar/util";
import { assertJsonError, assertJsonObject, assertStatus } from "../assertions/http";
import { createDisposablePostgresDatabase, hasPostgresAdminUrl } from "../fixtures/database";
import { startApi } from "../server/startApi";

const elevatedAuthRights = "1688849860263936";

const coveredManifestIds = [
    "api:http:GET:/auth/generate-registration-tokens/",
    "api:http:GET:/auth/location-metadata/",
    "api:http:GET:/auth/whoami/",
    "api:http:POST:/auth/fingerprint/",
    "api:http:POST:/auth/forgot/",
    "api:http:POST:/auth/mfa/totp/",
    "api:http:POST:/auth/mfa/webauthn/",
    "api:http:POST:/auth/register/",
    "api:http:POST:/auth/reset/",
    "api:http:POST:/auth/verify/",
    "api:http:POST:/auth/verify/resend/",
    "api:http:POST:/auth/verify/view-backup-codes-challenge/",
    "api:http:POST:/users/@me/mfa/codes-verification/",
    "api:http:POST:/users/@me/mfa/codes/",
    "api:http:POST:/users/@me/mfa/totp/disable/",
    "api:http:POST:/users/@me/mfa/totp/enable/",
    "api:http:DELETE:/users/@me/mfa/webauthn/credentials/:key_id/",
    "api:http:GET:/users/@me/mfa/webauthn/credentials/",
    "api:http:POST:/users/@me/mfa/webauthn/credentials/",
];

test(
    "auth recovery, verification, MFA, and WebAuthn credential routes persist security state",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 180_000,
    },
    async () => {
        assert.deepEqual(coveredManifestIds, [
            "api:http:GET:/auth/generate-registration-tokens/",
            "api:http:GET:/auth/location-metadata/",
            "api:http:GET:/auth/whoami/",
            "api:http:POST:/auth/fingerprint/",
            "api:http:POST:/auth/forgot/",
            "api:http:POST:/auth/mfa/totp/",
            "api:http:POST:/auth/mfa/webauthn/",
            "api:http:POST:/auth/register/",
            "api:http:POST:/auth/reset/",
            "api:http:POST:/auth/verify/",
            "api:http:POST:/auth/verify/resend/",
            "api:http:POST:/auth/verify/view-backup-codes-challenge/",
            "api:http:POST:/users/@me/mfa/codes-verification/",
            "api:http:POST:/users/@me/mfa/codes/",
            "api:http:POST:/users/@me/mfa/totp/disable/",
            "api:http:POST:/users/@me/mfa/totp/enable/",
            "api:http:DELETE:/users/@me/mfa/webauthn/credentials/:key_id/",
            "api:http:GET:/users/@me/mfa/webauthn/credentials/",
            "api:http:POST:/users/@me/mfa/webauthn/credentials/",
        ]);

        const database = await createDisposablePostgresDatabase({ prefix: "spacebar_auth_supplemental" });
        const tempCwd = await mkdtemp(path.join(tmpdir(), "spacebar-auth-supplemental-"));
        const previous = snapshotProcessState();
        const previousWebAuthn = WebAuthn.fido2;
        let api: Awaited<ReturnType<typeof startApi>> | undefined;

        try {
            process.chdir(tempCwd);
            process.env.DATABASE = database.url;
            process.env.APPLY_DB_MIGRATIONS = "true";
            process.env.LOG_ROUTES = "false";
            delete process.env.CONFIG_PATH;
            delete process.env.DB_SYNC;

            await initDatabase();
            WebAuthn.init();
            api = await startApi();
            Config.get().register.allowMultipleAccounts = false;

            const suffix = `${process.pid}${Date.now()}`;
            const email = `auth-supplemental-${suffix}@example.com`;
            const initialPassword = "scenario-password-42";
            const resetPassword = "scenario-password-84";
            const username = `authsupp${suffix.slice(-8)}`;

            const fingerprintResponse = await fetch(`${api.apiBaseUrl}/auth/fingerprint`, { method: "POST" });
            await assertStatus(fingerprintResponse, 200);
            const fingerprint = (await assertJsonObject(fingerprintResponse)).fingerprint as string;
            assert.equal(typeof fingerprint, "string");
            assert.ok(fingerprint.length > 0);
            const cookie = extractSessionCookie(fingerprintResponse);

            const location = await assertJsonObject(await fetch(`${api.apiBaseUrl}/auth/location-metadata`));
            assert.equal(location.consent_required, false);
            assert.ok(typeof location.country_code === "string" || location.country_code === null);
            assert.deepEqual(location.promotional_email_opt_in, { required: true, pre_checked: false });

            const register = await postJson(
                `${api.apiBaseUrl}/auth/register`,
                {
                    username,
                    email,
                    password: initialPassword,
                    consent: true,
                    date_of_birth: "2000-04-04",
                    fingerprint,
                },
                { cookie },
            );
            await assertStatus(register, 200);
            assert.equal(typeof (await assertJsonObject(register)).token, "string");

            const user = await User.findOneOrFail({
                where: { email },
                select: { id: true, email: true, data: true, fingerprints: true },
            });
            assert.ok(await bcrypt.compare(initialPassword, user.data.hash ?? ""));
            assert.deepEqual(user.fingerprints, [fingerprint]);

            const duplicateFingerprintRegister = await postJson(
                `${api.apiBaseUrl}/auth/register`,
                {
                    username: `dupeauth${suffix.slice(-8)}`,
                    email: `auth-duplicate-${suffix}@example.com`,
                    password: "scenario-password-duplicate",
                    consent: true,
                    date_of_birth: "2000-04-04",
                    fingerprint,
                },
                { cookie },
            );
            await assertJsonError(duplicateFingerprintRegister, 400);

            await assertStatus(await postJson(`${api.apiBaseUrl}/auth/forgot`, { login: email }, { cookie }), 204);

            await User.update({ id: user.id }, { verified: false });
            const verifyToken = await generateEmailActionToken(user.id, EmailActionTokenPurpose.verifyEmail, email);
            assert.ok(verifyToken, "verification token should be generated");
            const verify = await postJson(`${api.apiBaseUrl}/auth/verify`, { token: verifyToken }, { cookie });
            await assertStatus(verify, 204);
            assert.equal((await loadUserSecurityState(user.id)).verified, true);
            const verifiedBearer = await generateToken(user.id);
            assert.ok(verifiedBearer, "verified bearer token should be generated");

            const whoami = await assertJsonObject(await getJson(`${api.apiBaseUrl}/auth/whoami`, verifiedBearer));
            assert.equal(whoami.id, user.id);
            assert.equal(typeof whoami.device_id, "string");
            assert.equal(typeof whoami.logged_in_since, "string");

            const challenge = await postJson(`${api.apiBaseUrl}/auth/verify/view-backup-codes-challenge`, { password: initialPassword }, { token: verifiedBearer });
            await assertStatus(challenge, 200);
            const challengeBody = await assertJsonObject(challenge);
            assert.deepEqual(Object.keys(challengeBody).sort(), ["nonce", "regenerate_nonce"]);

            const resetToken = await generateEmailActionToken(user.id, EmailActionTokenPurpose.resetPassword, email);
            assert.ok(resetToken, "password reset token should be generated");
            const reset = await postJson(`${api.apiBaseUrl}/auth/reset`, { token: resetToken, password: resetPassword }, { cookie });
            await assertStatus(reset, 200);
            const resetBearer = (await assertJsonObject(reset)).token as string;
            assert.equal(typeof resetBearer, "string");
            const resetUser = await User.findOneOrFail({ where: { id: user.id }, select: { id: true, data: true } });
            assert.ok(await bcrypt.compare(resetPassword, resetUser.data.hash ?? ""));
            assert.equal(await bcrypt.compare(initialPassword, resetUser.data.hash ?? ""), false);

            await User.update({ id: user.id }, { rights: elevatedAuthRights, verified: false });
            await assertStatus(await postJson(`${api.apiBaseUrl}/auth/verify/resend`, {}, { token: resetBearer }), 204);

            const generatedRegistrationTokens = await assertJsonObject(await getJson(`${api.apiBaseUrl}/auth/generate-registration-tokens?count=1&length=16`, resetBearer));
            assert.ok(Array.isArray(generatedRegistrationTokens.tokens));
            assert.equal(generatedRegistrationTokens.tokens.length, 1);
            const registrationToken = generatedRegistrationTokens.tokens[0] as string;
            assert.equal(registrationToken.length, 16);
            assert.ok(await ValidRegistrationToken.findOneBy({ token: registrationToken }));

            const tokenRegister = await postJson(
                `${api.apiBaseUrl}/auth/register`,
                {
                    username: `tokenuser${suffix.slice(-8)}`,
                    email: `auth-token-${suffix}@example.com`,
                    password: "scenario-password-token",
                    consent: true,
                    date_of_birth: "2000-04-04",
                    fingerprint: `fingerprint-token-${suffix}`,
                },
                { headers: { referer: `${api.baseUrl}/register?token=${registrationToken}` } },
            );
            await assertStatus(tokenRegister, 200);
            assert.equal(await ValidRegistrationToken.findOneBy({ token: registrationToken }), null);

            const secret = generateSecret({ name: "Spacebar", account: email }).secret;
            const enableCode = await generateFreshTotpToken(secret);
            const enableTotp = await postJson(
                `${api.apiBaseUrl}/users/@me/mfa/totp/enable`,
                {
                    password: resetPassword,
                    secret,
                    code: enableCode,
                },
                { token: resetBearer },
            );
            await assertStatus(enableTotp, 200);
            const enableTotpBody = await assertJsonObject(enableTotp);
            assert.equal(typeof enableTotpBody.token, "string");
            assert.ok(Array.isArray(enableTotpBody.backup_codes));
            assert.equal((await loadUserSecurityState(user.id)).mfa_enabled, true);
            assert.equal((await loadUserSecurityState(user.id)).totp_secret, secret);
            assert.equal(await activeBackupCodeCount(user.id), 10);

            const loginWithMfa = await postJson(`${api.apiBaseUrl}/auth/login`, { login: email, password: resetPassword });
            await assertStatus(loginWithMfa, 200);
            const loginWithMfaBody = await assertJsonObject(loginWithMfa);
            assert.equal(loginWithMfaBody.mfa, true);
            assert.equal(loginWithMfaBody.token, null);
            assert.equal(typeof loginWithMfaBody.ticket, "string");
            assert.equal((await User.findOne({ where: { id: user.id }, select: { id: true, totp_last_ticket: true } }))?.totp_last_ticket, loginWithMfaBody.ticket);

            const completeTotpCode = await generateFreshTotpToken(secret);
            const completeTotp = await postJson(`${api.apiBaseUrl}/auth/mfa/totp`, {
                ticket: loginWithMfaBody.ticket,
                code: completeTotpCode,
            });
            await assertStatus(completeTotp, 200);
            const completeTotpBody = await assertJsonObject(completeTotp);
            assert.equal(typeof completeTotpBody.token, "string");
            assert.equal(typeof completeTotpBody.settings, "object");
            assert.equal((await User.findOne({ where: { id: user.id }, select: { id: true, totp_last_ticket: true } }))?.totp_last_ticket, "");
            const mfaBearer = completeTotpBody.token as string;

            const existingCodes = await postJson(`${api.apiBaseUrl}/users/@me/mfa/codes`, { password: resetPassword, regenerate: false }, { token: mfaBearer });
            await assertStatus(existingCodes, 200);
            assert.equal(((await assertJsonObject(existingCodes)).backup_codes as unknown[]).length, 10);

            const verifiedCodes = await postJson(
                `${api.apiBaseUrl}/users/@me/mfa/codes-verification`,
                {
                    key: resetPassword,
                    nonce: challengeBody.regenerate_nonce,
                    regenerate: true,
                },
                { token: mfaBearer },
            );
            await assertStatus(verifiedCodes, 200);
            assert.equal(((await assertJsonObject(verifiedCodes)).backup_codes as unknown[]).length, 10);
            assert.equal(await activeBackupCodeCount(user.id), 10);

            const otherUser = await User.register({
                username: `othermfa${suffix.slice(-8)}`,
                email: `auth-other-mfa-${suffix}@example.com`,
                password: "not-a-real-login-hash",
            });
            await BackupCode.create({
                user: { id: otherUser.id },
                code: "abcdef",
                consumed: false,
                expired: false,
            }).save();
            await assertJsonError(await postJson(`${api.apiBaseUrl}/users/@me/mfa/totp/disable`, { code: "abcdef" }, { token: mfaBearer }), 400);
            assert.equal((await loadUserSecurityState(user.id)).mfa_enabled, true);

            const disableCode = await generateFreshTotpToken(secret);
            const disableTotp = await postJson(`${api.apiBaseUrl}/users/@me/mfa/totp/disable`, { code: disableCode }, { token: mfaBearer });
            await assertStatus(disableTotp, 200);
            const disableBearer = (await assertJsonObject(disableTotp)).token as string;
            assert.equal(typeof disableBearer, "string");
            const disabledUser = await loadUserSecurityState(user.id);
            assert.equal(disabledUser?.mfa_enabled, false);
            assert.equal(disabledUser?.totp_secret, "");
            assert.equal(await activeBackupCodeCount(user.id), 0);

            const emptyCredentials = await getJson(`${api.apiBaseUrl}/users/@me/mfa/webauthn/credentials`, disableBearer);
            await assertStatus(emptyCredentials, 200);
            assert.deepEqual(await emptyCredentials.json(), []);
            const securityKey = await SecurityKey.create({
                user_id: user.id,
                key_id: "scenario-key-id",
                public_key: "scenario-public-key",
                counter: 0,
                name: "Scenario key",
            }).save();
            await User.update({ id: user.id }, { webauthn_enabled: true });

            const credentials = await getJson(`${api.apiBaseUrl}/users/@me/mfa/webauthn/credentials`, disableBearer);
            await assertStatus(credentials, 200);
            const credentialList = await credentials.json();
            assert.ok(Array.isArray(credentialList));
            assert.deepEqual(credentialList, [{ id: securityKey.id, name: "Scenario key" }]);

            await assertStatus(await deleteJson(`${api.apiBaseUrl}/users/@me/mfa/webauthn/credentials/${securityKey.id}`, disableBearer), 204);
            assert.equal(await SecurityKey.findOneBy({ id: securityKey.id }), null);
            assert.equal((await loadUserSecurityState(user.id)).webauthn_enabled, false);

            const webauthnChallenge = await postJson(`${api.apiBaseUrl}/users/@me/mfa/webauthn/credentials`, { password: resetPassword }, { token: disableBearer });
            await assertStatus(webauthnChallenge, 200);
            const webauthnChallengeBody = await assertJsonObject(webauthnChallenge);
            assert.equal(typeof webauthnChallengeBody.ticket, "string");
            assert.equal(typeof webauthnChallengeBody.challenge, "string");
            assert.ok(JSON.parse(webauthnChallengeBody.challenge as string).publicKey);

            const malformedWebAuthnTicket = await generateWebAuthnTicket("scenario malformed assertion");
            await User.update({ id: user.id }, { totp_last_ticket: malformedWebAuthnTicket });
            await assertJsonError(
                await postJson(`${api.apiBaseUrl}/auth/mfa/webauthn`, {
                    ticket: malformedWebAuthnTicket,
                    code: "{}",
                }),
                400,
            );
            assert.equal((await User.findOne({ where: { id: user.id }, select: { id: true, totp_last_ticket: true } }))?.totp_last_ticket, malformedWebAuthnTicket);
        } finally {
            if (api) await api.stop();
            await closeDatabase();
            await database.close();
            WebAuthn.fido2 = previousWebAuthn;
            restoreProcessState(previous);
            await rm(tempCwd, { recursive: true, force: true });
        }
    },
);

async function loadUserSecurityState(userId: string) {
    return await User.findOneOrFail({
        where: { id: userId },
        select: {
            id: true,
            verified: true,
            mfa_enabled: true,
            webauthn_enabled: true,
            totp_secret: true,
            totp_last_ticket: true,
        },
    });
}

async function activeBackupCodeCount(userId: string) {
    return await BackupCode.count({
        where: {
            user: { id: userId },
            consumed: false,
            expired: false,
        },
    });
}

async function generateFreshTotpToken(secret: string) {
    const stepMs = 30_000;
    const minRemainingMs = 5_000;
    const remainingMs = stepMs - (Date.now() % stepMs);

    if (remainingMs < minRemainingMs) await delay(remainingMs + 100);

    const generated = generateTotpToken(secret);
    assert.ok(generated, "TOTP token generation should succeed");
    return generated.token;
}

async function getJson(url: string, token?: string) {
    return await fetch(url, {
        headers: {
            ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
    });
}

async function postJson(
    url: string,
    body: unknown,
    options: {
        token?: string;
        cookie?: string;
        headers?: Record<string, string>;
    } = {},
) {
    return await fetch(url, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
            ...(options.cookie ? { cookie: options.cookie } : {}),
            ...options.headers,
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

function extractSessionCookie(response: Response) {
    const setCookie = response.headers.get("set-cookie");
    assert.ok(setCookie, "fingerprint response should set a session cookie");
    return setCookie.split(";")[0];
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
