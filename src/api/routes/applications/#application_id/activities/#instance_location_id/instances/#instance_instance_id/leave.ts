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
import type { EmbeddedActivityInstanceLeaveResponse, EmbeddedActivityInstanceLeaveSchema, PublicUser } from "@spacebar/schemas";
import { ApiError, DiscordApiErrors, emitEvent, Session, User, VoiceState, type Activity, type ClientStatus, type PresenceUpdateEvent, type Status } from "@spacebar/util";
import { type Request, type Response, Router } from "express";

export const EMBEDDED_ACTIVITY_LEAVE_MISSING_ACCESS = new ApiError(DiscordApiErrors.MISSING_ACCESS.message, DiscordApiErrors.MISSING_ACCESS.code, 403);
export const EMBEDDED_ACTIVITY_LEAVE_UNKNOWN_SESSION = new ApiError(DiscordApiErrors.UNKNOWN_SESSION.message, DiscordApiErrors.UNKNOWN_SESSION.code, 404);

export type EmbeddedActivityLocation = {
    id: string;
    kind: "gc" | "pc";
    channelId: string;
    guildId?: string;
};

export type EmbeddedActivityLeaveSession = {
    activities?: Activity[] | null;
    client_status?: ClientStatus | null;
    getPublicStatus?: () => Status;
    session_id: string;
    status: Status;
    user_id: string;
};

export type EmbeddedActivityLeaveVoiceState = {
    channel_id?: string | null;
    guild_id?: string | null;
    session_id: string;
    user_id: string;
};

export type EmbeddedActivityLeaveDependencies = {
    emitPresenceUpdate?: (event: Omit<PresenceUpdateEvent, "created_at">) => Promise<unknown> | unknown;
    findSession?: (userId: string, sessionId: string) => Promise<EmbeddedActivityLeaveSession | null>;
    findVoiceState?: (userId: string, sessionId: string, channelId: string) => Promise<EmbeddedActivityLeaveVoiceState | null>;
    getPublicUser?: (userId: string) => Promise<PublicUser>;
    updateSessionActivities?: (userId: string, sessionId: string, activities: Activity[]) => Promise<unknown> | unknown;
};

const emptyLeaveResponse: EmbeddedActivityInstanceLeaveResponse = {};

function nonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

async function findSession(userId: string, sessionId: string): Promise<EmbeddedActivityLeaveSession | null> {
    return Session.findOne({
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
    }) as Promise<EmbeddedActivityLeaveSession | null>;
}

async function findVoiceState(userId: string, sessionId: string, channelId: string): Promise<EmbeddedActivityLeaveVoiceState | null> {
    return VoiceState.findOne({
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
    }) as Promise<EmbeddedActivityLeaveVoiceState | null>;
}

async function updateSessionActivities(userId: string, sessionId: string, activities: Activity[]) {
    return Session.update(
        {
            user_id: userId,
            session_id: sessionId,
            is_admin_session: false,
        },
        { activities },
    );
}

function getPublicStatus(session: EmbeddedActivityLeaveSession): Status {
    return session.getPublicStatus?.() ?? (session.status === "invisible" ? "offline" : session.status);
}

export function parseEmbeddedActivityLocationId(locationId: string): EmbeddedActivityLocation | undefined {
    const parts = locationId.split("-");
    const [kind] = parts;

    if (kind === "pc" && parts.length === 2 && nonEmptyString(parts[1])) {
        return {
            id: locationId,
            kind,
            channelId: parts[1],
        };
    }

    if (kind === "gc" && parts.length === 3 && nonEmptyString(parts[1]) && nonEmptyString(parts[2])) {
        return {
            id: locationId,
            kind,
            guildId: parts[1],
            channelId: parts[2],
        };
    }

    return undefined;
}

export function toEmbeddedActivityInstanceId(activityPartyId: string, location: EmbeddedActivityLocation) {
    const trimmedPartyId = activityPartyId.trim();
    const locationSuffix = `-${location.id}`;

    if (trimmedPartyId.startsWith("i-") && trimmedPartyId.endsWith(locationSuffix)) return trimmedPartyId;

    return `i-${trimmedPartyId}${locationSuffix}`;
}

export function getEmbeddedActivityInstanceId(activityPartyId: string, location: EmbeddedActivityLocation) {
    const compositeInstanceId = toEmbeddedActivityInstanceId(activityPartyId, location);
    const locationSuffix = `-${location.id}`;

    if (!compositeInstanceId.startsWith("i-") || !compositeInstanceId.endsWith(locationSuffix)) return undefined;

    return compositeInstanceId.slice(2, -locationSuffix.length);
}

function voiceStateMatchesLocation(voiceState: EmbeddedActivityLeaveVoiceState | null, location: EmbeddedActivityLocation) {
    return !!voiceState && voiceState.channel_id === location.channelId && (voiceState.guild_id ?? undefined) === location.guildId;
}

export function activityMatchesEmbeddedActivityInstance(activity: Activity, applicationId: string, location: EmbeddedActivityLocation, instanceId: string) {
    if (activity.application_id !== applicationId) return false;

    const partyId = activity.party?.id;
    if (!nonEmptyString(partyId)) return false;

    const activityInstanceId = getEmbeddedActivityInstanceId(partyId, location);
    const compositeInstanceId = toEmbeddedActivityInstanceId(partyId, location);

    return activityInstanceId === instanceId || compositeInstanceId === instanceId;
}

export function removeEmbeddedActivityInstance(activities: Activity[] | null | undefined, applicationId: string, location: EmbeddedActivityLocation, instanceId: string) {
    let removed = false;
    const remainingActivities = (activities ?? []).filter((activity) => {
        if (!activityMatchesEmbeddedActivityInstance(activity, applicationId, location, instanceId)) return true;
        removed = true;
        return false;
    });

    return { removed, activities: remainingActivities };
}

export async function leaveEmbeddedActivityInstance(
    {
        applicationId,
        instanceId,
        locationId,
        sessionId,
        userId,
    }: {
        applicationId: string;
        instanceId: string;
        locationId: string;
        sessionId: string;
        userId: string;
    },
    dependencies: EmbeddedActivityLeaveDependencies = {},
): Promise<EmbeddedActivityInstanceLeaveResponse> {
    const location = parseEmbeddedActivityLocationId(locationId);
    if (!location) throw EMBEDDED_ACTIVITY_LEAVE_MISSING_ACCESS;

    const session = await (dependencies.findSession ?? findSession)(userId, sessionId);
    if (!session) throw EMBEDDED_ACTIVITY_LEAVE_UNKNOWN_SESSION;

    const voiceState = await (dependencies.findVoiceState ?? findVoiceState)(userId, sessionId, location.channelId);
    if (!voiceStateMatchesLocation(voiceState, location)) throw EMBEDDED_ACTIVITY_LEAVE_MISSING_ACCESS;

    const result = removeEmbeddedActivityInstance(session.activities, applicationId, location, instanceId);
    if (!result.removed) throw EMBEDDED_ACTIVITY_LEAVE_MISSING_ACCESS;

    await (dependencies.updateSessionActivities ?? updateSessionActivities)(userId, sessionId, result.activities);

    await (dependencies.emitPresenceUpdate ?? emitEvent)({
        event: "PRESENCE_UPDATE",
        user_id: userId,
        data: {
            user: await (dependencies.getPublicUser ?? User.getPublicUser)(userId),
            status: getPublicStatus(session),
            activities: result.activities,
            client_status: session.client_status ?? {},
        },
    } satisfies Omit<PresenceUpdateEvent, "created_at">);

    return emptyLeaveResponse;
}

export function createEmbeddedActivityInstanceLeaveRouter(dependencies: EmbeddedActivityLeaveDependencies = {}) {
    const router: Router = Router({ mergeParams: true });

    router.post(
        "/",
        route({
            summary: "Leave Embedded Activity Instance",
            description:
                "Leaves a locally persisted embedded activity instance for the authenticated user's own session and voice location. The route fails closed when the session, voice state, or matching activity instance cannot be verified locally.",
            requestBody: "EmbeddedActivityInstanceLeaveSchema",
            coerceRequestBody: false,
            responses: {
                200: {
                    body: "EmbeddedActivityInstanceLeaveResponse",
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
            const body = req.body as EmbeddedActivityInstanceLeaveSchema;
            const response = await leaveEmbeddedActivityInstance(
                {
                    applicationId: req.params.application_id as string,
                    locationId: req.params.instance_location_id as string,
                    instanceId: req.params.instance_instance_id as string,
                    sessionId: body.session_id,
                    userId: req.user_id,
                },
                dependencies,
            );

            return res.status(200).json(response);
        },
    );

    return router;
}

export default createEmbeddedActivityInstanceLeaveRouter();
