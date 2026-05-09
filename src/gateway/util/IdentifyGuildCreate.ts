import type { PublicChannel, PublicMember, PublicThreadMember, PublicUser, PublicVoiceState, StageInstanceResponse } from "@spacebar/schemas";
import { serializePublicThreadMember, type Channel, type Guild, type Member, type PublicThreadMemberSource, type StageInstance, type VoiceState } from "@spacebar/util";

export type IdentifyReadyThreadMemberPayload = PublicThreadMemberSource;

export type IdentifyReadyThreadPayload = Omit<PublicChannel, "member"> & {
    member?: PublicThreadMember;
};

type IdentifyGuildCreateGuildData = Omit<
    Partial<Guild>,
    "channels" | "emojis" | "features" | "id" | "members" | "name" | "presences" | "roles" | "stage_instances" | "stickers" | "threads" | "unavailable" | "voice_states"
> &
    Pick<Guild, "channels" | "emojis" | "features" | "id" | "name" | "roles" | "stickers"> & {
        unavailable: undefined;
        voice_states: PublicVoiceState[];
    };

export type IdentifyPendingGuildCreateData = IdentifyGuildCreateGuildData & {
    joined_at: Date;
    threads: IdentifyReadyThreadPayload[];
    guild_scheduled_events: never[];
    presences: never[];
    stage_instances: StageInstanceResponse[];
};

export type IdentifyBotGuildCreateData = IdentifyPendingGuildCreateData & {
    members: PublicMember[];
};

export function buildIdentifyBotReadyGuildPlaceholder(guild: Pick<Guild, "id">) {
    return { id: guild.id, unavailable: true } as const;
}

type SerializedIdentifyGuild = Omit<Partial<Guild>, "channels" | "emojis" | "features" | "id" | "name" | "roles" | "stickers"> &
    Pick<Guild, "channels" | "emojis" | "features" | "id" | "name" | "roles" | "stickers"> & {
        members?: unknown;
        presences?: unknown;
        stage_instances?: unknown;
        threads?: unknown;
        unavailable?: unknown;
        voice_states?: unknown;
    };

type IdentifyGuildCreateGuildSource = {
    toJSON(): SerializedIdentifyGuild;
    voice_states?: ReadonlyArray<Pick<VoiceState, "toPublicVoiceState"> | PublicVoiceState>;
};

type IdentifyReadyThreadSource = Pick<Channel, "toJSON">;

type IdentifyStageInstanceSource = Pick<StageInstance, "toPublicStageInstance">;

type IdentifyBotMemberSource = Pick<Member, "toPublicMember">;

type IdentifyBotUserSource = {
    toPublicUser(): PublicUser;
};

export function serializeIdentifyReadyThreadMember(member: IdentifyReadyThreadMemberPayload | undefined, userId: string): PublicThreadMember | undefined {
    if (!member) return undefined;
    return serializePublicThreadMember(member, userId, { includeMuted: true });
}

export function serializeIdentifyReadyVoiceState(voiceState: Pick<VoiceState, "toPublicVoiceState"> | PublicVoiceState): PublicVoiceState {
    if (hasVoiceStateSerializer(voiceState)) return voiceState.toPublicVoiceState();
    return voiceState;
}

function hasVoiceStateSerializer(voiceState: Pick<VoiceState, "toPublicVoiceState"> | PublicVoiceState): voiceState is Pick<VoiceState, "toPublicVoiceState"> {
    return typeof (voiceState as Partial<Pick<VoiceState, "toPublicVoiceState">>).toPublicVoiceState === "function";
}

export function buildIdentifyPendingGuildCreateData({
    guild,
    joinedAt,
    threads,
    threadMemberMap,
    stageInstances,
    userId,
}: {
    guild: IdentifyGuildCreateGuildSource;
    joinedAt: Date;
    threads: IdentifyReadyThreadSource[];
    threadMemberMap: ReadonlyMap<string, IdentifyReadyThreadMemberPayload>;
    stageInstances: IdentifyStageInstanceSource[];
    userId: string;
}): IdentifyPendingGuildCreateData {
    const serializedGuild = guild.toJSON();
    const {
        members: _members,
        presences: _presences,
        stage_instances: _stageInstances,
        threads: _threads,
        unavailable: _unavailable,
        voice_states: _voiceStates,
        ...guildData
    } = serializedGuild;

    return {
        ...guildData,
        joined_at: joinedAt,
        unavailable: undefined,
        voice_states: (guild.voice_states ?? []).map(serializeIdentifyReadyVoiceState),
        threads: threads.map((thread) => {
            const threadPayload = thread.toJSON();

            return {
                ...threadPayload,
                member: serializeIdentifyReadyThreadMember(threadMemberMap.get(threadPayload.id), userId),
            };
        }),
        guild_scheduled_events: [],
        presences: [],
        stage_instances: stageInstances.map((stageInstance) => stageInstance.toPublicStageInstance()),
    } satisfies IdentifyPendingGuildCreateData;
}

export function buildIdentifyBotGuildCreateData({
    pendingGuild,
    botMember,
    botUser,
}: {
    pendingGuild: IdentifyPendingGuildCreateData;
    botMember?: IdentifyBotMemberSource;
    botUser: IdentifyBotUserSource;
}): IdentifyBotGuildCreateData {
    return {
        ...pendingGuild,
        members: botMember
            ? [
                  {
                      ...botMember.toPublicMember(),
                      user: botUser.toPublicUser(),
                  },
              ]
            : [],
    } satisfies IdentifyBotGuildCreateData;
}
