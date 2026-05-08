import assert from "node:assert/strict";
import { test } from "node:test";
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

function makeReadyGuild(stage_instances: unknown[]): GuildOrUnavailable {
    return {
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
    } as unknown as GuildOrUnavailable;
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

test("ReadyGuildDTO keeps home_header as a null READY compatibility property", () => {
    const dto = new ReadyGuildDTO(makeReadyGuild([])).toJSON();

    assert.equal(dto.properties.home_header, null);
});
