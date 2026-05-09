/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { Intents, type Member, type VoiceState } from "@spacebar/util";
import type { PublicUser, PublicVoiceState } from "@spacebar/schemas";

type PublicVoiceStateLike = PublicVoiceState | VoiceState;

export type BotGuildCreatePayloadInput = {
    id: string;
    members?: unknown[];
    presences?: unknown[];
    voice_states?: PublicVoiceStateLike[];
};

function toPublicVoiceState(state: PublicVoiceStateLike): PublicVoiceState {
    if ("toPublicVoiceState" in state) return state.toPublicVoiceState();
    return state;
}

export function createBotGuildCreatePayload<TGuild extends BotGuildCreatePayloadInput>(guild: TGuild, members: Member[], user: { toPublicUser(): PublicUser }, intents: Intents) {
    const botMemberObject = members.find((member) => member.guild_id === guild.id);

    return {
        ...guild,
        members: botMemberObject
            ? [
                  {
                      ...botMemberObject.toPublicMember(),
                      user: user.toPublicUser(),
                  },
              ]
            : [],
        presences: intents.has(Intents.FLAGS.GUILD_PRESENCES) ? (guild.presences ?? []) : [],
        voice_states: intents.has(Intents.FLAGS.GUILD_VOICE_STATES) ? (guild.voice_states ?? []).map(toPublicVoiceState) : [],
    };
}

export function createBotGuildCreatePayloads<TGuild extends BotGuildCreatePayloadInput>(
    guilds: TGuild[],
    members: Member[],
    user: { toPublicUser(): PublicUser },
    intents: Intents,
) {
    if (!intents.has(Intents.FLAGS.GUILDS)) return [];

    return guilds.map((guild) => createBotGuildCreatePayload(guild, members, user, intents));
}
