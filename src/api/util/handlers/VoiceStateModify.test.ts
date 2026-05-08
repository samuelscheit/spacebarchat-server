import assert from "node:assert/strict";
import { test } from "node:test";
import type { VoiceStateModifyDependencies, VoiceStateModifyPatch, VoiceStateRecord } from "./Voice";

const ChannelType = {
    GUILD_VOICE: 2,
    GUILD_STAGE_VOICE: 13,
} as const;

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost/spacebar";

type VoiceModule = typeof import("./Voice.js");
type DiscordApiErrors = typeof import("@spacebar/util").DiscordApiErrors;

let voiceModule: VoiceModule | undefined;
let discordApiErrors: DiscordApiErrors | undefined;

async function loadRuntime(): Promise<VoiceModule & { DiscordApiErrors: DiscordApiErrors }> {
    voiceModule ??= (await import("./Voice.js")) as VoiceModule;
    discordApiErrors ??= (require("@spacebar/util") as typeof import("@spacebar/util")).DiscordApiErrors;
    return { ...(voiceModule as VoiceModule), DiscordApiErrors: discordApiErrors };
}

function makeVoiceState(overrides: Partial<VoiceStateRecord & { request_to_speak_timestamp: Date | null; suppress: boolean }> = {}) {
    const assigned: VoiceStateModifyPatch[] = [];
    const voiceState = {
        guild_id: "197038439483310086",
        channel_id: "733488538393510049",
        user_id: "80351110224678912",
        request_to_speak_timestamp: null as Date | null,
        suppress: true,
        assign(patch: VoiceStateModifyPatch) {
            assigned.push(patch);
            Object.assign(this, patch);
            return this;
        },
        toPublicVoiceState() {
            return {
                guild_id: this.guild_id,
                channel_id: this.channel_id,
                user_id: this.user_id,
                suppress: this.suppress,
                request_to_speak_timestamp: this.request_to_speak_timestamp,
            };
        },
        ...overrides,
    };

    return { voiceState: voiceState as VoiceStateRecord & { request_to_speak_timestamp: Date | null; suppress: boolean }, assigned };
}

function makeDeps(
    options: {
        voiceState?: ReturnType<typeof makeVoiceState>["voiceState"] | null;
        channelType?: number;
        deniedPermission?: string;
        now?: Date;
    } = {},
) {
    const state = {
        voiceState: options.voiceState ?? makeVoiceState().voiceState,
        channel: {
            id: "733488538393510049",
            guild_id: "197038439483310086",
            type: options.channelType ?? ChannelType.GUILD_STAGE_VOICE,
        },
        member: {
            toPublicMember() {
                return { user: { id: state.voiceState?.user_id }, roles: [] };
            },
        },
        checkedPermissions: [] as string[],
        permissionChecks: [] as { user_id: string; guild_id: string; channel_id: string }[],
        findVoiceStateCalls: [] as { guild_id: string; user_id: string; channel_id?: string }[],
        saved: false,
        emitted: [] as { guild_id: string; user_id?: string; memberUserId?: string }[],
    };

    const deps: VoiceStateModifyDependencies = {
        findVoiceState: async (guild_id, user_id, channel_id) => {
            state.findVoiceStateCalls.push({ guild_id, user_id, channel_id });
            if (!state.voiceState) return null;
            if (state.voiceState.guild_id !== guild_id || state.voiceState.user_id !== user_id) return null;
            if (channel_id !== undefined && state.voiceState.channel_id !== channel_id) return null;
            return state.voiceState;
        },
        findChannel: async (_guild_id, channel_id) => (channel_id === state.channel.id ? state.channel : null),
        findMember: async () => state.member,
        getPermission: async (user_id, guild_id, channel_id) => {
            state.permissionChecks.push({ user_id, guild_id, channel_id });
            return {
                hasThrow: (permission) => {
                    state.checkedPermissions.push(String(permission));
                    if (permission === options.deniedPermission) throw new Error(`missing ${permission}`);
                    return true;
                },
            };
        },
        saveVoiceState: async () => {
            state.saved = true;
        },
        emitVoiceStateUpdate: async (guild_id, voiceState, member) => {
            state.emitted.push({ guild_id, user_id: voiceState.user_id, memberUserId: member.toPublicMember().user?.id });
        },
        now: () => options.now ?? new Date("2026-05-08T12:34:56.000Z"),
    };

    return { state, deps };
}

test("modifyVoiceState accepts channel-only current-user updates without request-to-speak side effects", async () => {
    const { modifyVoiceState } = await loadRuntime();
    const originalTimestamp = new Date("2026-05-08T00:00:00.000Z");
    const { voiceState, assigned } = makeVoiceState({ user_id: "requester", request_to_speak_timestamp: originalTimestamp, suppress: true });
    const { state, deps } = makeDeps({ voiceState });

    await modifyVoiceState("requester", voiceState.guild_id, "@me", { channel_id: voiceState.channel_id }, deps);

    assert.deepEqual(state.findVoiceStateCalls, [{ guild_id: voiceState.guild_id, user_id: "requester", channel_id: voiceState.channel_id }]);
    assert.deepEqual(state.permissionChecks, [{ user_id: "requester", guild_id: voiceState.guild_id, channel_id: voiceState.channel_id }]);
    assert.deepEqual(state.checkedPermissions, []);
    assert.deepEqual(assigned, [{ channel_id: voiceState.channel_id }]);
    assert.equal(voiceState.request_to_speak_timestamp, originalTimestamp);
    assert.equal(state.saved, true);
    assert.deepEqual(state.emitted, [{ guild_id: voiceState.guild_id, user_id: "requester", memberUserId: "requester" }]);
});

test("modifyVoiceState derives the current voice channel when channel_id is omitted", async () => {
    const { modifyVoiceState } = await loadRuntime();
    const { voiceState, assigned } = makeVoiceState({ user_id: "requester" });
    const { state, deps } = makeDeps({ voiceState });

    await modifyVoiceState("requester", voiceState.guild_id, "@me", {}, deps);

    assert.deepEqual(state.findVoiceStateCalls, [{ guild_id: voiceState.guild_id, user_id: "requester", channel_id: undefined }]);
    assert.deepEqual(state.permissionChecks, [{ user_id: "requester", guild_id: voiceState.guild_id, channel_id: voiceState.channel_id }]);
    assert.deepEqual(assigned, [{}]);
});

test("modifyVoiceState requires REQUEST_TO_SPEAK only when setting a current-user request timestamp", async () => {
    const { modifyVoiceState } = await loadRuntime();
    const timestamp = new Date("2026-05-08T13:00:00.000Z");
    const { voiceState, assigned } = makeVoiceState({ user_id: "requester" });
    const { state, deps } = makeDeps({ voiceState });

    await modifyVoiceState("requester", voiceState.guild_id, "@me", { request_to_speak_timestamp: timestamp }, deps);

    assert.deepEqual(state.checkedPermissions, ["REQUEST_TO_SPEAK"]);
    assert.deepEqual(assigned, [{ request_to_speak_timestamp: timestamp }]);

    state.checkedPermissions.length = 0;
    assigned.length = 0;
    await modifyVoiceState("requester", voiceState.guild_id, "@me", { request_to_speak_timestamp: null }, deps);

    assert.deepEqual(state.checkedPermissions, []);
    assert.deepEqual(assigned, [{ request_to_speak_timestamp: null }]);
});

test("modifyVoiceState checks MUTE_MEMBERS for suppress changes and applies documented timestamp transitions", async () => {
    const { modifyVoiceState } = await loadRuntime();
    const now = new Date("2026-05-08T12:34:56.000Z");
    const { voiceState, assigned } = makeVoiceState({ user_id: "target", suppress: true });
    const { state, deps } = makeDeps({ voiceState, now });

    await modifyVoiceState("moderator", voiceState.guild_id, "target", { suppress: false }, deps);

    assert.deepEqual(state.checkedPermissions, ["MUTE_MEMBERS"]);
    assert.deepEqual(assigned, [{ suppress: false, request_to_speak_timestamp: now }]);

    state.checkedPermissions.length = 0;
    assigned.length = 0;
    await modifyVoiceState("moderator", voiceState.guild_id, "target", { suppress: true }, deps);

    assert.deepEqual(state.checkedPermissions, ["MUTE_MEMBERS"]);
    assert.deepEqual(assigned, [{ suppress: true, request_to_speak_timestamp: null }]);
});

test("modifyVoiceState rejects request_to_speak_timestamp for other-user updates", async () => {
    const { modifyVoiceState } = await loadRuntime();
    const { voiceState } = makeVoiceState({ user_id: "target" });
    const { state, deps } = makeDeps({ voiceState });

    await assert.rejects(
        () => modifyVoiceState("moderator", voiceState.guild_id, "target", { request_to_speak_timestamp: new Date() }, deps),
        (error) => typeof error === "object" && error !== null && "code" in error && error.code === 50035,
    );
    assert.equal(state.saved, false);
    assert.deepEqual(state.findVoiceStateCalls, []);
});

test("modifyVoiceState requires MUTE_MEMBERS to unsuppress the current user", async () => {
    const { modifyVoiceState } = await loadRuntime();
    const { voiceState } = makeVoiceState({ user_id: "requester", suppress: true });
    const { state, deps } = makeDeps({ voiceState, deniedPermission: "MUTE_MEMBERS" });

    await assert.rejects(() => modifyVoiceState("requester", voiceState.guild_id, "@me", { suppress: false }, deps), /missing MUTE_MEMBERS/);
    assert.deepEqual(state.checkedPermissions, ["MUTE_MEMBERS"]);
    assert.equal(state.saved, false);
});

test("modifyVoiceState rejects non-stage channels", async () => {
    const { modifyVoiceState, DiscordApiErrors } = await loadRuntime();
    const { voiceState } = makeVoiceState({ user_id: "requester" });
    const { deps } = makeDeps({ voiceState, channelType: ChannelType.GUILD_VOICE });

    await assert.rejects(
        () => modifyVoiceState("requester", voiceState.guild_id, "@me", { channel_id: voiceState.channel_id }, deps),
        (error) => error === DiscordApiErrors.CANNOT_EXECUTE_ON_THIS_CHANNEL_TYPE,
    );
});
