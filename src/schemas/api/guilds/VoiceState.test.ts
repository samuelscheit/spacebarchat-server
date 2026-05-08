import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { PublicVoiceStateProjection } from "./VoiceState.js";

test("public voice state projection exposes only Discord voice state fields", () => {
    assert.deepEqual(PublicVoiceStateProjection, [
        "user_id",
        "suppress",
        "session_id",
        "self_video",
        "self_mute",
        "self_deaf",
        "self_stream",
        "request_to_speak_timestamp",
        "mute",
        "deaf",
        "channel_id",
        "guild_id",
    ]);
});

test("public voice state schema does not import util entities", () => {
    const source = readFileSync(path.join(process.cwd(), "src", "schemas", "api", "guilds", "VoiceState.ts"), "utf8");

    assert.doesNotMatch(source, /from\s+["']@spacebar\/util(?:\/entities)?["']/);
});
