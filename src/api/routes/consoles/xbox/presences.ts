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
import { PublicUserProjection, RelationshipType, type XboxPresence, type XboxPresenceActivity, type XboxPresencesResponse } from "@spacebar/schemas";
import { ConnectedAccount, DiscordApiErrors, Relationship, Session, getMostRelevantSession } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { In, Not } from "typeorm";

const router: Router = Router({ mergeParams: true });

export const XBOX_PRESENCES_APPLICATION_ID = "622174530214821906";
export const XBOX_PRESENCES_REQUIRED_SCOPE = "activities.read";

type OAuthScopeToken = {
    scope?: unknown;
    scopes?: unknown;
    scp?: unknown;
    application_id?: unknown;
    client_id?: unknown;
    azp?: unknown;
    aud?: unknown;
    application?: unknown;
};

type XboxPresenceSession = Pick<Session, "activities" | "client_status" | "status" | "user_id">;
type XboxPresenceRelationship = Pick<Relationship, "to_id"> & {
    to?: {
        toPublicUser(): XboxPresence["user"];
    };
};
type XboxConnectedAccountSource = Pick<ConnectedAccount, "external_id" | "user_id">;

function scopeValues(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap(scopeValues);
    if (typeof value !== "string") return [];

    return value
        .split(/[\s,]+/)
        .map((scope) => scope.trim())
        .filter(Boolean);
}

function stringValue(value: unknown): string | undefined {
    return typeof value === "string" && value ? value : undefined;
}

function nestedApplicationId(value: unknown): string | undefined {
    if (!value || typeof value !== "object") return undefined;
    return stringValue((value as { id?: unknown }).id);
}

export function hasXboxPresencesOAuthScope(token: unknown, requiredScope = XBOX_PRESENCES_REQUIRED_SCOPE): boolean {
    if (!token || typeof token !== "object") return false;

    const scopeToken = token as OAuthScopeToken;
    return [...scopeValues(scopeToken.scope), ...scopeValues(scopeToken.scopes), ...scopeValues(scopeToken.scp)].includes(requiredScope);
}

export function getXboxPresencesApplicationId(token: unknown): string | undefined {
    if (!token || typeof token !== "object") return undefined;

    const scopeToken = token as OAuthScopeToken;
    return (
        stringValue(scopeToken.application_id) ??
        stringValue(scopeToken.client_id) ??
        nestedApplicationId(scopeToken.application) ??
        stringValue(scopeToken.azp) ??
        stringValue(scopeToken.aud)
    );
}

export function assertXboxPresencesOAuthToken(token: unknown): void {
    if (!hasXboxPresencesOAuthScope(token)) throw DiscordApiErrors.MISSING_REQUIRED_OAUTH2_SCOPE;
    if (getXboxPresencesApplicationId(token) !== XBOX_PRESENCES_APPLICATION_ID) throw DiscordApiErrors.INVALID_OAUTH_TOKEN;
}

function getPublicSessionStatus(session: XboxPresenceSession): XboxPresence["status"] {
    if (session.status === "invisible") return "offline";
    if (session.status === "unknown") return "online";
    return session.status;
}

function sessionsByUserId(sessions: XboxPresenceSession[]): Map<string, XboxPresenceSession[]> {
    const grouped = new Map<string, XboxPresenceSession[]>();

    for (const session of sessions) {
        if (!grouped.has(session.user_id)) grouped.set(session.user_id, []);
        grouped.get(session.user_id)!.push(session);
    }

    return grouped;
}

export function serializeXboxPresence(relationship: XboxPresenceRelationship, session: XboxPresenceSession | undefined): XboxPresence | undefined {
    if (!session) return undefined;

    const status = getPublicSessionStatus(session);
    const activities = (session.activities ?? []) as XboxPresenceActivity[];
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

export function serializeXboxConnectedAccountIds(userIds: string[], accounts: XboxConnectedAccountSource[]): XboxPresencesResponse["connected_account_ids"] {
    const userIdSet = new Set(userIds);
    const providerIdsByUserId = new Map<string, string[]>();

    for (const account of accounts) {
        if (!userIdSet.has(account.user_id)) continue;
        if (!providerIdsByUserId.has(account.user_id)) providerIdsByUserId.set(account.user_id, []);
        providerIdsByUserId.get(account.user_id)!.push(account.external_id);
    }

    return userIds.flatMap((user_id) => {
        const provider_ids = providerIdsByUserId.get(user_id);
        if (!provider_ids?.length) return [];
        return [{ user_id, provider_ids: [...new Set(provider_ids)].sort() }];
    });
}

export async function buildXboxPresencesResponse(userId: string): Promise<XboxPresencesResponse> {
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
    })) as XboxPresenceRelationship[];

    const friendIds = relationships.map((relationship) => relationship.to_id);
    if (!friendIds.length)
        return {
            guilds: [],
            presences: [],
            applications: [],
            connected_account_ids: [],
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
    })) as XboxPresenceSession[];

    const sessionsByUser = sessionsByUserId(sessions);
    const presences = relationships.flatMap((relationship) => {
        const session = getMostRelevantSession((sessionsByUser.get(relationship.to_id) ?? []) as Session[]) as XboxPresenceSession | undefined;
        const presence = serializeXboxPresence(relationship, session);
        return presence ? [presence] : [];
    });
    const presenceUserIds = presences.map((presence) => presence.user.id);

    const accounts = presenceUserIds.length
        ? ((await ConnectedAccount.find({
              where: {
                  user_id: In(presenceUserIds),
                  type: "xbox",
                  revoked: false,
                  visibility: Not(0),
              },
              select: {
                  external_id: true,
                  user_id: true,
              },
              order: {
                  user_id: "ASC",
                  external_id: "ASC",
              },
          })) as XboxConnectedAccountSource[])
        : [];

    return {
        // Spacebar does not persist Discord's Xbox-specific voice guild or application
        // discovery payloads yet, so only return data backed by local sessions/accounts.
        guilds: [],
        presences,
        applications: [],
        connected_account_ids: serializeXboxConnectedAccountIds(presenceUserIds, accounts),
    };
}

router.get(
    "/",
    route({
        summary: "Get Presences for Xbox",
        responses: {
            200: {
                body: "XboxPresencesResponse",
            },
            400: {
                body: "APIErrorResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        assertXboxPresencesOAuthToken(req.token);

        return res.json(await buildXboxPresencesResponse(req.user_id));
    },
);

export default router;
