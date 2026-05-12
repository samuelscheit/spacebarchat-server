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

import { randomUUID } from "node:crypto";
import { route } from "@spacebar/api";
import { ActivityLaunchSchema, ChannelType } from "@spacebar/schemas";
import {
    ActivityType,
    ApiError,
    Application,
    ApplicationFlags,
    Channel,
    DiscordApiErrors,
    emitEvent,
    getPermission,
    Member,
    Session,
    User,
    VoiceState,
    type Activity,
    type PresenceUpdateEvent,
} from "@spacebar/util";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

export const ACTIVITY_LAUNCH_MISSING_ACCESS = new ApiError(DiscordApiErrors.MISSING_ACCESS.message, DiscordApiErrors.MISSING_ACCESS.code, 403);
export const ACTIVITY_LAUNCH_UNKNOWN_SESSION = new ApiError(DiscordApiErrors.UNKNOWN_SESSION.message, DiscordApiErrors.UNKNOWN_SESSION.code, 404);

type ActivityLaunchPermission = "VIEW_CHANNEL" | "CONNECT" | "USE_EMBEDDED_ACTIVITIES" | "USE_EXTERNAL_APPS";

export type ActivityLaunchPermissionLike = {
    has(permission: ActivityLaunchPermission): boolean;
};

export type ActivityLaunchApplication = Pick<Application, "flags" | "guild_id" | "id" | "name"> & {
    bot?: {
        id?: string | null;
    } | null;
};

export type ActivityLaunchChannel = Pick<Channel, "guild_id" | "id" | "type">;
export type ActivityLaunchSession = Pick<Session, "activities" | "client_status" | "session_id" | "status" | "user_id">;
export type ActivityLaunchVoiceState = Pick<VoiceState, "channel_id" | "guild_id" | "session_id" | "user_id">;

export interface ActivityLaunchDependencies {
    findApplication(applicationId: string): Promise<ActivityLaunchApplication | null>;
    findChannel(channelId: string): Promise<ActivityLaunchChannel | null>;
    isApplicationAuthorizedForGuild(application: ActivityLaunchApplication, guildId: string): Promise<boolean>;
    getPermission(userId: string, guildId: string | undefined, channelId: string): Promise<ActivityLaunchPermissionLike>;
    findSession(userId: string, sessionId: string): Promise<ActivityLaunchSession | null>;
    findVoiceState(userId: string, sessionId: string, channelId: string): Promise<ActivityLaunchVoiceState | null>;
    findVoiceStates(channelId: string): Promise<ActivityLaunchVoiceState[]>;
    findSessionsForVoiceStates(voiceStates: ActivityLaunchVoiceState[]): Promise<ActivityLaunchSession[]>;
    saveSessionActivities(userId: string, sessionId: string, activities: Activity[]): Promise<void>;
    emitPresenceUpdate(userId: string, session: ActivityLaunchSession): Promise<void>;
    createLaunchPartyId(): string;
    now(): number;
}

function defaultLaunchPartyId() {
    return randomUUID();
}

async function emitSessionPresenceUpdate(userId: string, session: ActivityLaunchSession) {
    await emitEvent({
        event: "PRESENCE_UPDATE",
        user_id: userId,
        data: {
            user: await User.getPublicUser(userId),
            status: session.status === "invisible" ? "offline" : session.status,
            activities: session.activities ?? [],
            client_status: session.client_status,
        },
    } satisfies PresenceUpdateEvent);
}

export const defaultActivityLaunchDependencies: ActivityLaunchDependencies = {
    findApplication: (applicationId) =>
        Application.findOne({
            where: { id: applicationId },
            relations: { bot: true },
            select: {
                id: true,
                name: true,
                flags: true,
                guild_id: true,
                bot: {
                    id: true,
                },
            },
        }) as Promise<ActivityLaunchApplication | null>,
    findChannel: (channelId) =>
        Channel.findOne({
            where: { id: channelId },
            select: { id: true, guild_id: true, type: true },
        }) as Promise<ActivityLaunchChannel | null>,
    isApplicationAuthorizedForGuild: async (application, guildId) => {
        if (application.guild_id === guildId) return true;

        const botId = application.bot?.id;
        if (!botId) return false;

        return Member.exists({
            where: {
                id: botId,
                guild_id: guildId,
            },
        });
    },
    getPermission: (userId, guildId, channelId) => getPermission(userId, guildId, channelId) as Promise<ActivityLaunchPermissionLike>,
    findSession: (userId, sessionId) =>
        Session.findOne({
            where: {
                user_id: userId,
                session_id: sessionId,
                is_admin_session: false,
            },
            select: {
                user_id: true,
                session_id: true,
                status: true,
                activities: true,
                client_status: true,
            },
        }) as Promise<ActivityLaunchSession | null>,
    findVoiceState: (userId, sessionId, channelId) =>
        VoiceState.findOne({
            where: {
                user_id: userId,
                session_id: sessionId,
                channel_id: channelId,
            },
            select: {
                user_id: true,
                session_id: true,
                channel_id: true,
                guild_id: true,
            },
        }) as Promise<ActivityLaunchVoiceState | null>,
    findVoiceStates: (channelId) =>
        VoiceState.find({
            where: { channel_id: channelId },
            select: {
                user_id: true,
                session_id: true,
                channel_id: true,
                guild_id: true,
            },
        }) as Promise<ActivityLaunchVoiceState[]>,
    findSessionsForVoiceStates: (voiceStates) => {
        if (!voiceStates.length) return Promise.resolve([]);

        return Session.find({
            where: voiceStates.map((voiceState) => ({
                user_id: voiceState.user_id,
                session_id: voiceState.session_id,
                is_admin_session: false,
            })),
            select: {
                user_id: true,
                session_id: true,
                status: true,
                activities: true,
                client_status: true,
            },
        }) as Promise<ActivityLaunchSession[]>;
    },
    saveSessionActivities: (userId, sessionId, activities) =>
        Session.update({ user_id: userId, session_id: sessionId, is_admin_session: false }, { activities }).then(() => undefined),
    emitPresenceUpdate: emitSessionPresenceUpdate,
    createLaunchPartyId: defaultLaunchPartyId,
    now: () => Date.now(),
};

function isEntityNotFoundError(error: unknown) {
    return error instanceof Error && error.name === "EntityNotFoundError";
}

function missingPermission(permission: ActivityLaunchPermission) {
    return DiscordApiErrors.MISSING_PERMISSIONS.withParams(permission);
}

export function isEmbeddedActivityApplication(application: ActivityLaunchApplication) {
    return new ApplicationFlags(application.flags ?? 0).has(ApplicationFlags.FLAGS.EMBEDDED);
}

export function isSupportedActivityLaunchChannel(channel: ActivityLaunchChannel) {
    return channel.type === ChannelType.GUILD_VOICE || channel.type === ChannelType.DM || channel.type === ChannelType.GROUP_DM;
}

async function requireLaunchPermissions(userId: string, application: ActivityLaunchApplication, channel: ActivityLaunchChannel, dependencies: ActivityLaunchDependencies) {
    let permission: ActivityLaunchPermissionLike;
    try {
        permission = await dependencies.getPermission(userId, channel.guild_id ?? undefined, channel.id);
    } catch (error) {
        if (isEntityNotFoundError(error)) throw missingPermission("VIEW_CHANNEL");
        throw error;
    }

    const requiredPermissions: ActivityLaunchPermission[] = ["VIEW_CHANNEL", "CONNECT"];
    if (channel.guild_id) {
        requiredPermissions.push("USE_EMBEDDED_ACTIVITIES");
        if (!(await dependencies.isApplicationAuthorizedForGuild(application, channel.guild_id))) requiredPermissions.push("USE_EXTERNAL_APPS");
    }

    for (const requiredPermission of requiredPermissions) {
        if (!permission.has(requiredPermission)) throw missingPermission(requiredPermission);
    }
}

function getSessionKey(session: Pick<ActivityLaunchSession, "session_id" | "user_id">) {
    return `${session.user_id}\u0000${session.session_id}`;
}

function firstActivityPartyId(activities: Activity[] | undefined, applicationId: string) {
    return activities?.find((activity) => activity.application_id === applicationId)?.party?.id?.trim();
}

export function findExistingLaunchPartyId(applicationId: string, currentSession: ActivityLaunchSession, sessions: ActivityLaunchSession[]) {
    const currentPartyId = firstActivityPartyId(currentSession.activities, applicationId);
    if (currentPartyId) return currentPartyId;

    for (const session of sessions) {
        const partyId = firstActivityPartyId(session.activities, applicationId);
        if (partyId) return partyId;
    }

    return undefined;
}

export function upsertEmbeddedActivityLaunch(activities: Activity[] | undefined, application: ActivityLaunchApplication, sessionId: string, partyId: string, createdAt: number) {
    const nextActivities = activities ? [...activities] : [];
    const existingIndex = nextActivities.findIndex((activity) => activity.application_id === application.id);
    const existingActivity = existingIndex === -1 ? undefined : nextActivities[existingIndex];
    const launchActivity: Activity = {
        ...existingActivity,
        name: existingActivity?.name ?? application.name,
        type: existingActivity?.type ?? ActivityType.GAME,
        created_at: existingActivity?.created_at ?? createdAt,
        application_id: application.id,
        instance: true,
        session_id: sessionId,
        party: {
            ...existingActivity?.party,
            id: partyId,
        },
    };

    if (existingIndex === -1) nextActivities.push(launchActivity);
    else nextActivities[existingIndex] = launchActivity;

    return nextActivities;
}

export async function launchEmbeddedActivity(
    {
        applicationId,
        body,
        channelId,
        userId,
    }: {
        applicationId: string;
        body: ActivityLaunchSchema;
        channelId: string;
        userId: string;
    },
    dependencies: ActivityLaunchDependencies = defaultActivityLaunchDependencies,
) {
    const application = await dependencies.findApplication(applicationId);
    if (!application) throw DiscordApiErrors.UNKNOWN_APPLICATION;
    if (!isEmbeddedActivityApplication(application)) throw ACTIVITY_LAUNCH_MISSING_ACCESS;

    const channel = await dependencies.findChannel(channelId);
    if (!channel) throw DiscordApiErrors.UNKNOWN_CHANNEL;
    if (!isSupportedActivityLaunchChannel(channel)) throw DiscordApiErrors.CANNOT_EXECUTE_ON_THIS_CHANNEL_TYPE;

    await requireLaunchPermissions(userId, application, channel, dependencies);

    const session = await dependencies.findSession(userId, body.session_id);
    if (!session) throw ACTIVITY_LAUNCH_UNKNOWN_SESSION;

    const voiceState = await dependencies.findVoiceState(userId, body.session_id, channelId);
    if (!voiceState?.channel_id) throw DiscordApiErrors.TARGET_USER_IS_NOT_CONNECTED_TO_VOICE;

    const voiceStates = await dependencies.findVoiceStates(channelId);
    const sessions = await dependencies.findSessionsForVoiceStates(voiceStates);
    const currentSessionKey = getSessionKey(session);
    const otherVoiceSessions = sessions.filter((voiceSession) => getSessionKey(voiceSession) !== currentSessionKey);
    const partyId = findExistingLaunchPartyId(applicationId, session, otherVoiceSessions) ?? dependencies.createLaunchPartyId();
    const activities = upsertEmbeddedActivityLaunch(session.activities, application, body.session_id, partyId, dependencies.now());
    const launchedSession: ActivityLaunchSession = {
        ...session,
        activities,
    };

    await dependencies.saveSessionActivities(userId, body.session_id, activities);
    await dependencies.emitPresenceUpdate(userId, launchedSession);
}

export function createActivityLaunchRouter(dependencies: ActivityLaunchDependencies = defaultActivityLaunchDependencies) {
    const router: Router = Router({ mergeParams: true });

    router.post(
        "/",
        route({
            summary: "Launch Embedded Activity",
            description:
                "Launches or joins an embedded activity for the caller's locally persisted voice session. Spacebar stores the launch as session activity presence; it does not synthesize the optional accompanying application command invocation until durable interaction launch state exists.",
            requestBody: "ActivityLaunchSchema",
            coerceRequestBody: false,
            responses: {
                204: {},
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
            await launchEmbeddedActivity(
                {
                    applicationId: req.params.application_id as string,
                    body: req.body as ActivityLaunchSchema,
                    channelId: req.params.channel_id as string,
                    userId: req.user_id,
                },
                dependencies,
            );

            return res.sendStatus(204);
        },
    );

    return router;
}

export default createActivityLaunchRouter();
