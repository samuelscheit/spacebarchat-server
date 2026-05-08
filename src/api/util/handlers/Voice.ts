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

import type { PublicMember, PublicVoiceState, VoiceStateModifySchema } from "@spacebar/schemas";
import {
    Channel,
    Config,
    DiscordApiErrors,
    emitEvent,
    FieldErrors,
    getPermission,
    IpDataClient,
    Permissions,
    VoiceState,
    Member,
    type VoiceStateUpdateEvent,
} from "@spacebar/util";
import { distanceBetweenLocations } from "../utility/ipAddress";

export async function getVoiceRegions(ipAddress: string, vip: boolean) {
    const regions = Config.get().regions;
    const availableRegions = regions.available.filter((ar) => (vip ? true : !ar.vip));
    let optimalId = regions.default;

    if (!regions.useDefaultAsOptimal) {
        const clientIpAnalysis = await IpDataClient.getIpInfo(ipAddress);

        let min = Number.POSITIVE_INFINITY;

        for (const ar of availableRegions) {
            //TODO the endpoint location should be saved in the database if not already present to prevent IPAnalysis call
            const dist = distanceBetweenLocations(clientIpAnalysis!, ar.location || (await IpDataClient.getIpInfo(ar.endpoint))!);

            if (dist < min) {
                min = dist;
                optimalId = ar.id;
            }
        }
    }

    return availableRegions.map((ar) => ({
        id: ar.id,
        name: ar.name,
        custom: ar.custom,
        deprecated: ar.deprecated,
        optimal: ar.id === optimalId,
    }));
}

const GUILD_STAGE_VOICE = 13;

type PermissionGuard = Pick<Permissions, "hasThrow">;
type StageVoiceChannel = Pick<Channel, "id" | "guild_id" | "type">;

export type VoiceStateModifyPatch = {
    channel_id?: string;
    request_to_speak_timestamp?: Date | null;
    suppress?: boolean;
};

export type VoiceStateRecord = {
    guild_id: string;
    channel_id: string;
    user_id: string;
    assign(props: object): unknown;
    toPublicVoiceState(): Partial<PublicVoiceState>;
};

type MemberRecord = {
    toPublicMember(): { user?: { id?: string } } & Record<string, unknown>;
};

export interface VoiceStateModifyDependencies {
    findVoiceState(guild_id: string, user_id: string, channel_id?: string): Promise<VoiceStateRecord | null>;
    findChannel(guild_id: string, channel_id: string): Promise<StageVoiceChannel | null>;
    findMember(guild_id: string, user_id: string): Promise<MemberRecord | null>;
    getPermission(user_id: string, guild_id: string, channel_id: string): Promise<PermissionGuard>;
    saveVoiceState(voiceState: VoiceStateRecord): Promise<void>;
    emitVoiceStateUpdate(guild_id: string, voiceState: VoiceStateRecord, member: MemberRecord): Promise<void>;
    now(): Date;
}

export const defaultVoiceStateModifyDependencies: VoiceStateModifyDependencies = {
    findVoiceState: (guild_id, user_id, channel_id) =>
        VoiceState.findOne({
            where: {
                guild_id,
                user_id,
                ...(channel_id !== undefined ? { channel_id } : {}),
            },
        }),
    findChannel: (guild_id, channel_id) => Channel.findOne({ where: { guild_id, id: channel_id } }),
    findMember: (guild_id, user_id) => Member.findOne({ where: { id: user_id, guild_id } }),
    getPermission,
    saveVoiceState: async (voiceState) => {
        await (voiceState as VoiceState).save();
    },
    emitVoiceStateUpdate: (guild_id, voiceState, member) =>
        emitEvent({
            event: "VOICE_STATE_UPDATE",
            data: {
                ...(voiceState.toPublicVoiceState() as PublicVoiceState),
                member: member.toPublicMember() as PublicMember,
            },
            guild_id,
        } satisfies VoiceStateUpdateEvent),
    now: () => new Date(),
};

export function assertStageVoiceChannel(channel: Pick<StageVoiceChannel, "type">) {
    if (channel.type !== GUILD_STAGE_VOICE) throw DiscordApiErrors.CANNOT_EXECUTE_ON_THIS_CHANNEL_TYPE;
}

export function assertVoiceStateModifyBodySupported(body: VoiceStateModifySchema, modifiesSelf: boolean) {
    if (!modifiesSelf && body.request_to_speak_timestamp !== undefined) {
        throw FieldErrors({
            request_to_speak_timestamp: {
                message: "request_to_speak_timestamp can only be set when modifying the current user's voice state",
            },
        });
    }
}

export function requireVoiceStateModifyPermissions(body: VoiceStateModifySchema, modifiesSelf: boolean, permission: PermissionGuard) {
    if (body.suppress !== undefined && (!modifiesSelf || body.suppress === false)) {
        permission.hasThrow("MUTE_MEMBERS");
    }

    if (body.request_to_speak_timestamp !== undefined && body.request_to_speak_timestamp !== null) {
        permission.hasThrow("REQUEST_TO_SPEAK");
    }
}

export function getVoiceStateModifyPatch(body: VoiceStateModifySchema, modifiesSelf: boolean, now: () => Date): VoiceStateModifyPatch {
    const patch: VoiceStateModifyPatch = { ...body };

    if (body.suppress === true) {
        patch.request_to_speak_timestamp = null;
    } else if (!modifiesSelf && body.suppress === false) {
        patch.request_to_speak_timestamp = now();
    }

    return patch;
}

export async function modifyVoiceState(
    requester_id: string,
    guild_id: string,
    requested_user_id: string,
    body: VoiceStateModifySchema,
    deps = defaultVoiceStateModifyDependencies,
): Promise<void> {
    const user_id = requested_user_id === "@me" ? requester_id : requested_user_id;
    const modifiesSelf = user_id === requester_id;

    assertVoiceStateModifyBodySupported(body, modifiesSelf);

    const voiceState = await deps.findVoiceState(guild_id, user_id, body.channel_id);
    if (!voiceState) throw DiscordApiErrors.UNKNOWN_VOICE_STATE;

    const channel_id = body.channel_id ?? voiceState.channel_id;
    if (!channel_id) throw DiscordApiErrors.UNKNOWN_VOICE_STATE;

    const channel = await deps.findChannel(guild_id, channel_id);
    if (!channel) throw DiscordApiErrors.UNKNOWN_CHANNEL;
    assertStageVoiceChannel(channel);

    const permission = await deps.getPermission(requester_id, guild_id, channel.id);
    requireVoiceStateModifyPermissions(body, modifiesSelf, permission);

    voiceState.assign(getVoiceStateModifyPatch(body, modifiesSelf, deps.now));

    const member = await deps.findMember(guild_id, voiceState.user_id);
    if (!member) throw DiscordApiErrors.UNKNOWN_MEMBER;

    await Promise.all([deps.saveVoiceState(voiceState), deps.emitVoiceStateUpdate(guild_id, voiceState, member)]);
}
