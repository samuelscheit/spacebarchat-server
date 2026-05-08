import type { PublicVoiceState } from "@spacebar/schemas";
import { VoiceState, type VoiceState as VoiceStateEntity } from "@spacebar/util";

type ReadySupplementalVoiceStateSource = PublicVoiceState | Pick<VoiceStateEntity, "toPublicVoiceState">;

type ReadySupplementalGuildCandidate = {
    id: string;
    unavailable?: boolean;
    voice_states?: ReadonlyArray<ReadySupplementalVoiceStateSource>;
};

type ReadySupplementalGuildSource = ReadySupplementalGuildCandidate & { unavailable?: undefined | false };

export interface ReadySupplementalGuild {
    embedded_activities: unknown[];
    id: string;
    voice_states: PublicVoiceState[];
}

function guildIsReadySupplementalSource(guild: ReadySupplementalGuildCandidate): guild is ReadySupplementalGuildSource {
    return guild.unavailable != true;
}

function toPublicReadySupplementalVoiceState(state: ReadySupplementalVoiceStateSource): PublicVoiceState {
    return VoiceState.prototype.toPublicVoiceState.apply(state);
}

export function buildReadySupplementalGuilds(guilds: ReadonlyArray<ReadySupplementalGuildCandidate>): ReadySupplementalGuild[] {
    return guilds.filter(guildIsReadySupplementalSource).map((guild) => ({
        voice_states: (guild.voice_states ?? []).map(toPublicReadySupplementalVoiceState),
        id: guild.id,
        embedded_activities: [],
    }));
}
