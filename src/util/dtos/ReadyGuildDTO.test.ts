import assert from "node:assert/strict";
import { test } from "node:test";
import { getReadyUserGuildSettingsVersion, ReadyGuildDTO, type GuildOrUnavailable, type ReadyUserGuildSettingsEntries } from "./ReadyGuildDTO";

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

test("ReadyGuildDTO emits an empty application command count map for available guilds", () => {
    const dto = new ReadyGuildDTO(makeReadyGuild([])).toJSON();

    assert.deepEqual(dto.application_command_counts, {});
});

test("ReadyGuildDTO omits application command counts for unavailable guild placeholders", () => {
    const dto = new ReadyGuildDTO({ id: stageInstance.guild_id, unavailable: true }).toJSON();

    assert.equal(dto.application_command_counts, undefined);
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

function makeReadyUserGuildSettingsEntry(version: number): ReadyUserGuildSettingsEntries {
    return {
        channel_overrides: [],
        flags: 0,
        guild_id: "197038439483310086",
        hide_muted_channels: false,
        message_notifications: 1,
        mobile_push: true,
        mute_config: null,
        mute_scheduled_events: false,
        muted: false,
        notify_highlights: 0,
        suppress_everyone: false,
        suppress_roles: false,
        version,
    };
}

test("getReadyUserGuildSettingsVersion returns 0 when READY has no guild settings entries", () => {
    assert.equal(getReadyUserGuildSettingsVersion([]), 0);
});

test("getReadyUserGuildSettingsVersion reports the highest stored guild settings version", () => {
    assert.equal(getReadyUserGuildSettingsVersion([makeReadyUserGuildSettingsEntry(2), makeReadyUserGuildSettingsEntry(9), makeReadyUserGuildSettingsEntry(4)]), 9);
});

test("getReadyUserGuildSettingsVersion ignores non-finite stored versions", () => {
    assert.equal(
        getReadyUserGuildSettingsVersion([
            makeReadyUserGuildSettingsEntry(Number.NaN),
            makeReadyUserGuildSettingsEntry(Number.POSITIVE_INFINITY),
            makeReadyUserGuildSettingsEntry(7),
        ]),
        7,
    );
});

test("getReadyUserGuildSettingsVersion returns 0 when all stored versions are non-finite", () => {
    assert.equal(
        getReadyUserGuildSettingsVersion([
            makeReadyUserGuildSettingsEntry(Number.NaN),
            makeReadyUserGuildSettingsEntry(Number.POSITIVE_INFINITY),
            makeReadyUserGuildSettingsEntry(Number.NEGATIVE_INFINITY),
        ]),
        0,
    );
});

test("getReadyUserGuildSettingsVersion does not report negative stored versions", () => {
    assert.equal(getReadyUserGuildSettingsVersion([makeReadyUserGuildSettingsEntry(-3), makeReadyUserGuildSettingsEntry(-1)]), 0);
});

test("getReadyUserGuildSettingsVersion ignores missing and null stored versions", () => {
    assert.equal(getReadyUserGuildSettingsVersion([{ version: undefined }, { version: null }, {}, makeReadyUserGuildSettingsEntry(5)]), 5);
});
