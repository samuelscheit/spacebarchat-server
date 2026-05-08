import assert from "node:assert/strict";
import { test } from "node:test";
import type { GuildScheduledEventResponse } from "@spacebar/schemas";
import { ReadyGuildDTO, type GuildOrUnavailable } from "./ReadyGuildDTO";

type StageInstanceResponse = {
    id: string;
    guild_id: string;
    channel_id: string;
    topic: string;
    privacy_level: number;
    discoverable_disabled: boolean;
    guild_scheduled_event_id?: string | null;
};

const stageInstance: StageInstanceResponse = {
    id: "840647391636226060",
    guild_id: "197038439483310086",
    channel_id: "733488538393510049",
    topic: "Server Q&A",
    privacy_level: 2,
    discoverable_disabled: false,
    guild_scheduled_event_id: null,
};

const scheduledEvent: GuildScheduledEventResponse = {
    id: "1059954443799498922",
    guild_id: stageInstance.guild_id,
    channel_id: null,
    name: "Alien meetup",
    description: "Aliens only!",
    scheduled_start_time: "2026-05-09T23:00:00.000Z",
    scheduled_end_time: "2026-05-10T23:00:00.000Z",
    privacy_level: 2,
    status: 1,
    entity_type: 3,
    entity_id: null,
    entity_metadata: {
        location: "somewhere in the ocean",
    },
    recurrence_rule: null,
    guild_scheduled_event_exceptions: [],
};

function makeReadyGuild(stage_instances: unknown[], guild_scheduled_events?: GuildScheduledEventResponse[]): GuildOrUnavailable {
    const guild = {
        id: stageInstance.guild_id,
        unavailable: undefined,
        channels: [],
        emojis: [],
        roles: [],
        stickers: [],
        threads: [],
        stage_instances,
        large: false,
        member_count: 1,
        premium_subscription_count: 0,
        name: "Stage Test",
        description: null,
        icon: null,
        splash: null,
        banner: null,
        features: [],
        preferred_locale: "en-US",
        owner_id: "owner_id",
        afk_channel_id: null,
        afk_timeout: 300,
        system_channel_id: null,
        verification_level: 0,
        explicit_content_filter: 0,
        default_message_notifications: 0,
        mfa_level: 0,
        premium_tier: 0,
        premium_progress_bar_enabled: false,
        system_channel_flags: 0,
        discovery_splash: null,
        rules_channel_id: null,
        public_updates_channel_id: null,
        max_video_channel_users: 25,
        max_members: 250000,
        nsfw_level: 0,
        nsfw: false,
        joined_at: new Date("2026-05-06T00:00:00Z"),
    } as unknown as GuildOrUnavailable & { guild_scheduled_events?: GuildScheduledEventResponse[] };

    if (guild_scheduled_events != undefined) guild.guild_scheduled_events = guild_scheduled_events;

    return guild;
}

test("ReadyGuildDTO preserves already-public stage instances from READY guild payloads", () => {
    const dto = new ReadyGuildDTO(makeReadyGuild([stageInstance])).toJSON();

    assert.deepEqual(dto.stage_instances, [stageInstance]);
});

test("ReadyGuildDTO serializes stage instance entities for guild create payloads", () => {
    const dto = new ReadyGuildDTO(
        makeReadyGuild([
            {
                toPublicStageInstance: () => stageInstance,
            },
        ]),
    ).toJSON();

    assert.deepEqual(dto.stage_instances, [stageInstance]);
});

test("ReadyGuildDTO defaults scheduled events to an empty list when none are loaded", () => {
    const dto = new ReadyGuildDTO(makeReadyGuild([])).toJSON();

    assert.deepEqual(dto.guild_scheduled_events, []);
});

test("ReadyGuildDTO preserves loaded scheduled event response objects", () => {
    const dto = new ReadyGuildDTO(makeReadyGuild([], [scheduledEvent])).toJSON();

    assert.deepEqual(dto.guild_scheduled_events, [scheduledEvent]);
});
