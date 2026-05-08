import type { PublicVoiceState } from "@spacebar/schemas";
import { type Guild, type GuildOrUnavailable, VoiceState, type VoiceState as VoiceStateEntity } from "@spacebar/util";

type ReadySupplementalGuildSource = Guild & { unavailable?: undefined | false };

export interface ReadySupplementalGuild {
    embedded_activities: unknown[];
    id: string;
    voice_states: PublicVoiceState[];
}

function guildIsReadySupplementalSource(guild: GuildOrUnavailable): guild is ReadySupplementalGuildSource {
    return guild.unavailable != true;
}

function toPublicReadySupplementalVoiceState(state: VoiceStateEntity): PublicVoiceState {
    return VoiceState.prototype.toPublicVoiceState.apply(state);
}

export function buildReadySupplementalGuilds(guilds: GuildOrUnavailable[]): ReadySupplementalGuild[] {
    return guilds.filter(guildIsReadySupplementalSource).map((guild) => ({
        voice_states: guild.voice_states.map(toPublicReadySupplementalVoiceState),
        id: guild.id,
        embedded_activities: [],
    }));
}
