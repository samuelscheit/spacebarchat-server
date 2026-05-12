/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTIBILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { route } from "@spacebar/api";
import { RelationshipType, type ActivityMetadataResponse } from "@spacebar/schemas";
import { ActivityType, ApiError, DiscordApiErrors, Relationship, Session, type Activity } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

export const ACTIVITY_METADATA_MISSING_ACCESS = new ApiError(DiscordApiErrors.MISSING_ACCESS.message, DiscordApiErrors.MISSING_ACCESS.code, 403);
export const ACTIVITY_METADATA_UNKNOWN_SESSION = new ApiError(DiscordApiErrors.UNKNOWN_SESSION.message, DiscordApiErrors.UNKNOWN_SESSION.code, 404);

export type ActivityMetadataSession = Pick<Session, "activities" | "session_id" | "status" | "user_id">;

export type ActivityMetadataDependencies = {
    findSession?: (userId: string, sessionId: string) => Promise<ActivityMetadataSession | null>;
    countFriendRelationship?: (fromUserId: string, toUserId: string) => Promise<number>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function activityHasApplicationId(activity: Activity, applicationId: string) {
    return activity.application_id === applicationId;
}

function activityIsUnassociatedListening(activity: Activity) {
    return activity.type === ActivityType.LISTENING && !activity.application_id;
}

export function findActivityForMetadata(activities: Activity[] | undefined, applicationId: string): Activity | undefined {
    const visibleActivities = activities ?? [];
    if (applicationId === "0") return visibleActivities.filter(activityIsUnassociatedListening).at(-1);

    return visibleActivities.find((activity) => activityHasApplicationId(activity, applicationId));
}

export function getActivityMetadataFromSession(session: ActivityMetadataSession, applicationId: string): ActivityMetadataResponse | undefined {
    const activity = findActivityForMetadata(session.activities, applicationId);
    const metadata = (activity as { metadata?: unknown } | undefined)?.metadata;

    if (!isRecord(metadata)) return undefined;
    return metadata as ActivityMetadataResponse;
}

async function findSession(userId: string, sessionId: string): Promise<ActivityMetadataSession | null> {
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
    }) as Promise<ActivityMetadataSession | null>;
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

function isExternallyVisibleSession(session: ActivityMetadataSession) {
    return session.status !== "offline" && session.status !== "invisible";
}

export async function getActivityMetadataResponse(
    requesterId: string,
    targetUserId: string,
    sessionId: string,
    applicationId: string,
    dependencies: ActivityMetadataDependencies = {},
): Promise<ActivityMetadataResponse | undefined> {
    const isSelf = requesterId === targetUserId;
    const relationshipCount = isSelf ? 1 : await (dependencies.countFriendRelationship ?? countFriendRelationship)(requesterId, targetUserId);
    if (relationshipCount < 1) throw ACTIVITY_METADATA_MISSING_ACCESS;

    const session = await (dependencies.findSession ?? findSession)(targetUserId, sessionId);
    if (!session) throw ACTIVITY_METADATA_UNKNOWN_SESSION;
    if (!isSelf && !isExternallyVisibleSession(session)) throw ACTIVITY_METADATA_MISSING_ACCESS;

    return getActivityMetadataFromSession(session, applicationId);
}

router.get(
    "/",
    route({
        summary: "Get Activity Metadata",
        responses: {
            200: {
                body: "ActivityMetadataResponse",
            },
            204: {},
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
        const metadata = await getActivityMetadataResponse(req.user_id, req.params.user_id as string, req.params.session_id as string, req.params.application_id as string);

        if (!metadata) return res.status(204).send();
        return res.json(metadata);
    },
);

export default router;
