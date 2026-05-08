import assert from "node:assert/strict";
import { test } from "node:test";
import { buildReadySupplementalGuilds } from "./ReadySupplemental";
import type { GuildOrUnavailable } from "@spacebar/util";

function makeGuild(id: string, voice_states: unknown[]): GuildOrUnavailable {
    return {
        id,
        unavailable: undefined,
        voice_states,
    } as unknown as GuildOrUnavailable;
}

test("READY_SUPPLEMENTAL guilds include serialized persisted voice states", () => {
    const readySupplementalGuilds = buildReadySupplementalGuilds([
        makeGuild("guild-with-voice", [
            {
                channel_id: "voice-channel",
                deaf: false,
                guild_id: "guild-with-voice",
                mute: false,
                request_to_speak_timestamp: null,
                self_deaf: false,
                self_mute: true,
                self_stream: false,
                self_video: false,
                session_id: "voice-session",
                suppress: false,
                token: "internal-token-must-not-leak",
                user_id: "voice-user",
            },
        ]),
    ]);

    assert.deepEqual(readySupplementalGuilds, [
        {
            embedded_activities: [],
            id: "guild-with-voice",
            voice_states: [
                {
                    channel_id: "voice-channel",
                    deaf: false,
                    guild_id: "guild-with-voice",
                    mute: false,
                    request_to_speak_timestamp: null,
                    self_deaf: false,
                    self_mute: true,
                    self_stream: false,
                    self_video: false,
                    session_id: "voice-session",
                    suppress: false,
                    user_id: "voice-user",
                },
            ],
        },
    ]);
});

test("READY_SUPPLEMENTAL guilds exclude unavailable guild placeholders", () => {
    const readySupplementalGuilds = buildReadySupplementalGuilds([{ id: "unavailable-guild", unavailable: true }, makeGuild("available-guild", [])]);

    assert.deepEqual(readySupplementalGuilds, [
        {
            embedded_activities: [],
            id: "available-guild",
            voice_states: [],
        },
    ]);
});
