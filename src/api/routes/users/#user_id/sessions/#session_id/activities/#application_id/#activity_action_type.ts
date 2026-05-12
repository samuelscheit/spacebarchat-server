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
import { MessageActivityType, RelationshipType, type ActivitySecretResponse } from "@spacebar/schemas";
import { ApiError, DiscordApiErrors, Relationship, Session, VoiceState, type Activity } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { In } from "typeorm";

const router: Router = Router({ mergeParams: true });

export const ACTIVITY_SECRET_MISSING_ACCESS = new ApiError(DiscordApiErrors.MISSING_ACCESS.message, DiscordApiErrors.MISSING_ACCESS.code, 403);
export const ACTIVITY_SECRET_UNKNOWN_SESSION = new ApiError(DiscordApiErrors.UNKNOWN_SESSION.message, DiscordApiErrors.UNKNOWN_SESSION.code, 404);

export const ActivitySecretFlags = {
    JOIN: 1 << 1,
    SPECTATE: 1 << 2,
    PARTY_PRIVACY_FRIENDS: 1 << 6,
    PARTY_PRIVACY_VOICE_CHANNEL: 1 << 7,
} as const;

export type ActivitySecretSession = Pick<Session, "session_id" | "status" | "user_id"> & {
    activities?: Activity[];
};

export type ActivitySecretVoiceState = Pick<VoiceState, "channel_id" | "user_id">;

export type ActivitySecretDependencies = {
    findSession?: (userId: string, sessionId: string) => Promise<ActivitySecretSession | null>;
    countFriendRelationship?: (fromUserId: string, toUserId: string) => Promise<number>;
    findVoiceStates?: (requesterId: string, targetUserId: string) => Promise<ActivitySecretVoiceState[]>;
};

function parseActivityFlags(flags: unknown): bigint {
    if (typeof flags === "bigint") return flags;
    if (typeof flags === "number" && Number.isFinite(flags)) return BigInt(Math.trunc(flags));
    if (typeof flags !== "string" || !flags.trim()) return 0n;

    try {
        return BigInt(flags);
    } catch {
        return 0n;
    }
}

export function activityHasFlag(activity: Activity, flag: number): boolean {
    return (parseActivityFlags(activity.flags) & BigInt(flag)) !== 0n;
}

function nonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.length > 0;
}

export function findActivityForSecret(activities: Activity[] | undefined, applicationId: string): Activity | undefined {
    return (activities ?? []).find((activity) => activity.application_id === applicationId);
}

function parseActivityActionType(actionType: string): MessageActivityType.JOIN | MessageActivityType.SPECTATE {
    switch (actionType) {
        case String(MessageActivityType.JOIN):
            return MessageActivityType.JOIN;
        case String(MessageActivityType.SPECTATE):
            return MessageActivityType.SPECTATE;
        default:
            throw ACTIVITY_SECRET_MISSING_ACCESS;
    }
}

function getActionFlag(actionType: MessageActivityType.JOIN | MessageActivityType.SPECTATE) {
    return actionType === MessageActivityType.JOIN ? ActivitySecretFlags.JOIN : ActivitySecretFlags.SPECTATE;
}

function getActivitySecret(activity: Activity, actionType: MessageActivityType.JOIN | MessageActivityType.SPECTATE): string | undefined {
    const secret = actionType === MessageActivityType.JOIN ? activity.secrets?.join : activity.secrets?.spectate;
    return nonEmptyString(secret) ? secret : undefined;
}

function isExternallyVisibleSession(session: ActivitySecretSession) {
    return session.status !== "offline" && session.status !== "invisible";
}

async function findSession(userId: string, sessionId: string): Promise<ActivitySecretSession | null> {
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
        },
    }) as Promise<ActivitySecretSession | null>;
}

async function countFriendRelationship(fromUserId: string, toUserId: string) {
    return Relationship.count({
        where: {
            from_id: fromUserId,
            to_id: toUserId,
            type: RelationshipType.friends,
        },
    });
}

async function findVoiceStates(requesterId: string, targetUserId: string) {
    return VoiceState.find({
        where: {
            user_id: In([requesterId, targetUserId]),
        },
        select: {
            user_id: true,
            channel_id: true,
        },
    }) as Promise<ActivitySecretVoiceState[]>;
}

export async function usersSharePersistedVoiceChannel(requesterId: string, targetUserId: string, dependencies: ActivitySecretDependencies = {}) {
    const voiceStates = await (dependencies.findVoiceStates ?? findVoiceStates)(requesterId, targetUserId);
    const requesterChannelIds = new Set(
        voiceStates
            .filter((voiceState) => voiceState.user_id === requesterId)
            .map((voiceState) => voiceState.channel_id)
            .filter(nonEmptyString),
    );

    return voiceStates.some((voiceState) => voiceState.user_id === targetUserId && nonEmptyString(voiceState.channel_id) && requesterChannelIds.has(voiceState.channel_id));
}

export async function getActivitySecretResponse(
    requesterId: string,
    targetUserId: string,
    sessionId: string,
    applicationId: string,
    activityActionType: string,
    dependencies: ActivitySecretDependencies = {},
): Promise<ActivitySecretResponse> {
    const actionType = parseActivityActionType(activityActionType);
    const isSelf = requesterId === targetUserId;
    const [friendRelationshipCount, sharesVoiceChannel] = isSelf
        ? [1, true]
        : await Promise.all([
              (dependencies.countFriendRelationship ?? countFriendRelationship)(requesterId, targetUserId),
              usersSharePersistedVoiceChannel(requesterId, targetUserId, dependencies),
          ]);

    if (!isSelf && friendRelationshipCount < 1 && !sharesVoiceChannel) throw ACTIVITY_SECRET_MISSING_ACCESS;

    const session = await (dependencies.findSession ?? findSession)(targetUserId, sessionId);
    if (!session) throw ACTIVITY_SECRET_UNKNOWN_SESSION;
    if (!isSelf && !isExternallyVisibleSession(session)) throw ACTIVITY_SECRET_MISSING_ACCESS;

    const activity = findActivityForSecret(session.activities, applicationId);
    if (!activity) throw ACTIVITY_SECRET_MISSING_ACCESS;
    if (!activityHasFlag(activity, getActionFlag(actionType))) throw ACTIVITY_SECRET_MISSING_ACCESS;

    const secret = getActivitySecret(activity, actionType);
    if (!secret) throw ACTIVITY_SECRET_MISSING_ACCESS;

    if (
        !isSelf &&
        !(
            (friendRelationshipCount > 0 && activityHasFlag(activity, ActivitySecretFlags.PARTY_PRIVACY_FRIENDS)) ||
            (sharesVoiceChannel && activityHasFlag(activity, ActivitySecretFlags.PARTY_PRIVACY_VOICE_CHANNEL))
        )
    ) {
        throw ACTIVITY_SECRET_MISSING_ACCESS;
    }

    return { secret };
}

router.get(
    "/",
    route({
        summary: "Get Activity Secret",
        description:
            "Returns a locally persisted join or spectate activity secret when the target session, activity flags, and locally verifiable party privacy rules allow access.",
        query: {
            channel_id: {
                type: "string",
                description: "The channel ID of a rich presence invite message.",
            },
            message_id: {
                type: "string",
                description: "The message ID of a rich presence invite message.",
            },
        },
        responses: {
            200: {
                body: "ActivitySecretResponse",
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
        const secret = await getActivitySecretResponse(
            req.user_id,
            req.params.user_id as string,
            req.params.session_id as string,
            req.params.application_id as string,
            req.params.activity_action_type as string,
        );

        return res.json(secret);
    },
);

export default router;
