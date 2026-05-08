import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import bcrypt from "bcrypt";
import { FrecencyUserSettings, PreloadedUserSettings } from "discord-protos";
import { Channel, closeDatabase, Config, generateToken, Guild, initDatabase, InstanceBan, Member, Recipient, Rights, User, UserSettingsProtos } from "@spacebar/util";
import { ChannelType } from "@spacebar/schemas";
import { assertJsonObject, assertStatus } from "../assertions/http";
import { createDisposablePostgresDatabase, hasPostgresAdminUrl } from "../fixtures/database";
import { captureEvents } from "../fixtures/events";
import { startApi } from "../server/startApi";

const coveredManifestIds = [
    "api:http:DELETE:/users/@me/billing/payment-sources/:payment_source_id",
    "api:http:DELETE:/users/@me/guilds/:guild_id",
    "api:http:GET:/users/:user_id/",
    "api:http:GET:/users/:user_id/messages/",
    "api:http:GET:/users/:user_id/profile/",
    "api:http:GET:/users/@me/activities/statistics/applications/",
    "api:http:GET:/users/@me/affinities/guilds/",
    "api:http:GET:/users/@me/affinities/users/",
    "api:http:GET:/users/@me/applications/:application_id/entitlements/",
    "api:http:GET:/users/@me/billing/country-code/",
    "api:http:GET:/users/@me/billing/location-info/",
    "api:http:GET:/users/@me/billing/payment-sources/",
    "api:http:GET:/users/@me/billing/payment-sources/:payment_source_id",
    "api:http:GET:/users/@me/billing/subscriptions/",
    "api:http:GET:/users/@me/channels/",
    "api:http:GET:/users/@me/collectibles-marketing/",
    "api:http:GET:/users/@me/collectibles-purchases/",
    "api:http:GET:/users/@me/email-settings/",
    "api:http:GET:/users/@me/entitlements/gifts",
    "api:http:GET:/users/@me/guilds/",
    "api:http:GET:/users/@me/guilds/:guild_id/settings/",
    "api:http:GET:/users/@me/guilds/premium/subscription-slots/",
    "api:http:GET:/users/@me/library/",
    "api:http:GET:/users/@me/settings-proto/1/",
    "api:http:GET:/users/@me/settings-proto/1/json",
    "api:http:GET:/users/@me/settings-proto/2/",
    "api:http:GET:/users/@me/settings-proto/2/json",
    "api:http:PATCH:/users/:user_id/profile/",
    "api:http:PATCH:/users/@me/billing/payment-sources/:payment_source_id",
    "api:http:PATCH:/users/@me/guilds/:guild_id/settings/",
    "api:http:PATCH:/users/@me/settings-proto/1/",
    "api:http:PATCH:/users/@me/settings-proto/1/json",
    "api:http:PATCH:/users/@me/settings-proto/2/",
    "api:http:PATCH:/users/@me/settings-proto/2/json",
    "api:http:POST:/users/:user_id/delete/",
    "api:http:POST:/users/@me/billing/payment-sources/",
    "api:http:POST:/users/@me/channels/",
    "api:http:POST:/users/@me/delete/",
    "api:http:POST:/users/@me/devices/",
    "api:http:POST:/users/@me/disable/",
];
const eventTimeoutMs = 1000;

test(
    "users supplemental routes expose account surfaces and persist mutating account state",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 180_000,
    },
    async () => {
        assert.deepEqual(coveredManifestIds, [
            "api:http:DELETE:/users/@me/billing/payment-sources/:payment_source_id",
            "api:http:DELETE:/users/@me/guilds/:guild_id",
            "api:http:GET:/users/:user_id/",
            "api:http:GET:/users/:user_id/messages/",
            "api:http:GET:/users/:user_id/profile/",
            "api:http:GET:/users/@me/activities/statistics/applications/",
            "api:http:GET:/users/@me/affinities/guilds/",
            "api:http:GET:/users/@me/affinities/users/",
            "api:http:GET:/users/@me/applications/:application_id/entitlements/",
            "api:http:GET:/users/@me/billing/country-code/",
            "api:http:GET:/users/@me/billing/location-info/",
            "api:http:GET:/users/@me/billing/payment-sources/",
            "api:http:GET:/users/@me/billing/payment-sources/:payment_source_id",
            "api:http:GET:/users/@me/billing/subscriptions/",
            "api:http:GET:/users/@me/channels/",
            "api:http:GET:/users/@me/collectibles-marketing/",
            "api:http:GET:/users/@me/collectibles-purchases/",
            "api:http:GET:/users/@me/email-settings/",
            "api:http:GET:/users/@me/entitlements/gifts",
            "api:http:GET:/users/@me/guilds/",
            "api:http:GET:/users/@me/guilds/:guild_id/settings/",
            "api:http:GET:/users/@me/guilds/premium/subscription-slots/",
            "api:http:GET:/users/@me/library/",
            "api:http:GET:/users/@me/settings-proto/1/",
            "api:http:GET:/users/@me/settings-proto/1/json",
            "api:http:GET:/users/@me/settings-proto/2/",
            "api:http:GET:/users/@me/settings-proto/2/json",
            "api:http:PATCH:/users/:user_id/profile/",
            "api:http:PATCH:/users/@me/billing/payment-sources/:payment_source_id",
            "api:http:PATCH:/users/@me/guilds/:guild_id/settings/",
            "api:http:PATCH:/users/@me/settings-proto/1/",
            "api:http:PATCH:/users/@me/settings-proto/1/json",
            "api:http:PATCH:/users/@me/settings-proto/2/",
            "api:http:PATCH:/users/@me/settings-proto/2/json",
            "api:http:POST:/users/:user_id/delete/",
            "api:http:POST:/users/@me/billing/payment-sources/",
            "api:http:POST:/users/@me/channels/",
            "api:http:POST:/users/@me/delete/",
            "api:http:POST:/users/@me/devices/",
            "api:http:POST:/users/@me/disable/",
        ]);

        const database = await createDisposablePostgresDatabase({ prefix: "spacebar_users_supplemental" });
        const tempCwd = await mkdtemp(path.join(tmpdir(), "spacebar-users-supplemental-"));
        const previous = snapshotProcessState();
        let api: Awaited<ReturnType<typeof startApi>> | undefined;
        let ownerEvents: Awaited<ReturnType<typeof captureEvents>> | undefined;
        let guildEvents: Awaited<ReturnType<typeof captureEvents>> | undefined;
        let adminEvents: Awaited<ReturnType<typeof captureEvents>> | undefined;

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
            const owner = await registerUser(`usersuppowner${suffix.slice(-8)}`, `users-supp-owner-${suffix}@example.com`);
            const target = await registerUser(`usersupptarget${suffix.slice(-8)}`, `users-supp-target-${suffix}@example.com`);
            const groupTarget = await registerUser(`usersuppgroup${suffix.slice(-8)}`, `users-supp-group-${suffix}@example.com`);
            const ownerToken = await generateToken(owner.id);
            assert.ok(ownerToken, "owner token generation should return a bearer token");
            ownerEvents = await captureEvents(owner.id);

            const createdGuild = await postJson(`${api.apiBaseUrl}/guilds`, { name: `users-supp-${suffix.slice(-8)}` }, ownerToken);
            await assertStatus(createdGuild, 201);
            const guildId = (await assertJsonObject(createdGuild)).id as string;
            await Member.addToGuild(target.id, guildId);
            const targetToken = await generateToken(target.id);
            assert.ok(targetToken, "target token generation should return a bearer token");
            guildEvents = await captureEvents(guildId);

            const publicUser = await assertJsonObject(await getJson(`${api.apiBaseUrl}/users/${target.id}`, ownerToken));
            assert.equal(publicUser.id, target.id);
            assert.equal(publicUser.username, target.username);
            assert.equal("email" in publicUser, false);

            const publicProfile = await assertJsonObject(await getJson(`${api.apiBaseUrl}/users/${target.id}/profile?with_mutual_guilds=true`, ownerToken));
            assert.equal((publicProfile.user as Record<string, unknown>).id, target.id);
            assert.deepEqual(publicProfile.badges, []);
            assert.equal(typeof publicProfile.user_profile, "object");

            const dm = await postJson(`${api.apiBaseUrl}/users/@me/channels`, { recipient_id: target.id }, ownerToken);
            await assertStatus(dm, 200);
            const dmBody = await assertJsonObject(dm);
            const dmId = dmBody.id as string;
            assert.equal(dmBody.type, ChannelType.DM);
            await ownerEvents.waitFor((event) => event.event === "CHANNEL_CREATE" && event.user_id === owner.id && event.data.id === dmId, eventTimeoutMs);
            assert.equal((await Channel.findOneByOrFail({ id: dmId })).type, ChannelType.DM);
            assert.equal(await Recipient.countBy({ channel_id: dmId }), 2);

            const groupDm = await postJson(`${api.apiBaseUrl}/users/@me/channels`, { recipients: [target.id, groupTarget.id], name: "scenario group" }, ownerToken);
            await assertStatus(groupDm, 200);
            const groupDmBody = await assertJsonObject(groupDm);
            assert.equal(groupDmBody.type, ChannelType.GROUP_DM);
            assert.equal(await Recipient.countBy({ channel_id: groupDmBody.id as string }), 3);

            const userChannels = await getJsonArray(`${api.apiBaseUrl}/users/@me/channels`, ownerToken);
            assert.ok(userChannels.some((channel) => channel.id === dmId));

            const dmMessages = await getJsonArray(`${api.apiBaseUrl}/users/${target.id}/messages?limit=5`, ownerToken);
            assert.deepEqual(dmMessages, []);

            const guilds = await getJsonArray(`${api.apiBaseUrl}/users/@me/guilds`, ownerToken);
            assert.ok(guilds.some((guild) => guild.id === guildId));

            const guildSettings = await assertJsonObject(await getJson(`${api.apiBaseUrl}/users/@me/guilds/${guildId}/settings`, ownerToken));
            assert.equal(guildSettings.guild_id, null);
            assert.equal(guildSettings.muted, false);

            const patchedGuildSettings = await patchJson(
                `${api.apiBaseUrl}/users/@me/guilds/${guildId}/settings`,
                {
                    muted: true,
                    suppress_everyone: true,
                    mobile_push: false,
                },
                ownerToken,
            );
            await assertStatus(patchedGuildSettings, 200);
            const patchedGuildSettingsBody = await assertJsonObject(patchedGuildSettings);
            assert.equal(patchedGuildSettingsBody.muted, true);
            assert.equal(patchedGuildSettingsBody.suppress_everyone, true);
            const persistedMemberSettings = await Member.findOneOrFail({
                where: { id: owner.id, guild_id: guildId },
                select: { id: true, guild_id: true, settings: true },
            });
            assert.equal(persistedMemberSettings.settings.muted, true);
            assert.equal(persistedMemberSettings.settings.mobile_push, false);

            await User.update({ id: target.id }, { rights: withoutSelfLeaveRight(target.rights) });
            const blockedLeaveGuild = await deleteJson(`${api.apiBaseUrl}/users/@me/guilds/${guildId}`, targetToken);
            await assertStatus(blockedLeaveGuild, 403);
            assert.notEqual(await Member.findOneBy({ id: target.id, guild_id: guildId }), null);
            assert.equal((await Guild.findOneByOrFail({ id: guildId })).member_count, 2);

            await Member.update({ id: target.id, guild_id: guildId }, { joined_by: owner.id });
            const leaveGuild = await deleteJson(`${api.apiBaseUrl}/users/@me/guilds/${guildId}`, targetToken);
            await assertStatus(leaveGuild, 204);
            await guildEvents.waitFor((event) => event.event === "GUILD_MEMBER_REMOVE" && event.guild_id === guildId && event.data.user.id === target.id, eventTimeoutMs);
            assert.equal(await Member.findOneBy({ id: target.id, guild_id: guildId }), null);
            assert.equal((await Guild.findOneByOrFail({ id: guildId })).member_count, 1);

            await assertArrayResponse(`${api.apiBaseUrl}/users/@me/activities/statistics/applications`, ownerToken);
            assert.deepEqual(await assertJsonObject(await getJson(`${api.apiBaseUrl}/users/@me/affinities/guilds`, ownerToken)), { guild_affinities: [] });
            assert.deepEqual(await assertJsonObject(await getJson(`${api.apiBaseUrl}/users/@me/affinities/users`, ownerToken)), {
                user_affinities: [],
                inverse_user_affinities: [],
            });
            await assertArrayResponse(`${api.apiBaseUrl}/users/@me/applications/100000000000000001/entitlements`, ownerToken);
            assert.deepEqual(await assertJsonObject(await getJson(`${api.apiBaseUrl}/users/@me/billing/country-code`, ownerToken)), {});
            assert.deepEqual(await assertJsonObject(await getJson(`${api.apiBaseUrl}/users/@me/billing/location-info`, ownerToken)), {});
            await assertArrayResponse(`${api.apiBaseUrl}/users/@me/billing/subscriptions`, ownerToken);
            await assertArrayResponse(`${api.apiBaseUrl}/users/@me/collectibles-purchases`, ownerToken);
            assert.deepEqual(await assertJsonObject(await getJson(`${api.apiBaseUrl}/users/@me/collectibles-marketing`, ownerToken)), { marketings: {} });
            assert.deepEqual(await assertJsonObject(await getJson(`${api.apiBaseUrl}/users/@me/email-settings`, ownerToken)), {
                categories: {
                    social: true,
                    communication: true,
                    tips: false,
                    updates_and_announcements: false,
                    recommendations_and_events: false,
                },
                initialized: false,
            });
            await assertArrayResponse(`${api.apiBaseUrl}/users/@me/entitlements/gifts`, ownerToken);
            await assertArrayResponse(`${api.apiBaseUrl}/users/@me/guilds/premium/subscription-slots`, ownerToken);
            await assertArrayResponse(`${api.apiBaseUrl}/users/@me/library`, ownerToken);

            const paymentSources = await getJsonArray(`${api.apiBaseUrl}/users/@me/billing/payment-sources`, ownerToken);
            assert.equal(paymentSources.length, 1);
            assert.equal((paymentSources[0].billing_address as Record<string, unknown>).country, "US");
            const createdPaymentSource = await assertJsonObject(await postJson(`${api.apiBaseUrl}/users/@me/billing/payment-sources`, {}, ownerToken));
            const paymentSourceId = createdPaymentSource.id as string;
            assert.equal(createdPaymentSource.brand, "visa");
            assert.equal((await assertJsonObject(await getJson(`${api.apiBaseUrl}/users/@me/billing/payment-sources/${paymentSourceId}`, ownerToken))).id, paymentSourceId);
            assert.equal((await assertJsonObject(await patchJson(`${api.apiBaseUrl}/users/@me/billing/payment-sources/${paymentSourceId}`, {}, ownerToken))).id, paymentSourceId);
            await assertStatus(await deleteJson(`${api.apiBaseUrl}/users/@me/billing/payment-sources/${paymentSourceId}`, ownerToken), 204);

            await assertSettingsProtoRoutes(api.apiBaseUrl, ownerToken, owner.id, ownerEvents);

            const patchedProfile = await patchJson(
                `${api.apiBaseUrl}/users/${owner.id}/profile`,
                {
                    bio: "supplemental profile bio",
                    accent_color: 12345,
                    pronouns: "they/them",
                    theme_colors: [111, 222],
                },
                ownerToken,
            );
            await assertStatus(patchedProfile, 200);
            const patchedProfileBody = await assertJsonObject(patchedProfile);
            assert.equal(patchedProfileBody.bio, "supplemental profile bio");
            assert.equal(patchedProfileBody.pronouns, "they/them");
            const persistedProfile = await User.findOneOrFail({
                where: { id: owner.id },
                select: { id: true, bio: true, accent_color: true, pronouns: true },
            });
            assert.equal(persistedProfile.bio, "supplemental profile bio");
            assert.equal(persistedProfile.accent_color, 12345);

            await assertStatus(await postJson(`${api.apiBaseUrl}/users/@me/devices`, {}, ownerToken), 204);

            const disablePassword = "disable-password-42";
            const disableUser = await registerLoginCapableUser(`disable${suffix.slice(-8)}`, `users-disable-${suffix}@example.com`, disablePassword);
            const disableToken = await generateToken(disableUser.id);
            assert.ok(disableToken, "disable token generation should return a bearer token");
            await assertStatus(await postJson(`${api.apiBaseUrl}/users/@me/disable`, { password: disablePassword }, disableToken), 204);
            assert.equal((await User.findOneByOrFail({ id: disableUser.id })).disabled, true);

            const selfDeletePassword = "delete-password-42";
            const selfDeleteUser = await registerLoginCapableUser(`selfdelete${suffix.slice(-8)}`, `users-self-delete-${suffix}@example.com`, selfDeletePassword);
            const selfDeleteToken = await generateToken(selfDeleteUser.id);
            assert.ok(selfDeleteToken, "self-delete token generation should return a bearer token");
            await assertStatus(await postJson(`${api.apiBaseUrl}/users/@me/delete`, { password: selfDeletePassword }, selfDeleteToken), 204);
            assert.equal(await User.findOneBy({ id: selfDeleteUser.id }), null);

            const admin = await registerUser(`admin${suffix.slice(-8)}`, `users-admin-${suffix}@example.com`);
            await User.update({ id: admin.id }, { rights: "1" });
            const adminToken = await generateToken(admin.id);
            assert.ok(adminToken, "admin token generation should return a bearer token");
            const victim = await registerUser(`victim${suffix.slice(-8)}`, `users-victim-${suffix}@example.com`);
            await Member.addToGuild(victim.id, guildId);
            adminEvents = await captureEvents(admin.id);
            const instanceDelete = await postJson(`${api.apiBaseUrl}/users/${victim.id}/delete`, { reason: "scenario instance delete" }, adminToken);
            await assertStatus(instanceDelete, 204);
            await adminEvents.waitFor((event) => event.event === "USER_DELETE" && event.user_id === admin.id && event.data.user_id === victim.id, eventTimeoutMs);
            assert.equal(await User.findOneBy({ id: victim.id }), null);
            assert.equal(await Member.findOneBy({ id: victim.id, guild_id: guildId }), null);
            assert.equal((await InstanceBan.findOneByOrFail({ user_id: victim.id })).reason, "scenario instance delete");
        } finally {
            if (adminEvents) await adminEvents.stop();
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

async function assertSettingsProtoRoutes(apiBaseUrl: string, token: string, userId: string, events: Awaited<ReturnType<typeof captureEvents>> | undefined) {
    const getProto1 = await assertJsonObject(await getJson(`${apiBaseUrl}/users/@me/settings-proto/1`, token));
    assert.equal(typeof getProto1.settings, "string");
    const preloadedUpdate = PreloadedUserSettings.create({ versions: { clientVersion: 1, dataVersion: 0, serverVersion: 0 } });
    const patchProto1 = await assertJsonObject(
        await patchJson(
            `${apiBaseUrl}/users/@me/settings-proto/1`,
            {
                settings: PreloadedUserSettings.toBase64(preloadedUpdate),
            },
            token,
        ),
    );
    assert.equal(typeof patchProto1.settings, "string");
    await events?.waitFor((event) => event.event === "USER_SETTINGS_PROTO_UPDATE" && event.user_id === userId && event.data.settings.type === 1, eventTimeoutMs);

    const getProtoJson1 = await assertJsonObject(await getJson(`${apiBaseUrl}/users/@me/settings-proto/1/json`, token));
    assert.equal(typeof getProtoJson1.settings, "object");
    const patchProtoJson1 = await assertJsonObject(
        await patchJson(
            `${apiBaseUrl}/users/@me/settings-proto/1/json?atomic=true`,
            {
                settings: PreloadedUserSettings.toJson(PreloadedUserSettings.create({ versions: { clientVersion: 2 } })),
            },
            token,
        ),
    );
    assert.equal(typeof patchProtoJson1.settings, "object");

    const getProto2 = await assertJsonObject(await getJson(`${apiBaseUrl}/users/@me/settings-proto/2`, token));
    assert.equal(typeof getProto2.settings, "string");
    const frecencyUpdate = FrecencyUserSettings.create({ versions: { clientVersion: 3, dataVersion: 0, serverVersion: 0 } });
    const patchProto2 = await assertJsonObject(
        await patchJson(
            `${apiBaseUrl}/users/@me/settings-proto/2`,
            {
                settings: FrecencyUserSettings.toBase64(frecencyUpdate),
            },
            token,
        ),
    );
    assert.equal(typeof patchProto2.settings, "string");
    await events?.waitFor((event) => event.event === "USER_SETTINGS_PROTO_UPDATE" && event.user_id === userId && event.data.settings.type === 2, eventTimeoutMs);

    const getProtoJson2 = await assertJsonObject(await getJson(`${apiBaseUrl}/users/@me/settings-proto/2/json`, token));
    assert.equal(typeof getProtoJson2.settings, "object");
    const patchProtoJson2 = await assertJsonObject(
        await patchJson(
            `${apiBaseUrl}/users/@me/settings-proto/2/json?atomic=true`,
            {
                settings: FrecencyUserSettings.toJson(FrecencyUserSettings.create({ versions: { clientVersion: 4 } })),
            },
            token,
        ),
    );
    assert.equal(typeof patchProtoJson2.settings, "object");

    const persisted = await UserSettingsProtos.findOneByOrFail({ user_id: userId });
    assert.ok((persisted.userSettings?.versions?.dataVersion ?? 0) >= 1);
    assert.ok((persisted.frecencySettings?.versions?.dataVersion ?? 0) >= 1);
}

async function assertArrayResponse(url: string, token: string) {
    const response = await getJson(url, token);
    await assertStatus(response, 200);
    const body = await response.json();
    assert.ok(Array.isArray(body));
    return body as Array<Record<string, unknown>>;
}

async function registerUser(username: string, email: string) {
    return await User.register({
        username,
        email,
        password: "not-a-real-login-hash",
    });
}

async function registerLoginCapableUser(username: string, email: string, password: string) {
    return await User.register({
        username,
        email,
        password: await bcrypt.hash(password, 12),
    });
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

function withoutSelfLeaveRight(rights: string) {
    return (BigInt(rights) & ~Rights.FLAGS.SELF_LEAVE_GROUPS).toString();
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
