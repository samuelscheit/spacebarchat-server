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
import { PublicUserProjection, RelationshipType, type PresenceResponseActivity, type PresenceResponsePresence, type PresencesResponse } from "@spacebar/schemas";
import { Relationship, Session, getMostRelevantSession } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { In } from "typeorm";

const router: Router = Router({ mergeParams: true });

type PresenceSession = Pick<Session, "activities" | "client_status" | "status" | "user_id">;
type PresenceRelationship = Pick<Relationship, "to_id"> & {
    to?: {
        toPublicUser(): PresenceResponsePresence["user"];
    };
};

function getPublicSessionStatus(session: PresenceSession): PresenceResponsePresence["status"] {
    if (session.status === "invisible") return "offline";
    if (session.status === "unknown") return "online";
    return session.status;
}

function sessionsByUserId(sessions: PresenceSession[]): Map<string, PresenceSession[]> {
    const grouped = new Map<string, PresenceSession[]>();

    for (const session of sessions) {
        if (!grouped.has(session.user_id)) grouped.set(session.user_id, []);
        grouped.get(session.user_id)!.push(session);
    }

    return grouped;
}

export function serializePresence(relationship: PresenceRelationship, session: PresenceSession | undefined): PresenceResponsePresence | undefined {
    if (!session) return undefined;

    const status = getPublicSessionStatus(session);
    const activities = (session.activities ?? []) as PresenceResponseActivity[];
    if (status === "offline" || activities.length === 0) return undefined;

    const user = relationship.to?.toPublicUser();
    if (!user) return undefined;

    return {
        user,
        status,
        activities,
        client_status: session.client_status ?? {},
    };
}

export async function buildPresencesResponse(userId: string): Promise<PresencesResponse> {
    const relationships = (await Relationship.find({
        where: {
            from_id: userId,
            type: RelationshipType.friends,
        },
        relations: {
            to: true,
        },
        select: {
            to_id: true,
            to: Object.fromEntries(PublicUserProjection.map((field) => [field, true])),
        },
        order: {
            to_id: "ASC",
        },
    })) as PresenceRelationship[];

    const friendIds = relationships.map((relationship) => relationship.to_id);
    if (!friendIds.length)
        return {
            guilds: [],
            presences: [],
            applications: [],
        };

    const sessions = (await Session.find({
        where: {
            user_id: In(friendIds),
            is_admin_session: false,
        },
        select: {
            user_id: true,
            status: true,
            activities: true,
            client_status: true,
        },
    })) as PresenceSession[];

    const sessionsByUser = sessionsByUserId(sessions);
    const presences = relationships.flatMap((relationship) => {
        const session = getMostRelevantSession((sessionsByUser.get(relationship.to_id) ?? []) as Session[]) as PresenceSession | undefined;
        const presence = serializePresence(relationship, session);
        return presence ? [presence] : [];
    });

    return {
        // Spacebar currently persists friend sessions, but not Discord's
        // implicit-relationship, voice-guild discovery, or application-discovery
        // payloads for this endpoint. Keep those fields truthful instead of
        // synthesizing partial Discord data.
        guilds: [],
        presences,
        applications: [],
    };
}

router.get(
    "/",
    route({
        summary: "Get Presences",
        responses: {
            200: {
                body: "PresencesResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => res.json(await buildPresencesResponse(req.user_id)),
);

export default router;
