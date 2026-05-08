import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { AutomodRule, Ban, Channel, closeDatabase, Config, generateToken, Guild, initDatabase, Invite, Member, Message, Snowflake, User, VoiceState } from "@spacebar/util";
import { ChannelType } from "@spacebar/schemas";
import { assertJsonError, assertJsonObject, assertStatus } from "../assertions/http";
import { createDisposablePostgresDatabase, hasPostgresAdminUrl } from "../fixtures/database";
import { captureEvents } from "../fixtures/events";
import { startApi } from "../server/startApi";

const coveredManifestIds = [
    "api:http:DELETE:/guilds/:guild_id/auto-moderation/rules/:rule_id",
    "api:http:GET:/guilds/:guild_id/auto-moderation/rules/",
    "api:http:GET:/guilds/:guild_id/discovery-requirements/",
    "api:http:GET:/guilds/:guild_id/integrations/",
    "api:http:GET:/guilds/:guild_id/invites/",
    "api:http:GET:/guilds/:guild_id/member-verification/",
    "api:http:GET:/guilds/:guild_id/messages/search/",
    "api:http:GET:/guilds/:guild_id/premium/subscriptions",
    "api:http:GET:/guilds/:guild_id/profile/",
    "api:http:GET:/guilds/:guild_id/prune/",
    "api:http:GET:/guilds/:guild_id/regions/",
    "api:http:GET:/guilds/:guild_id/vanity-url/",
    "api:http:GET:/guilds/:guild_id/widget.png/",
    "api:http:PATCH:/guilds/:guild_id/auto-moderation/rules/:rule_id",
    "api:http:PATCH:/guilds/:guild_id/profile/:member_id",
    "api:http:PATCH:/guilds/:guild_id/vanity-url/",
    "api:http:PATCH:/guilds/:guild_id/voice-states/:user_id/",
    "api:http:POST:/guilds/:guild_id/auto-moderation/rules/",
    "api:http:POST:/guilds/:guild_id/bulk-ban/",
    "api:http:POST:/guilds/:guild_id/prune/",
    "api:http:POST:/guilds/automations/email-domain-lookup/",
    "api:http:POST:/guilds/automations/email-domain-lookup/verify-code",
];
const eventTimeoutMs = 1000;

test(
    "guild admin supplemental routes persist automod, moderation, discovery, vanity, profile, prune, and voice state",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 180_000,
    },
    async () => {
        assert.deepEqual(coveredManifestIds, [
            "api:http:DELETE:/guilds/:guild_id/auto-moderation/rules/:rule_id",
            "api:http:GET:/guilds/:guild_id/auto-moderation/rules/",
            "api:http:GET:/guilds/:guild_id/discovery-requirements/",
            "api:http:GET:/guilds/:guild_id/integrations/",
            "api:http:GET:/guilds/:guild_id/invites/",
            "api:http:GET:/guilds/:guild_id/member-verification/",
            "api:http:GET:/guilds/:guild_id/messages/search/",
            "api:http:GET:/guilds/:guild_id/premium/subscriptions",
            "api:http:GET:/guilds/:guild_id/profile/",
            "api:http:GET:/guilds/:guild_id/prune/",
            "api:http:GET:/guilds/:guild_id/regions/",
            "api:http:GET:/guilds/:guild_id/vanity-url/",
            "api:http:GET:/guilds/:guild_id/widget.png/",
            "api:http:PATCH:/guilds/:guild_id/auto-moderation/rules/:rule_id",
            "api:http:PATCH:/guilds/:guild_id/profile/:member_id",
            "api:http:PATCH:/guilds/:guild_id/vanity-url/",
            "api:http:PATCH:/guilds/:guild_id/voice-states/:user_id/",
            "api:http:POST:/guilds/:guild_id/auto-moderation/rules/",
            "api:http:POST:/guilds/:guild_id/bulk-ban/",
            "api:http:POST:/guilds/:guild_id/prune/",
            "api:http:POST:/guilds/automations/email-domain-lookup/",
            "api:http:POST:/guilds/automations/email-domain-lookup/verify-code",
        ]);

        const database = await createDisposablePostgresDatabase({ prefix: "spacebar_guilds_admin_supplemental" });
        const tempCwd = await mkdtemp(path.join(tmpdir(), "spacebar-guilds-admin-supplemental-"));
        const previous = snapshotProcessState();
        let api: Awaited<ReturnType<typeof startApi>> | undefined;
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
            const owner = await registerUser(`guildadminowner${suffix.slice(-8)}`, `guild-admin-owner-${suffix}@example.com`);
            const ownerToken = await generateToken(owner.id);
            assert.ok(ownerToken, "owner token generation should return a bearer token");

            const createdGuild = await postJson(`${api.apiBaseUrl}/guilds`, { name: `admin-supp-${suffix.slice(-8)}` }, ownerToken);
            await assertStatus(createdGuild, 201);
            const guildId = (await assertJsonObject(createdGuild)).id as string;
            const [generalChannel] = await getJsonArray(`${api.apiBaseUrl}/guilds/${guildId}/channels`, ownerToken);
            const channelId = generalChannel.id as string;
            guildEvents = await captureEvents(guildId);

            await coverAutomodRoutes(api.apiBaseUrl, guildId, ownerToken, owner.id);
            await coverGuildReadOnlyAndStubRoutes(api.apiBaseUrl, guildId, ownerToken);
            await coverGuildMessagesSearch(api.apiBaseUrl, guildId, channelId, ownerToken);
            await coverVanityAndInvites(api.apiBaseUrl, guildId, channelId, ownerToken, suffix);
            await coverMemberProfile(api.apiBaseUrl, guildId, ownerToken, owner.id, guildEvents);
            await coverBulkBan(api.apiBaseUrl, guildId, ownerToken, owner.id, guildEvents, suffix);
            await coverVoiceState(api.apiBaseUrl, guildId, ownerToken, owner.id, guildEvents);
            await coverPrune(api.apiBaseUrl, guildId, ownerToken, suffix);
            await coverEmailDomainLookup(api.apiBaseUrl, ownerToken, guildId);
        } finally {
            if (guildEvents) await guildEvents.stop();
            if (api) await api.stop();
            await closeDatabase();
            await database.close();
            restoreProcessState(previous);
            await rm(tempCwd, { recursive: true, force: true });
        }
    },
);

async function coverAutomodRoutes(apiBaseUrl: string, guildId: string, token: string, ownerId: string) {
    const createRule = await postJson(
        `${apiBaseUrl}/guilds/${guildId}/auto-moderation/rules`,
        {
            name: "scenario keyword block",
            event_type: 1,
            trigger_type: 1,
            actions: [{ type: 1 }],
            trigger_metadata: {
                allow_list: [],
                keyword_filter: ["blocked"],
                regex_patterns: [],
            },
        },
        token,
    );
    await assertStatus(createRule, 200);
    const createRuleBody = await assertJsonObject(createRule);
    const ruleId = createRuleBody.id as string;
    assert.equal(createRuleBody.creator_id, ownerId);
    assert.equal(createRuleBody.guild_id, guildId);
    assert.equal(createRuleBody.position, 0);
    assert.equal((await AutomodRule.findOneByOrFail({ guild_id: guildId, id: ruleId })).name, "scenario keyword block");

    const rules = await getJsonArray(`${apiBaseUrl}/guilds/${guildId}/auto-moderation/rules`, token);
    assert.deepEqual(
        rules.map((rule) => rule.id),
        [ruleId],
    );

    const patchRule = await patchJson(`${apiBaseUrl}/guilds/${guildId}/auto-moderation/rules/${ruleId}`, { name: "scenario keyword block updated", enabled: true }, token);
    await assertStatus(patchRule, 200);
    const patchRuleBody = await assertJsonObject(patchRule);
    assert.equal(patchRuleBody.name, "scenario keyword block updated");
    assert.equal(patchRuleBody.enabled, true);
    assert.equal((await AutomodRule.findOneByOrFail({ guild_id: guildId, id: ruleId })).enabled, true);

    await assertStatus(await deleteJson(`${apiBaseUrl}/guilds/${guildId}/auto-moderation/rules/${ruleId}`, token), 204);
    assert.equal(await AutomodRule.findOneBy({ guild_id: guildId, id: ruleId }), null);
}

async function coverGuildReadOnlyAndStubRoutes(apiBaseUrl: string, guildId: string, token: string) {
    const discovery = await assertJsonObject(await getJson(`${apiBaseUrl}/guilds/${guildId}/discovery-requirements`, token));
    assert.equal(discovery.guild_id, guildId);
    assert.equal(discovery.sufficient, true);
    assert.deepEqual(await getJsonArray(`${apiBaseUrl}/guilds/${guildId}/integrations`, token), []);
    assert.deepEqual(await getJsonArray(`${apiBaseUrl}/guilds/${guildId}/premium/subscriptions`, token), []);
    await assertJsonError(await getJson(`${apiBaseUrl}/guilds/${guildId}/member-verification`, token), 404);

    const profile = await assertJsonObject(await getJson(`${apiBaseUrl}/guilds/${guildId}/profile`, token));
    assert.equal(profile.id, guildId);
    assert.equal(profile.name, (await Guild.findOneByOrFail({ id: guildId })).name);

    const regions = await getJsonArray(`${apiBaseUrl}/guilds/${guildId}/regions`, token);
    assert.ok(regions.length > 0);

    await Guild.update({ id: guildId }, { widget_enabled: true });
    await assertJsonError(await getJson(`${apiBaseUrl}/guilds/${guildId}/widget.png?style=invalid`, token), 400);
}

async function coverGuildMessagesSearch(apiBaseUrl: string, guildId: string, channelId: string, token: string) {
    const createMessage = await postJson(`${apiBaseUrl}/channels/${channelId}/messages`, { content: "guild admin supplemental search marker" }, token);
    await assertStatus(createMessage, 200);
    const messageId = (await assertJsonObject(createMessage)).id as string;
    assert.equal((await Message.findOneByOrFail({ id: messageId })).guild_id, guildId);

    const search = await assertJsonObject(await getJson(`${apiBaseUrl}/guilds/${guildId}/messages/search?content=search%20marker&channel_id=${channelId}`, token));
    assert.equal(search.total_results, 1);
    const messages = search.messages as Array<Array<Record<string, unknown>>>;
    assert.equal(messages[0][0].id, messageId);
}

async function coverVanityAndInvites(apiBaseUrl: string, guildId: string, channelId: string, token: string, suffix: string) {
    await Guild.update({ id: guildId }, { features: ["VANITY_URL"] });

    const emptyVanity = await assertJsonObject(await getJson(`${apiBaseUrl}/guilds/${guildId}/vanity-url`, token));
    assert.equal(emptyVanity.code, null);

    const code = `scenario${suffix.slice(-8)}`.toLowerCase();
    const patchVanity = await patchJson(`${apiBaseUrl}/guilds/${guildId}/vanity-url`, { code }, token);
    await assertStatus(patchVanity, 200);
    assert.equal((await assertJsonObject(patchVanity)).code, code);
    const invite = await Invite.findOneByOrFail({ guild_id: guildId, channel_id: channelId, vanity_url: true });
    assert.equal(invite.code, code);

    const vanity = await assertJsonObject(await getJson(`${apiBaseUrl}/guilds/${guildId}/vanity-url`, token));
    assert.equal(vanity.code, code);
    assert.equal(vanity.uses, 0);

    const invites = await getJsonArray(`${apiBaseUrl}/guilds/${guildId}/invites`, token);
    assert.ok(invites.some((candidate) => candidate.code === code));
}

async function coverMemberProfile(apiBaseUrl: string, guildId: string, token: string, ownerId: string, events: Awaited<ReturnType<typeof captureEvents>>) {
    const profile = await patchJson(
        `${apiBaseUrl}/guilds/${guildId}/profile/@me`,
        {
            bio: "guild-specific supplemental bio",
            pronouns: "they/them",
            theme_colors: [101, 202],
        },
        token,
    );
    await assertStatus(profile, 200);
    const profileBody = await assertJsonObject(profile);
    assert.equal(profileBody.bio, "guild-specific supplemental bio");
    assert.equal(profileBody.pronouns, "they/them");
    const persisted = await Member.findOneOrFail({
        where: { guild_id: guildId, id: ownerId },
        select: { id: true, guild_id: true, bio: true, pronouns: true, theme_colors: true },
    });
    assert.equal(persisted.bio, "guild-specific supplemental bio");
    assert.deepEqual(persisted.theme_colors, [101, 202]);

    await events.waitFor((event) => event.event === "GUILD_MEMBER_UPDATE" && event.guild_id === guildId && event.data.user.id === ownerId, eventTimeoutMs);
}

async function coverBulkBan(apiBaseUrl: string, guildId: string, token: string, ownerId: string, events: Awaited<ReturnType<typeof captureEvents>>, suffix: string) {
    const target = await registerUser(`bulkban${suffix.slice(-8)}`, `bulk-ban-${suffix}@example.com`);
    await Member.addToGuild(target.id, guildId);

    const bulkBan = await postJson(
        `${apiBaseUrl}/guilds/${guildId}/bulk-ban`,
        {
            user_ids: [target.id, ownerId],
            delete_message_seconds: 60,
        },
        token,
    );
    await assertStatus(bulkBan, 200);
    const bulkBanBody = await assertJsonObject(bulkBan);
    assert.deepEqual(bulkBanBody.banned_users, [target.id]);
    assert.deepEqual(bulkBanBody.failed_users, [ownerId]);
    await events.waitFor((event) => event.event === "GUILD_BAN_ADD" && event.guild_id === guildId && event.data.user.id === target.id, eventTimeoutMs);
    assert.notEqual(await Ban.findOneBy({ guild_id: guildId, user_id: target.id }), null);
    assert.equal(await Member.findOneBy({ guild_id: guildId, id: target.id }), null);
}

async function coverVoiceState(apiBaseUrl: string, guildId: string, token: string, ownerId: string, events: Awaited<ReturnType<typeof captureEvents>>) {
    const createStage = await postJson(`${apiBaseUrl}/guilds/${guildId}/channels`, { name: "scenario-stage", type: ChannelType.GUILD_STAGE_VOICE }, token);
    await assertStatus(createStage, 201);
    const stageId = (await assertJsonObject(createStage)).id as string;
    assert.equal((await Channel.findOneByOrFail({ id: stageId })).type, ChannelType.GUILD_STAGE_VOICE);

    await VoiceState.create({
        guild_id: guildId,
        channel_id: stageId,
        user_id: ownerId,
        session_id: `scenario-voice-${Snowflake.generate()}`,
        token: `scenario-voice-token-${Snowflake.generate()}`,
        deaf: false,
        mute: false,
        self_deaf: false,
        self_mute: false,
        self_video: false,
        suppress: false,
    }).save();

    await assertStatus(
        await patchJson(`${apiBaseUrl}/guilds/${guildId}/voice-states/@me`, { channel_id: stageId, self_mute: false, self_deaf: false, suppress: true }, token),
        204,
    );
    await events.waitFor(
        (event) => event.event === "VOICE_STATE_UPDATE" && event.guild_id === guildId && event.data.user_id === ownerId && event.data.suppress === true,
        eventTimeoutMs,
    );
    assert.equal((await VoiceState.findOneByOrFail({ guild_id: guildId, channel_id: stageId, user_id: ownerId })).suppress, true);
}

async function coverPrune(apiBaseUrl: string, guildId: string, token: string, suffix: string) {
    const activeMember = await Member.findOneOrFail({ where: { guild_id: guildId }, order: { joined_at: "ASC" } });
    await Member.update({ id: activeMember.id, guild_id: guildId }, { last_message_id: Snowflake.generate() });

    const pruneTarget = await registerUser(`prune${suffix.slice(-8)}`, `prune-${suffix}@example.com`);
    await Member.addToGuild(pruneTarget.id, guildId);

    const pruneCount = await assertJsonObject(await getJson(`${apiBaseUrl}/guilds/${guildId}/prune?days=7`, token));
    assert.equal(pruneCount.pruned, 1);

    const prune = await postJson(`${apiBaseUrl}/guilds/${guildId}/prune`, { days: 7 }, token);
    await assertStatus(prune, 200);
    assert.equal((await assertJsonObject(prune)).purged, 1);
    assert.equal(await Member.findOneBy({ guild_id: guildId, id: pruneTarget.id }), null);
}

async function coverEmailDomainLookup(apiBaseUrl: string, token: string, guildId: string) {
    const lookup = await postJson(
        `${apiBaseUrl}/guilds/automations/email-domain-lookup`,
        {
            email: "student@university.example",
            allow_multiple_guilds: false,
            use_verification_code: true,
        },
        token,
    );
    await assertStatus(lookup, 200);
    assert.deepEqual(await assertJsonObject(lookup), { guilds_info: [], has_matching_guild: false });

    await assertJsonError(
        await postJson(
            `${apiBaseUrl}/guilds/automations/email-domain-lookup/verify-code`,
            {
                email: "student@university.example",
                guild_id: guildId,
                code: "123456",
            },
            token,
        ),
        501,
    );
}

async function registerUser(username: string, email: string) {
    return await User.register({
        username,
        email,
        password: "not-a-real-login-hash",
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
