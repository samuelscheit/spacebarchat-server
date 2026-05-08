import assert from "node:assert/strict";
import { test } from "node:test";
import type { ModifyVoiceStateDependencies } from "./VoiceState";
import type { PublicMember, PublicVoiceState, VoiceStateUpdateSchema } from "@spacebar/schemas";

const ChannelType = {
    GUILD_VOICE: 2,
    GUILD_STAGE_VOICE: 13,
} as const;

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost/spacebar";

type VoiceStateModule = typeof import("./VoiceState.js");
type DiscordApiErrors = typeof import("@spacebar/util").DiscordApiErrors;

let voiceStateModule: VoiceStateModule | undefined;
let discordApiErrors: DiscordApiErrors | undefined;

async function loadRuntime(): Promise<VoiceStateModule & { DiscordApiErrors: DiscordApiErrors }> {
    voiceStateModule ??= (await import("./VoiceState.js")) as VoiceStateModule;
    discordApiErrors ??= (require("@spacebar/util") as typeof import("@spacebar/util")).DiscordApiErrors;
    return { ...(voiceStateModule as VoiceStateModule), DiscordApiErrors: discordApiErrors };
}

function makeDeps(
    options: {
        channelType?: number;
        deniedPermission?: string;
        voiceStateMissing?: boolean;
        now?: Date;
    } = {},
) {
    const state = {
        checkedPermissions: [] as string[],
        saved: false,
        emitted: [] as { guild_id: string; data: Record<string, unknown> }[],
        assigned: undefined as VoiceStateUpdateSchema | undefined,
        member: {
            toPublicMember: () => ({ user: { id: "user_id", username: "stage-speaker" }, roles: [] }) as unknown as PublicMember,
        },
        voiceState: {
            guild_id: "guild_id",
            channel_id: "stage_channel_id",
            user_id: "user_id",
            suppress: undefined as boolean | undefined,
            request_to_speak_timestamp: undefined as Date | undefined,
            member: undefined as unknown as { toPublicMember(): PublicMember },
            assign(body: VoiceStateUpdateSchema) {
                state.assigned = { ...body };
                Object.assign(this, body);
            },
            async save() {
                state.saved = true;
                return this;
            },
            toPublicVoiceState(): PublicVoiceState {
                return {
                    guild_id: this.guild_id,
                    channel_id: this.channel_id,
                    user_id: this.user_id,
                    suppress: this.suppress,
                    request_to_speak_timestamp: this.request_to_speak_timestamp,
                } as PublicVoiceState;
            },
        },
    };

    const deps: ModifyVoiceStateDependencies = {
        getPermission: async () => ({
            hasThrow: (permission) => {
                state.checkedPermissions.push(String(permission));
                if (options.deniedPermission === permission) throw new Error(`missing ${permission}`);
                return true;
            },
        }),
        findVoiceState: async () => (options.voiceStateMissing ? null : state.voiceState),
        findChannel: async () => ({
            id: "stage_channel_id",
            guild_id: "guild_id",
            type: options.channelType ?? ChannelType.GUILD_STAGE_VOICE,
        }),
        findMember: async () => state.member,
        saveVoiceState: async (voiceState) => voiceState.save(),
        emitVoiceStateUpdate: async (guild_id, voiceState) => {
            state.emitted.push({
                guild_id,
                data: {
                    ...voiceState.toPublicVoiceState(),
                    member: voiceState.member.toPublicMember(),
                },
            });
        },
        now: () => options.now ?? new Date("2026-05-08T10:00:00.000Z"),
    };

    return { state, deps };
}

test("modifyVoiceState updates a stage voice state and emits a VOICE_STATE_UPDATE payload", async () => {
    const { modifyVoiceState } = await loadRuntime();
    const { state, deps } = makeDeps();

    await modifyVoiceState(
        "user_id",
        "guild_id",
        "user_id",
        {
            channel_id: "stage_channel_id",
            self_mute: false,
            self_deaf: false,
            suppress: false,
        },
        deps,
    );

    assert.deepEqual(state.checkedPermissions, ["REQUEST_TO_SPEAK"]);
    assert.equal(state.saved, true);
    assert.deepEqual(state.assigned, {
        channel_id: "stage_channel_id",
        self_mute: false,
        self_deaf: false,
        suppress: false,
        request_to_speak_timestamp: new Date("2026-05-08T10:00:00.000Z"),
    });
    assert.deepEqual(state.emitted, [
        {
            guild_id: "guild_id",
            data: {
                guild_id: "guild_id",
                channel_id: "stage_channel_id",
                user_id: "user_id",
                suppress: false,
                request_to_speak_timestamp: new Date("2026-05-08T10:00:00.000Z"),
                member: { user: { id: "user_id", username: "stage-speaker" }, roles: [] },
            },
        },
    ]);
});

test("modifyVoiceState requires MUTE_MEMBERS when suppressing another user", async () => {
    const { modifyVoiceState } = await loadRuntime();
    const { state, deps } = makeDeps();

    await modifyVoiceState(
        "moderator_id",
        "guild_id",
        "user_id",
        {
            channel_id: "stage_channel_id",
            self_mute: false,
            self_deaf: false,
            suppress: true,
        },
        deps,
    );

    assert.deepEqual(state.checkedPermissions, ["MUTE_MEMBERS"]);
    assert.equal(state.saved, true);
});

test("modifyVoiceState rejects request-to-speak updates without REQUEST_TO_SPEAK", async () => {
    const { modifyVoiceState } = await loadRuntime();
    const { state, deps } = makeDeps({ deniedPermission: "REQUEST_TO_SPEAK" });

    await assert.rejects(
        () =>
            modifyVoiceState(
                "user_id",
                "guild_id",
                "user_id",
                {
                    channel_id: "stage_channel_id",
                    self_mute: false,
                    self_deaf: false,
                    suppress: false,
                },
                deps,
            ),
        /missing REQUEST_TO_SPEAK/,
    );
    assert.equal(state.saved, false);
    assert.deepEqual(state.emitted, []);
});

test("modifyVoiceState rejects non-stage channels", async () => {
    const { modifyVoiceState, DiscordApiErrors } = await loadRuntime();
    const { state, deps } = makeDeps({ channelType: ChannelType.GUILD_VOICE });

    await assert.rejects(
        () =>
            modifyVoiceState(
                "user_id",
                "guild_id",
                "user_id",
                {
                    channel_id: "stage_channel_id",
                    self_mute: false,
                    self_deaf: false,
                    suppress: true,
                },
                deps,
            ),
        (error) => error === DiscordApiErrors.CANNOT_EXECUTE_ON_THIS_CHANNEL_TYPE,
    );
    assert.equal(state.saved, false);
    assert.deepEqual(state.emitted, []);
});

test("modifyVoiceState rejects missing voice states", async () => {
    const { modifyVoiceState, DiscordApiErrors } = await loadRuntime();
    const { state, deps } = makeDeps({ voiceStateMissing: true });

    await assert.rejects(
        () =>
            modifyVoiceState(
                "user_id",
                "guild_id",
                "user_id",
                {
                    channel_id: "stage_channel_id",
                    self_mute: false,
                    self_deaf: false,
                    suppress: true,
                },
                deps,
            ),
        (error) => error === DiscordApiErrors.UNKNOWN_VOICE_STATE,
    );
    assert.equal(state.saved, false);
    assert.deepEqual(state.emitted, []);
});
