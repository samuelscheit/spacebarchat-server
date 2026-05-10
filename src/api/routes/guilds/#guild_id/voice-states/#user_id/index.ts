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

import { assertGuildMember, canViewChannel, modifyVoiceState, route } from "@spacebar/api";
import { type VoiceStateModifySchema, type VoiceStateResponse } from "@spacebar/schemas";
import { DiscordApiErrors, Guild, Member, VoiceState } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router = Router({ mergeParams: true });

type VoiceStateResponseSource = {
    channel_id?: string | null;
    guild_id?: string | null;
    user_id?: string;
    session_id?: string;
    deaf?: boolean;
    mute?: boolean;
    self_deaf?: boolean;
    self_mute?: boolean;
    self_stream?: boolean;
    self_video?: boolean;
    suppress?: boolean;
    request_to_speak_timestamp?: Date | string | null;
};

export type VoiceStateGetRecord = {
    channel_id?: string | null;
    guild_id?: string | null;
    user_id: string;
    toPublicVoiceState(): VoiceStateResponseSource;
};

export interface UserVoiceStateDependencies {
    guildExists(guildId: string): Promise<boolean>;
    assertRequesterGuildMember(userId: string, guildId: string): Promise<void>;
    findVoiceState(guildId: string, userId: string): Promise<VoiceStateGetRecord | null>;
    targetMemberExists(guildId: string, userId: string): Promise<boolean>;
    canViewVoiceChannel(userId: string, guildId: string, channelId: string): Promise<boolean>;
}

export const defaultUserVoiceStateDependencies: UserVoiceStateDependencies = {
    guildExists: (guildId) => Guild.exists({ where: { id: guildId } }),
    assertRequesterGuildMember: assertGuildMember,
    findVoiceState: (guildId, userId) =>
        VoiceState.findOne({
            where: { guild_id: guildId, user_id: userId },
        }),
    targetMemberExists: (guildId, userId) => Member.exists({ where: { id: userId, guild_id: guildId } }),
    canViewVoiceChannel: (userId, guildId, channelId) => canViewChannel(userId, { id: channelId, guild_id: guildId }),
};

function serializeVoiceStateTimestamp(timestamp: Date | string | null | undefined) {
    if (timestamp instanceof Date) return timestamp.toISOString();
    return timestamp ?? null;
}

export function toVoiceStateResponse(voiceState: VoiceStateGetRecord): VoiceStateResponse {
    const publicVoiceState = voiceState.toPublicVoiceState();

    const response: VoiceStateResponse = {
        guild_id: publicVoiceState.guild_id ?? voiceState.guild_id!,
        channel_id: publicVoiceState.channel_id ?? voiceState.channel_id!,
        user_id: publicVoiceState.user_id ?? voiceState.user_id,
        session_id: publicVoiceState.session_id!,
        deaf: publicVoiceState.deaf!,
        mute: publicVoiceState.mute!,
        self_deaf: publicVoiceState.self_deaf!,
        self_mute: publicVoiceState.self_mute!,
        self_video: publicVoiceState.self_video!,
        suppress: publicVoiceState.suppress!,
        request_to_speak_timestamp: serializeVoiceStateTimestamp(publicVoiceState.request_to_speak_timestamp),
    };

    if (publicVoiceState.self_stream !== undefined) response.self_stream = publicVoiceState.self_stream;

    return response;
}

export async function getUserVoiceState(
    requesterId: string,
    requesterIsBot: boolean,
    guildId: string,
    userId: string,
    dependencies: UserVoiceStateDependencies = defaultUserVoiceStateDependencies,
): Promise<VoiceStateResponse> {
    if (!requesterIsBot) throw DiscordApiErrors.BOT_ONLY_ENDPOINT;

    if (!(await dependencies.guildExists(guildId))) throw DiscordApiErrors.UNKNOWN_GUILD;
    await dependencies.assertRequesterGuildMember(requesterId, guildId);

    const voiceState = await dependencies.findVoiceState(guildId, userId);
    if (!voiceState?.channel_id) throw DiscordApiErrors.UNKNOWN_VOICE_STATE;

    if (!(await dependencies.targetMemberExists(guildId, voiceState.user_id))) throw DiscordApiErrors.UNKNOWN_MEMBER;
    if (!(await dependencies.canViewVoiceChannel(requesterId, guildId, voiceState.channel_id))) throw DiscordApiErrors.MISSING_ACCESS;

    return toVoiceStateResponse(voiceState);
}

router.get(
    "/",
    route({
        summary: "Get User Voice State",
        responses: {
            200: {
                body: "VoiceStateResponse",
            },
            400: {
                body: "APIErrorResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
            403: {
                body: "APIErrorResponse",
            },
            404: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const { guild_id, user_id } = req.params as { guild_id: string; user_id: string };

        return res.json(await getUserVoiceState(req.user_id, req.user_bot, guild_id, user_id));
    },
);

router.patch(
    "/",
    route({
        requestBody: "VoiceStateModifySchema",
        event: "VOICE_STATE_UPDATE",
        responses: {
            204: {},
            400: {
                body: "APIErrorResponse",
            },
            403: {
                body: "APIErrorResponse",
            },
            404: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const { guild_id, user_id } = req.params as { guild_id: string; user_id: string };

        await modifyVoiceState(req.user_id, guild_id, user_id, req.body as VoiceStateModifySchema);
        return res.sendStatus(204);
    },
);

export default router;
