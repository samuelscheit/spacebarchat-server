import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import type { VoiceState as VoiceStateType } from "./VoiceState";

test("VoiceState.toPublicVoiceState serializes only the public schema projection", () => {
    const localRequire = createRequire(__filename);
    const moduleCache = localRequire.cache as Record<string, { exports: unknown } | undefined>;
    const mockedModules = new Map<string, { exports: unknown } | undefined>();
    const publicVoiceStateProjection = [
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
    ];
    const mockModule = (request: string, exports: unknown) => {
        const resolvedPath = localRequire.resolve(request);
        mockedModules.set(resolvedPath, moduleCache[resolvedPath]);
        moduleCache[resolvedPath] = { exports };
    };

    mockModule("@spacebar/schemas", { PublicVoiceStateProjection: publicVoiceStateProjection });
    mockModule("./BaseClass", { BaseClass: class BaseClass {} });
    mockModule("./Channel", { Channel: class Channel {} });
    mockModule("./Guild", { Guild: class Guild {} });
    mockModule("./User", { User: class User {} });

    const voiceStatePath = localRequire.resolve("./VoiceState");
    const originalVoiceStateModule = moduleCache[voiceStatePath];
    delete moduleCache[voiceStatePath];
    const { VoiceState } = localRequire("./VoiceState") as { VoiceState: new () => VoiceStateType };

    for (const [path, module] of mockedModules) {
        if (module) moduleCache[path] = module;
        else delete moduleCache[path];
    }
    if (originalVoiceStateModule) moduleCache[voiceStatePath] = originalVoiceStateModule;
    else delete moduleCache[voiceStatePath];

    const voiceState = new VoiceState();
    voiceState.guild_id = "guild-1";
    voiceState.channel_id = "channel-1";
    voiceState.user_id = "user-1";
    voiceState.session_id = "session-1";
    voiceState.deaf = false;
    voiceState.mute = true;
    voiceState.self_deaf = false;
    voiceState.self_mute = true;
    voiceState.self_stream = true;
    voiceState.self_video = false;
    voiceState.suppress = true;
    voiceState.request_to_speak_timestamp = new Date("2026-05-08T12:00:00.000Z");
    voiceState.token = "entity-only-token";

    const publicVoiceState = voiceState.toPublicVoiceState();

    assert.deepEqual(Object.keys(publicVoiceState), publicVoiceStateProjection);
    assert.deepEqual(publicVoiceState, {
        user_id: "user-1",
        suppress: true,
        session_id: "session-1",
        self_video: false,
        self_mute: true,
        self_deaf: false,
        self_stream: true,
        request_to_speak_timestamp: new Date("2026-05-08T12:00:00.000Z"),
        mute: true,
        deaf: false,
        channel_id: "channel-1",
        guild_id: "guild-1",
    });
    assert.equal("token" in publicVoiceState, false);
});
