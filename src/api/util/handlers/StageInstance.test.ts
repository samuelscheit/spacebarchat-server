import assert from "node:assert/strict";
import { test } from "node:test";
import type { StageInstanceDependencies } from "./StageInstance";

const ChannelType = {
    GUILD_VOICE: 2,
    GUILD_STAGE_VOICE: 13,
} as const;

const StageInstancePrivacyLevel = {
    Public: 1,
    GuildOnly: 2,
} as const;

type StageInstanceResponse = {
    id: string;
    guild_id: string;
    channel_id: string;
    topic: string;
    privacy_level: number;
    discoverable_disabled: boolean;
    guild_scheduled_event_id?: string | null;
};

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost/spacebar";

type StageInstanceModule = typeof import("./StageInstance.js");
type DiscordApiErrors = typeof import("@spacebar/util").DiscordApiErrors;

let stageInstanceModule: StageInstanceModule | undefined;
let discordApiErrors: DiscordApiErrors | undefined;

async function loadRuntime(): Promise<StageInstanceModule & { DiscordApiErrors: DiscordApiErrors }> {
    stageInstanceModule ??= (await import("./StageInstance.js")) as StageInstanceModule;
    discordApiErrors ??= (require("@spacebar/util") as typeof import("@spacebar/util")).DiscordApiErrors;
    return { ...(stageInstanceModule as StageInstanceModule), DiscordApiErrors: discordApiErrors };
}

function makeStageInstance(overrides: Partial<StageInstanceResponse> = {}): StageInstanceResponse {
    return {
        id: "840647391636226060",
        guild_id: "197038439483310086",
        channel_id: "733488538393510049",
        topic: "Testing Testing, 123",
        privacy_level: StageInstancePrivacyLevel.GuildOnly,
        discoverable_disabled: false,
        guild_scheduled_event_id: null,
        ...overrides,
    };
}

function makeDeps(
    stageInstanceToResponse: StageInstanceModule["stageInstanceToResponse"],
    options: { channelType?: number; stageInstance?: StageInstanceResponse | null; deniedPermission?: string } = {},
) {
    const state = {
        channel: {
            id: "733488538393510049",
            guild_id: "197038439483310086",
            type: options.channelType ?? ChannelType.GUILD_STAGE_VOICE,
        },
        stageInstance: options.stageInstance ?? null,
        checkedPermissions: [] as string[],
        emitted: [] as { event: string; channel_id: string; data: StageInstanceResponse }[],
        deleted: false,
    };

    const deps: StageInstanceDependencies = {
        findChannel: async () => state.channel,
        findStageInstance: async () => state.stageInstance,
        createStageInstance: (data) => makeStageInstance({ ...data }),
        saveStageInstance: async (stageInstance) => {
            state.stageInstance = stageInstanceToResponse(stageInstance);
            return stageInstance;
        },
        deleteStageInstance: async () => {
            state.deleted = true;
            state.stageInstance = null;
        },
        getPermission: async () => ({
            hasThrow: (permission) => {
                state.checkedPermissions.push(String(permission));
                if (options.deniedPermission === permission) throw new Error(`missing ${permission}`);
                return true;
            },
        }),
        emitStageInstanceEvent: async (event, channel_id, data) => {
            state.emitted.push({ event, channel_id, data });
        },
    };

    return { state, deps };
}

test("createStageInstance persists a live stage and emits a create event", async () => {
    const { createStageInstance, STAGE_INSTANCE_MODERATOR_PERMISSIONS, stageInstanceToResponse } = await loadRuntime();
    const { state, deps } = makeDeps(stageInstanceToResponse);

    const response = await createStageInstance(
        "user_id",
        {
            channel_id: state.channel.id,
            topic: "Server Q&A",
        },
        deps,
    );

    assert.equal(response.guild_id, state.channel.guild_id);
    assert.equal(response.channel_id, state.channel.id);
    assert.equal(response.topic, "Server Q&A");
    assert.equal(response.privacy_level, StageInstancePrivacyLevel.GuildOnly);
    assert.deepEqual(state.checkedPermissions, [...STAGE_INSTANCE_MODERATOR_PERMISSIONS]);
    assert.deepEqual(state.emitted, [{ event: "STAGE_INSTANCE_CREATE", channel_id: state.channel.id, data: response }]);
});

test("createStageInstance rejects duplicate live stages", async () => {
    const { createStageInstance, stageInstanceToResponse, DiscordApiErrors } = await loadRuntime();
    const { deps } = makeDeps(stageInstanceToResponse, { stageInstance: makeStageInstance() });

    await assert.rejects(
        () => createStageInstance("user_id", { channel_id: "733488538393510049", topic: "Server Q&A" }, deps),
        (error) => error === DiscordApiErrors.STAGE_ALREADY_OPEN,
    );
});

test("createStageInstance rejects non-stage channels", async () => {
    const { createStageInstance, stageInstanceToResponse, DiscordApiErrors } = await loadRuntime();
    const { deps } = makeDeps(stageInstanceToResponse, { channelType: ChannelType.GUILD_VOICE });

    await assert.rejects(
        () => createStageInstance("user_id", { channel_id: "733488538393510049", topic: "Server Q&A" }, deps),
        (error) => error === DiscordApiErrors.CANNOT_EXECUTE_ON_THIS_CHANNEL_TYPE,
    );
});

test("createStageInstance requires every stage moderator permission", async () => {
    const { createStageInstance, stageInstanceToResponse } = await loadRuntime();
    const { state, deps } = makeDeps(stageInstanceToResponse, { deniedPermission: "MUTE_MEMBERS" });

    await assert.rejects(() => createStageInstance("user_id", { channel_id: state.channel.id, topic: "Server Q&A" }, deps), /missing MUTE_MEMBERS/);
    assert.deepEqual(state.checkedPermissions, ["MANAGE_CHANNELS", "MUTE_MEMBERS"]);
});

test("getStageInstance returns a singular stage instance and rejects missing instances", async () => {
    const { getStageInstance, stageInstanceToResponse, DiscordApiErrors } = await loadRuntime();
    const existing = makeStageInstance();
    const { deps } = makeDeps(stageInstanceToResponse, { stageInstance: existing });

    assert.deepEqual(await getStageInstance(existing.channel_id, deps), existing);

    const missing = makeDeps(stageInstanceToResponse);
    await assert.rejects(
        () => getStageInstance("733488538393510049", missing.deps),
        (error) => error === DiscordApiErrors.UNKNOWN_STAGE_INSTANCE,
    );
});

test("modifyStageInstance updates privacy level and emits an update event", async () => {
    const { modifyStageInstance, stageInstanceToResponse } = await loadRuntime();
    const existing = makeStageInstance({ privacy_level: StageInstancePrivacyLevel.GuildOnly });
    const { state, deps } = makeDeps(stageInstanceToResponse, { stageInstance: existing });

    const response = await modifyStageInstance("user_id", existing.channel_id, { privacy_level: StageInstancePrivacyLevel.Public }, deps);

    assert.equal(response.privacy_level, StageInstancePrivacyLevel.Public);
    assert.deepEqual(state.emitted, [{ event: "STAGE_INSTANCE_UPDATE", channel_id: existing.channel_id, data: response }]);
});

test("deleteStageInstance deletes a stage instance and emits a delete event", async () => {
    const { deleteStageInstance, stageInstanceToResponse } = await loadRuntime();
    const existing = makeStageInstance();
    const { state, deps } = makeDeps(stageInstanceToResponse, { stageInstance: existing });

    await deleteStageInstance("user_id", existing.channel_id, deps);

    assert.equal(state.deleted, true);
    assert.deepEqual(state.emitted, [{ event: "STAGE_INSTANCE_DELETE", channel_id: existing.channel_id, data: existing }]);
});
