/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

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

import { route } from "@spacebar/api";
import type { EmbeddedActivityInstancesResponse } from "@spacebar/schemas";
import { Application, Channel, DiscordApiErrors, getPermission, type Activity, Session, VoiceState } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

type ApplicationWithBot = {
    bot?: {
        id?: string | null;
    } | null;
};

type ActivityInstancesChannel = {
    id: string;
    guild_id?: string | null;
};

type PermissionLike = {
    has(permission: "VIEW_CHANNEL"): boolean;
};

type ActivityInstancesVoiceState = {
    channel_id?: string | null;
    guild_id?: string | null;
    session_id: string;
    user_id: string;
};

type ActivityInstancesSession = {
    session_id: string;
    user_id: string;
    activities?: Activity[] | null;
};

export interface EmbeddedActivityInstancesDependencies {
    findApplication(applicationId: string): Promise<ApplicationWithBot | null>;
    findChannel(channelId: string): Promise<ActivityInstancesChannel | null>;
    getPermission(userId: string, guildId: string | undefined, channelId: string): Promise<PermissionLike>;
    findVoiceStates(channelId: string): Promise<ActivityInstancesVoiceState[]>;
    findSessions(voiceStates: ActivityInstancesVoiceState[]): Promise<ActivityInstancesSession[]>;
}

const defaultDependencies: EmbeddedActivityInstancesDependencies = {
    findApplication: (applicationId) =>
        Application.findOne({
            where: { id: applicationId },
            relations: { bot: true },
        }),
    findChannel: (channelId) =>
        Channel.findOne({
            where: { id: channelId },
            select: { id: true, guild_id: true },
        }),
    getPermission: (userId, guildId, channelId) => getPermission(userId, guildId, channelId),
    findVoiceStates: (channelId) =>
        VoiceState.find({
            where: { channel_id: channelId },
            select: { channel_id: true, guild_id: true, session_id: true, user_id: true },
        }),
    findSessions: (voiceStates) => {
        if (!voiceStates.length) return Promise.resolve([]);

        return Session.find({
            where: voiceStates.map((voiceState) => ({
                session_id: voiceState.session_id,
                user_id: voiceState.user_id,
            })),
            select: { session_id: true, user_id: true, activities: true },
        });
    },
};

function getSessionKey(userId: string, sessionId: string) {
    return `${userId}\u0000${sessionId}`;
}

function getLocationKind(guildId?: string | null) {
    return guildId ? "gc" : "pc";
}

function isEntityNotFoundError(error: unknown) {
    return error instanceof Error && error.name === "EntityNotFoundError";
}

function missingViewChannelPermission() {
    return DiscordApiErrors.MISSING_PERMISSIONS.withParams("VIEW_CHANNEL");
}

export function toChannelActivityInstanceId(activityPartyId: string, guildId: string | null | undefined, channelId: string) {
    const trimmedPartyId = activityPartyId.trim();
    const locationSuffix = `-${getLocationKind(guildId)}-${channelId}`;

    if (trimmedPartyId.startsWith("i-") && trimmedPartyId.endsWith(locationSuffix)) return trimmedPartyId;

    return `i-${trimmedPartyId}${locationSuffix}`;
}

export function buildChannelActivityInstances({
    applicationId,
    channelId,
    voiceStates,
    sessions,
}: {
    applicationId: string;
    channelId: string;
    voiceStates: ActivityInstancesVoiceState[];
    sessions: ActivityInstancesSession[];
}): EmbeddedActivityInstancesResponse {
    const sessionsByKey = new Map(sessions.map((session) => [getSessionKey(session.user_id, session.session_id), session]));
    const instancesById = new Map<string, EmbeddedActivityInstancesResponse["instances"][number]>();

    for (const voiceState of voiceStates) {
        if (voiceState.channel_id && voiceState.channel_id !== channelId) continue;

        const session = sessionsByKey.get(getSessionKey(voiceState.user_id, voiceState.session_id));
        if (!session) continue;

        for (const activity of session.activities ?? []) {
            if (activity.application_id !== applicationId) continue;

            const partyId = activity.party?.id?.trim();
            if (!partyId) continue;

            const instanceId = toChannelActivityInstanceId(partyId, voiceState.guild_id, channelId);
            let instance = instancesById.get(instanceId);

            if (!instance) {
                instance = {
                    application_id: applicationId,
                    instance_id: instanceId,
                    channel_id: channelId,
                    users: [],
                };
                if (voiceState.guild_id) instance.guild_id = voiceState.guild_id;
                instancesById.set(instanceId, instance);
            }

            if (!instance.users.includes(voiceState.user_id)) instance.users.push(voiceState.user_id);
        }
    }

    const instances = [...instancesById.values()];
    for (const instance of instances) instance.users.sort();
    instances.sort((left, right) => left.instance_id.localeCompare(right.instance_id));

    return { instances };
}

export async function getEmbeddedActivityInstancesResponse(
    {
        applicationId,
        channelId,
        userId,
        userIsBot,
    }: {
        applicationId: string;
        channelId: string;
        userId: string;
        userIsBot: boolean;
    },
    dependencies: EmbeddedActivityInstancesDependencies = defaultDependencies,
): Promise<EmbeddedActivityInstancesResponse> {
    if (!userIsBot) throw DiscordApiErrors.BOT_ONLY_ENDPOINT;

    const application = await dependencies.findApplication(applicationId);
    if (!application) throw DiscordApiErrors.UNKNOWN_APPLICATION;
    if (application.bot?.id !== userId) throw DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION;

    const channel = await dependencies.findChannel(channelId);
    if (!channel) throw DiscordApiErrors.UNKNOWN_CHANNEL;

    let permission: PermissionLike;
    try {
        permission = await dependencies.getPermission(userId, channel.guild_id ?? undefined, channelId);
    } catch (error) {
        if (isEntityNotFoundError(error)) throw missingViewChannelPermission();
        throw error;
    }
    if (!permission.has("VIEW_CHANNEL")) throw missingViewChannelPermission();

    const voiceStates = await dependencies.findVoiceStates(channelId);
    const sessions = await dependencies.findSessions(voiceStates);

    return buildChannelActivityInstances({
        applicationId,
        channelId,
        voiceStates,
        sessions,
    });
}

router.get(
    "/",
    route({
        deprecated: true,
        summary: "Get Embedded Activity Instances",
        responses: {
            200: {
                body: "EmbeddedActivityInstancesResponse",
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
        const body = await getEmbeddedActivityInstancesResponse({
            applicationId: req.params.application_id as string,
            channelId: req.params.channel_id as string,
            userId: req.user_id,
            userIsBot: req.user_bot,
        });

        return res.status(200).json(body);
    },
);

export default router;
