import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { Channel, closeDatabase, Config, generateToken, Guild, initDatabase, Member, Message, Tag, ThreadMember, ThreadMemberFlags, User } from "@spacebar/util";
import { ChannelPermissionOverwriteType, ChannelType } from "@spacebar/schemas";
import { assertJsonObject, assertStatus } from "../assertions/http";
import { createDisposablePostgresDatabase, hasPostgresAdminUrl } from "../fixtures/database";
import { captureEvents } from "../fixtures/events";
import { startApi } from "../server/startApi";

type EventCapture = Awaited<ReturnType<typeof captureEvents>>;
type CapturedEvent = EventCapture["events"][number];

const coveredManifestIds = [
    "api:http:DELETE:/channels/:channel_id/permissions/:overwrite_id",
    "api:http:DELETE:/channels/:channel_id/tags/:tag_id",
    "api:http:DELETE:/channels/:channel_id/thread-members/:user_id",
    "api:http:GET:/channels/:channel_id/thread-members/",
    "api:http:GET:/channels/:channel_id/thread-members/:user_id",
    "api:http:GET:/channels/:channel_id/threads/archived/private",
    "api:http:GET:/channels/:channel_id/threads/archived/public/",
    "api:http:GET:/channels/:channel_id/threads/search",
    "api:http:GET:/channels/:channel_id/users/@me/threads/archived/private/",
    "api:http:PATCH:/channels/:channel_id/thread-members/@me/settings",
    "api:http:POST:/channels/:channel_id/messages/:message_id/threads/",
    "api:http:POST:/channels/:channel_id/tags/",
    "api:http:POST:/channels/:channel_id/thread-members/:user_id",
    "api:http:POST:/channels/:channel_id/threads/",
    "api:http:PUT:/channels/:channel_id/permissions/:overwrite_id",
    "api:http:PUT:/channels/:channel_id/tags/:tag_id",
    "api:http:PUT:/channels/:channel_id/thread-members/:user_id",
];
const eventTimeoutMs = 1000;

test(
    "channel thread, tag, permission, and thread-member routes persist state and emit events",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 180_000,
    },
    async () => {
        assert.deepEqual(coveredManifestIds, [
            "api:http:DELETE:/channels/:channel_id/permissions/:overwrite_id",
            "api:http:DELETE:/channels/:channel_id/tags/:tag_id",
            "api:http:DELETE:/channels/:channel_id/thread-members/:user_id",
            "api:http:GET:/channels/:channel_id/thread-members/",
            "api:http:GET:/channels/:channel_id/thread-members/:user_id",
            "api:http:GET:/channels/:channel_id/threads/archived/private",
            "api:http:GET:/channels/:channel_id/threads/archived/public/",
            "api:http:GET:/channels/:channel_id/threads/search",
            "api:http:GET:/channels/:channel_id/users/@me/threads/archived/private/",
            "api:http:PATCH:/channels/:channel_id/thread-members/@me/settings",
            "api:http:POST:/channels/:channel_id/messages/:message_id/threads/",
            "api:http:POST:/channels/:channel_id/tags/",
            "api:http:POST:/channels/:channel_id/thread-members/:user_id",
            "api:http:POST:/channels/:channel_id/threads/",
            "api:http:PUT:/channels/:channel_id/permissions/:overwrite_id",
            "api:http:PUT:/channels/:channel_id/tags/:tag_id",
            "api:http:PUT:/channels/:channel_id/thread-members/:user_id",
        ]);

        const database = await createDisposablePostgresDatabase({ prefix: "spacebar_channels_threads" });
        const tempCwd = await mkdtemp(path.join(tmpdir(), "spacebar-channels-threads-"));
        const previous = snapshotProcessState();
        let api: Awaited<ReturnType<typeof startApi>> | undefined;
        let events: EventCapture | undefined;

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
            const owner = await registerUser(`threadowner${suffix.slice(-8)}`, `thread-owner-${suffix}@example.com`);
            const member = await registerUser(`threadmember${suffix.slice(-8)}`, `thread-member-${suffix}@example.com`);
            const ownerToken = await generateToken(owner.id);
            const memberToken = await generateToken(member.id);
            assert.ok(ownerToken, "owner token generation should return a bearer token");
            assert.ok(memberToken, "member token generation should return a bearer token");

            const createdGuild = await postJson(`${api.apiBaseUrl}/guilds`, { name: `threads-${suffix.slice(-8)}` }, ownerToken);
            await assertStatus(createdGuild, 201);
            const guildId = (await assertJsonObject(createdGuild)).id as string;
            await Guild.update({ id: guildId }, { features: ["DISCOVERABLE"] });
            await assertStatus(await putJson(`${api.apiBaseUrl}/guilds/${guildId}/members/@me`, {}, memberToken), 200);

            const initialChannels = await getJsonArray(`${api.apiBaseUrl}/guilds/${guildId}/channels`, ownerToken);
            const textChannelId = initialChannels[0].id as string;
            const forumChannelId = await createForumChannel(api.apiBaseUrl, guildId, ownerToken);
            events = await captureEvents([guildId, textChannelId, forumChannelId, owner.id, member.id]);

            await coverPermissionOverwriteRoutes(api.apiBaseUrl, textChannelId, guildId, ownerToken, events);
            const tagId = await coverTagCreateAndUpdate(api.apiBaseUrl, forumChannelId, ownerToken, events);
            await coverThreadRoutes(api.apiBaseUrl, guildId, textChannelId, forumChannelId, tagId, owner.id, member.id, ownerToken, events);
            await coverTagDelete(api.apiBaseUrl, forumChannelId, tagId, ownerToken, events);
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

async function coverPermissionOverwriteRoutes(apiBaseUrl: string, channelId: string, guildId: string, token: string, events: EventCapture) {
    const beforePut = markCapturedEvents(events);
    await assertStatus(
        await putJson(`${apiBaseUrl}/channels/${channelId}/permissions/${guildId}`, { id: guildId, type: ChannelPermissionOverwriteType.role, allow: "1024", deny: "2048" }, token),
        204,
    );
    await waitForEventAfter(
        events,
        beforePut,
        (event) => event.event === "CHANNEL_UPDATE" && event.channel_id === channelId && hasOverwrite(event.data.permission_overwrites, guildId),
    );
    let channel = await Channel.findOneByOrFail({ id: channelId });
    assert.ok(channel.permission_overwrites?.some((overwrite) => overwrite.id === guildId));

    const beforeDelete = markCapturedEvents(events);
    await assertStatus(await deleteJson(`${apiBaseUrl}/channels/${channelId}/permissions/${guildId}`, token), 204);
    await waitForEventAfter(
        events,
        beforeDelete,
        (event) => event.event === "CHANNEL_UPDATE" && event.channel_id === channelId && !hasOverwrite(event.data.permission_overwrites, guildId),
    );
    channel = await Channel.findOneByOrFail({ id: channelId });
    assert.equal(
        channel.permission_overwrites?.some((overwrite) => overwrite.id === guildId),
        false,
    );
}

async function coverTagCreateAndUpdate(apiBaseUrl: string, forumChannelId: string, token: string, events: EventCapture) {
    const beforeCreate = markCapturedEvents(events);
    const createTag = await postJson(`${apiBaseUrl}/channels/${forumChannelId}/tags`, { name: "scenario-tag", moderated: false }, token);
    await assertStatus(createTag, 200);
    const createBody = await assertJsonObject(createTag);
    const createdTags = createBody.available_tags as Array<Record<string, unknown>>;
    const tagId = createdTags.find((tag) => tag.name === "scenario-tag")?.id as string;
    assert.ok(tagId);
    await waitForEventAfter(
        events,
        beforeCreate,
        (event) => event.event === "CHANNEL_UPDATE" && event.channel_id === forumChannelId && hasTag(event.data.available_tags, tagId, "scenario-tag"),
    );
    assert.equal((await Tag.findOneByOrFail({ id: tagId })).name, "scenario-tag");

    const beforeUpdate = markCapturedEvents(events);
    const updateTag = await putJson(`${apiBaseUrl}/channels/${forumChannelId}/tags/${tagId}`, { name: "scenario-tag-updated", moderated: true }, token);
    await assertStatus(updateTag, 200);
    await waitForEventAfter(
        events,
        beforeUpdate,
        (event) => event.event === "CHANNEL_UPDATE" && event.channel_id === forumChannelId && hasTag(event.data.available_tags, tagId, "scenario-tag-updated"),
    );
    const persistedTag = await Tag.findOneByOrFail({ id: tagId });
    assert.equal(persistedTag.name, "scenario-tag-updated");
    assert.equal(persistedTag.moderated, true);
    return tagId;
}

async function coverThreadRoutes(
    apiBaseUrl: string,
    guildId: string,
    textChannelId: string,
    forumChannelId: string,
    tagId: string,
    ownerId: string,
    memberId: string,
    token: string,
    events: EventCapture,
) {
    const ownerMember = await Member.findOneByOrFail({ guild_id: guildId, id: ownerId });
    const joinedMember = await Member.findOneByOrFail({ guild_id: guildId, id: memberId });

    const publicThreadId = await createForumThread(apiBaseUrl, forumChannelId, tagId, token, events);
    await assertThreadMember(publicThreadId, ownerMember.index);
    await coverThreadSearch(apiBaseUrl, forumChannelId, publicThreadId, tagId, token);
    const publicThreadEvents = await captureEvents([publicThreadId, ownerId]);
    try {
        await coverThreadMemberRoutes(apiBaseUrl, publicThreadId, ownerMember.index, joinedMember.index, memberId, token, publicThreadEvents);
    } finally {
        await publicThreadEvents.stop();
    }

    await archiveThread(publicThreadId);
    const publicArchived = await assertJsonObject(await getJson(`${apiBaseUrl}/channels/${forumChannelId}/threads/archived/public?limit=10`, token));
    assert.ok((publicArchived.threads as Array<Record<string, unknown>>).some((thread) => thread.id === publicThreadId));
    assert.ok((publicArchived.members as Array<Record<string, unknown>>).some((member) => member.id === publicThreadId));

    const privateThreadId = await createPrivateThread(apiBaseUrl, textChannelId, token, events);
    await assertThreadMember(privateThreadId, ownerMember.index);
    await archiveThread(privateThreadId);
    const privateArchived = await assertJsonObject(await getJson(`${apiBaseUrl}/channels/${textChannelId}/threads/archived/private?limit=10`, token));
    assert.ok((privateArchived.threads as Array<Record<string, unknown>>).some((thread) => thread.id === privateThreadId));
    const joinedPrivateArchived = await assertJsonObject(await getJson(`${apiBaseUrl}/channels/${textChannelId}/users/@me/threads/archived/private?limit=10`, token));
    assert.ok((joinedPrivateArchived.threads as Array<Record<string, unknown>>).some((thread) => thread.id === privateThreadId));

    const messageId = await createMessage(apiBaseUrl, textChannelId, "message thread starter", token);
    const beforeMessageThread = markCapturedEvents(events);
    const createMessageThread = await postJson(`${apiBaseUrl}/channels/${textChannelId}/messages/${messageId}/threads`, { name: "scenario-message-thread" }, token);
    await assertStatus(createMessageThread, 200);
    const messageThreadBody = await assertJsonObject(createMessageThread);
    assert.equal(messageThreadBody.id, messageId);
    await waitForEventAfter(
        events,
        beforeMessageThread,
        (event) => event.event === "THREAD_CREATE" && event.channel_id === textChannelId && event.data.id === messageId && event.data.newly_created === true,
    );
    await waitForEventAfter(
        events,
        beforeMessageThread,
        (event) => event.event === "MESSAGE_UPDATE" && event.channel_id === textChannelId && event.data.id === messageId && event.data.thread.id === messageId,
    );
    await assertThreadMember(messageId, ownerMember.index);
    const message = await Message.findOneOrFail({ where: { id: messageId }, relations: { thread: true } });
    assert.ok(message.thread);
    assert.equal(message.thread.id, messageId);
}

async function createForumThread(apiBaseUrl: string, forumChannelId: string, tagId: string, token: string, events: EventCapture) {
    const beforeCreate = markCapturedEvents(events);
    const createThread = await postJson(
        `${apiBaseUrl}/channels/${forumChannelId}/threads`,
        {
            name: "scenario-forum-thread",
            applied_tags: [tagId],
            message: { content: "thread starter content" },
        },
        token,
    );
    await assertStatus(createThread, 200);
    const thread = await assertJsonObject(createThread);
    const threadId = thread.id as string;
    assert.equal(thread.parent_id, forumChannelId);
    assert.deepEqual(thread.applied_tags, [tagId]);
    await waitForEventAfter(
        events,
        beforeCreate,
        (event) => event.event === "THREAD_CREATE" && event.channel_id === forumChannelId && event.data.id === threadId && event.data.newly_created === true,
    );
    return threadId;
}

async function createPrivateThread(apiBaseUrl: string, textChannelId: string, token: string, events: EventCapture) {
    const beforeCreate = markCapturedEvents(events);
    const createThread = await postJson(
        `${apiBaseUrl}/channels/${textChannelId}/threads`,
        {
            name: "scenario-private-thread",
            type: ChannelType.GUILD_PRIVATE_THREAD,
        },
        token,
    );
    await assertStatus(createThread, 200);
    const thread = await assertJsonObject(createThread);
    const threadId = thread.id as string;
    assert.equal(thread.type, ChannelType.GUILD_PRIVATE_THREAD);
    await waitForEventAfter(
        events,
        beforeCreate,
        (event) => event.event === "THREAD_CREATE" && event.channel_id === textChannelId && event.data.id === threadId && event.data.newly_created === true,
    );
    return threadId;
}

async function coverThreadSearch(apiBaseUrl: string, forumChannelId: string, threadId: string, tagId: string, token: string) {
    const search = await assertJsonObject(
        await getJson(`${apiBaseUrl}/channels/${forumChannelId}/threads/search?name=scenario-forum&tag=${tagId}&tag_setting=match_all&archived=false`, token),
    );
    assert.equal(search.total_results, 1);
    assert.equal((search.threads as Array<Record<string, unknown>>)[0].id, threadId);
    assert.equal((search.first_messages as Array<Record<string, unknown>>)[0].id, threadId);
}

async function coverThreadMemberRoutes(
    apiBaseUrl: string,
    threadId: string,
    ownerMemberIndex: string,
    joinedMemberIndex: string,
    joinedUserId: string,
    token: string,
    events: EventCapture,
) {
    const members = await getJsonArray(`${apiBaseUrl}/channels/${threadId}/thread-members`, token);
    assert.ok(members.some((threadMember) => threadMember.id === threadId && threadMember.member_idx === ownerMemberIndex));

    const ownerThreadMember = await assertJsonObject(await getJson(`${apiBaseUrl}/channels/${threadId}/thread-members/@me`, token));
    assert.equal(ownerThreadMember.id, threadId);
    assert.equal(ownerThreadMember.member_idx, ownerMemberIndex);

    const beforePost = markCapturedEvents(events);
    await assertStatus(await postJson(`${apiBaseUrl}/channels/${threadId}/thread-members/${joinedUserId}`, {}, token), 204);
    await waitForEventAfter(
        events,
        beforePost,
        (event) =>
            event.event === "THREAD_MEMBERS_UPDATE" &&
            event.channel_id === threadId &&
            event.data.member_count === 2 &&
            event.data.added_members?.some((member: Record<string, unknown>) => member.user_id === joinedUserId),
    );
    await assertThreadMember(threadId, joinedMemberIndex);

    const beforeDelete = markCapturedEvents(events);
    await assertStatus(await deleteJson(`${apiBaseUrl}/channels/${threadId}/thread-members/${joinedUserId}`, token), 204);
    await waitForEventAfter(
        events,
        beforeDelete,
        (event) =>
            event.event === "THREAD_MEMBERS_UPDATE" && event.channel_id === threadId && event.data.member_count === 1 && event.data.removed_member_ids?.includes(joinedUserId),
    );
    assert.equal(await ThreadMember.findOneBy({ id: threadId, member_idx: joinedMemberIndex }), null);

    const beforePut = markCapturedEvents(events);
    await assertStatus(await putJson(`${apiBaseUrl}/channels/${threadId}/thread-members/${joinedUserId}`, {}, token), 204);
    await waitForEventAfter(
        events,
        beforePut,
        (event) =>
            event.event === "THREAD_MEMBERS_UPDATE" &&
            event.channel_id === threadId &&
            event.data.member_count === 2 &&
            event.data.added_members?.some((member: Record<string, unknown>) => member.user_id === joinedUserId),
    );
    await assertThreadMember(threadId, joinedMemberIndex);

    const beforeSettings = markCapturedEvents(events);
    const settings = await patchJson(`${apiBaseUrl}/channels/${threadId}/thread-members/@me/settings`, { muted: true, flags: ThreadMemberFlags.ONLY_MENTIONS }, token);
    await assertStatus(settings, 200);
    const settingsBody = await assertJsonObject(settings);
    assert.equal(settingsBody.muted, true);
    assert.equal(settingsBody.flags, ThreadMemberFlags.ONLY_MENTIONS);
    await waitForEventAfter(
        events,
        beforeSettings,
        (event) => event.event === "THREAD_MEMBER_UPDATE" && event.user_id !== undefined && event.data.id === threadId && event.data.muted === true,
    );
    const persistedOwnerMember = await ThreadMember.findOneByOrFail({ id: threadId, member_idx: ownerMemberIndex });
    assert.equal(persistedOwnerMember.muted, true);
    assert.equal(persistedOwnerMember.flags, ThreadMemberFlags.ONLY_MENTIONS);
}

async function coverTagDelete(apiBaseUrl: string, forumChannelId: string, tagId: string, token: string, events: EventCapture) {
    const beforeDelete = markCapturedEvents(events);
    const deleteTag = await deleteJson(`${apiBaseUrl}/channels/${forumChannelId}/tags/${tagId}`, token);
    await assertStatus(deleteTag, 200);
    await waitForEventAfter(
        events,
        beforeDelete,
        (event) => event.event === "CHANNEL_UPDATE" && event.channel_id === forumChannelId && !hasTag(event.data.available_tags, tagId, "scenario-tag-updated"),
    );
    assert.equal(await Tag.findOneBy({ id: tagId }), null);
}

async function createForumChannel(apiBaseUrl: string, guildId: string, token: string) {
    const createForum = await postJson(
        `${apiBaseUrl}/guilds/${guildId}/channels`,
        {
            name: "scenario-forum",
            type: ChannelType.GUILD_FORUM,
        },
        token,
    );
    await assertStatus(createForum, 201);
    const forum = await assertJsonObject(createForum);
    assert.equal(forum.type, ChannelType.GUILD_FORUM);
    return forum.id as string;
}

async function createMessage(apiBaseUrl: string, channelId: string, content: string, token: string) {
    const response = await postJson(`${apiBaseUrl}/channels/${channelId}/messages`, { content }, token);
    await assertStatus(response, 200);
    return (await assertJsonObject(response)).id as string;
}

async function archiveThread(threadId: string) {
    const thread = await Channel.findOneByOrFail({ id: threadId });
    assert.ok(thread.thread_metadata);
    thread.thread_metadata = {
        ...thread.thread_metadata,
        archived: true,
        archive_timestamp: new Date().toISOString(),
    };
    await thread.save();
}

async function assertThreadMember(threadId: string, memberIndex: string) {
    assert.notEqual(await ThreadMember.findOneBy({ id: threadId, member_idx: memberIndex }), null);
}

function hasOverwrite(overwrites: unknown, overwriteId: string) {
    return Array.isArray(overwrites) && overwrites.some((overwrite) => overwrite.id === overwriteId);
}

function hasTag(tags: unknown, tagId: string, name: string) {
    return Array.isArray(tags) && tags.some((tag) => tag.id === tagId && tag.name === name);
}

function markCapturedEvents(capture: EventCapture) {
    return new Set(capture.events);
}

async function waitForEventAfter(capture: EventCapture, previousEvents: Set<CapturedEvent>, predicate: (event: CapturedEvent) => boolean) {
    return await capture.waitFor((event) => !previousEvents.has(event) && predicate(event), eventTimeoutMs);
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
    return await jsonArray(response);
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
