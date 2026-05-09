import assert from "node:assert/strict";
import { test } from "node:test";

import type { PublicMember, PublicUser, PublicVoiceState, StageInstanceResponse } from "@spacebar/schemas";
import type { Channel, Guild, Member, StageInstance, ThreadMember, VoiceState } from "@spacebar/util";
import { buildIdentifyBotGuildCreateData, buildIdentifyBotReadyGuildPlaceholder, buildIdentifyPendingGuildCreateData } from "./IdentifyGuildCreate";

const publicUser: PublicUser = {
    id: "bot-user",
    username: "bot",
    discriminator: "0001",
    bot: true,
    public_flags: 0,
    premium_type: 0,
    bio: "",
    pronouns: "",
};

const publicVoiceState: PublicVoiceState = {
    user_id: publicUser.id,
    suppress: false,
    session_id: "voice-session",
    self_video: false,
    self_mute: false,
    self_deaf: false,
    self_stream: false,
    request_to_speak_timestamp: undefined,
    mute: false,
    deaf: false,
    channel_id: "voice-channel",
    guild_id: "guild-id",
};

const stageInstance: StageInstanceResponse = {
    id: "stage-id",
    guild_id: "guild-id",
    channel_id: "stage-channel",
    topic: "Town Hall",
    privacy_level: 2,
    discoverable_disabled: false,
    guild_scheduled_event_id: null,
};

function createGuildSource() {
    const rawVoiceState = {
        ...publicVoiceState,
        token: "sensitive voice token",
        toPublicVoiceState: () => publicVoiceState,
    } as unknown as VoiceState;

    return {
        id: "guild-id",
        name: "Guild",
        channels: [],
        emojis: [],
        features: [],
        nsfw: false,
        premium_progress_bar_enabled: false,
        roles: [],
        stickers: [],
        voice_states: [rawVoiceState],
        toJSON() {
            return {
                id: "guild-id",
                name: "Guild",
                channels: [],
                emojis: [],
                features: [],
                nsfw: false,
                premium_progress_bar_enabled: false,
                roles: [],
                stickers: [],
                members: [{ id: "should-not-leak" }],
                unavailable: true,
                voice_states: [rawVoiceState],
            } as unknown as Guild;
        },
    } as unknown as Pick<Guild, "toJSON"> & { voice_states: VoiceState[] };
}

function createThreadSource() {
    return {
        toJSON() {
            return {
                id: "thread-id",
                type: 11,
                guild_id: "guild-id",
                name: "thread",
            } as ReturnType<Channel["toJSON"]>;
        },
    } as Pick<Channel, "toJSON">;
}

function createThreadMember(): ThreadMember {
    return {
        id: "thread-id",
        index: "thread-member-row",
        member_idx: "guild-member-row",
        join_timestamp: new Date("2026-05-08T00:00:00.000Z"),
        muted: false,
        mute_config: { selected_time_window: 60 },
        flags: 3,
        channel: { id: "should-not-leak" },
        member: { id: "should-not-leak" },
    } as unknown as ThreadMember;
}

function createStageInstanceSource() {
    return {
        toPublicStageInstance: () => stageInstance,
    } as Pick<StageInstance, "toPublicStageInstance">;
}

test("buildIdentifyPendingGuildCreateData serializes queued bot guild payloads", () => {
    const joinedAt = new Date("2026-05-08T01:23:45.000Z");
    const pendingGuild = buildIdentifyPendingGuildCreateData({
        guild: createGuildSource(),
        joinedAt,
        threads: [createThreadSource()],
        threadMemberMap: new Map([["thread-id", createThreadMember()]]),
        stageInstances: [createStageInstanceSource()],
    });

    assert.equal(pendingGuild.id, "guild-id");
    assert.equal(pendingGuild.name, "Guild");
    assert.equal(pendingGuild.joined_at, joinedAt);
    assert.equal(pendingGuild.unavailable, undefined);
    assert.deepEqual(pendingGuild.guild_scheduled_events, []);
    assert.deepEqual(pendingGuild.presences, []);
    assert.deepEqual(pendingGuild.stage_instances, [stageInstance]);
    assert.deepEqual(pendingGuild.voice_states, [publicVoiceState]);
    assert.equal("members" in pendingGuild, false);
    assert.equal("token" in pendingGuild.voice_states[0], false);
    assert.deepEqual(pendingGuild.threads, [
        {
            id: "thread-id",
            type: 11,
            guild_id: "guild-id",
            name: "thread",
            member: {
                id: "thread-id",
                index: "thread-member-row",
                member_idx: "guild-member-row",
                join_timestamp: new Date("2026-05-08T00:00:00.000Z"),
                muted: false,
                mute_config: { selected_time_window: 60 },
                flags: 3,
            },
        },
    ]);
});

test("buildIdentifyBotReadyGuildPlaceholder keeps bot READY guilds unavailable", () => {
    assert.deepEqual(buildIdentifyBotReadyGuildPlaceholder({ id: "guild-id" } as Guild), {
        id: "guild-id",
        unavailable: true,
    });
});

test("buildIdentifyBotGuildCreateData sends exactly the bot member", () => {
    const pendingGuild = buildIdentifyPendingGuildCreateData({
        guild: createGuildSource(),
        joinedAt: new Date("2026-05-08T01:23:45.000Z"),
        threads: [],
        threadMemberMap: new Map(),
        stageInstances: [],
    });
    const memberWithoutUser = {
        toPublicMember() {
            return {
                id: publicUser.id,
                roles: ["guild-id"],
                joined_at: new Date("2026-05-08T01:23:45.000Z"),
            } as PublicMember;
        },
    } as Pick<Member, "toPublicMember">;
    const botUser = {
        toPublicUser: () => publicUser,
    };

    const guildCreate = buildIdentifyBotGuildCreateData({ pendingGuild, botMember: memberWithoutUser, botUser });

    assert.equal(guildCreate.members.length, 1);
    assert.deepEqual(guildCreate.members[0].user, publicUser);
    assert.deepEqual(guildCreate.members[0].roles, ["guild-id"]);
    assert.equal("token" in guildCreate.voice_states[0], false);

    assert.deepEqual(buildIdentifyBotGuildCreateData({ pendingGuild, botUser }).members, []);
});
