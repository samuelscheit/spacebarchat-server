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
import { TeamMemberState } from "@spacebar/schemas";
import { ApiError, Team } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";

export const TEAM_PAYOUTS_DEFAULT_LIMIT = 96;
export const TEAM_PAYOUTS_MIN_LIMIT = 1;
export const TEAM_PAYOUTS_MAX_LIMIT = 96;
export const TEAM_PAYOUTS_UNSUPPORTED_MESSAGE = "Team payouts are not supported on this Spacebar instance.";

export type TeamPayoutsMember = {
    membership_state: TeamMemberState;
    user_id?: string | null;
};

export type TeamPayoutsTarget = {
    members?: TeamPayoutsMember[] | null;
    owner_user_id?: string | null;
};

export type TeamPayoutsRepository = {
    findOne(options: unknown): Promise<TeamPayoutsTarget | null>;
};

export type TeamPayoutsRepositories = {
    teamRepository?: TeamPayoutsRepository;
};

export type TeamPayoutsQuery = {
    after?: string;
    limit: number;
};

export const UNKNOWN_TEAM_PAYOUTS_TEAM_ERROR = new ApiError("Unknown Team", 10039, 404);
export const MISSING_TEAM_PAYOUTS_ACCESS_ERROR = new ApiError("Missing Access", 50001, 403);

function getTeamRepository(repository?: TeamPayoutsRepository): TeamPayoutsRepository {
    return repository ?? (Team as unknown as TeamPayoutsRepository);
}

function firstQueryValue(value: unknown): unknown {
    return Array.isArray(value) ? firstQueryValue(value[0]) : value;
}

function queryValueString(value: unknown): string | undefined {
    const scalar = firstQueryValue(value);
    if (scalar === undefined) return undefined;
    if (typeof scalar !== "string" && typeof scalar !== "number") return undefined;

    return String(scalar).trim();
}

export function parseTeamPayoutsLimit(value: unknown): number {
    const rawLimit = queryValueString(value);
    if (rawLimit === undefined) return TEAM_PAYOUTS_DEFAULT_LIMIT;
    if (!/^\d+$/.test(rawLimit)) throw new HTTPError("limit must be between 1 and 96", 400);

    const limit = Number(rawLimit);
    if (!Number.isInteger(limit) || limit < TEAM_PAYOUTS_MIN_LIMIT || limit > TEAM_PAYOUTS_MAX_LIMIT) {
        throw new HTTPError("limit must be between 1 and 96", 400);
    }

    return limit;
}

export function parseTeamPayoutsAfter(value: unknown): string | undefined {
    const after = queryValueString(value);
    if (after === undefined) return undefined;
    if (!/^[1-9]\d{16,19}$/.test(after)) throw new HTTPError("after must be a snowflake", 400);

    return after;
}

export function parseTeamPayoutsQuery(query: Request["query"]): TeamPayoutsQuery {
    return {
        after: parseTeamPayoutsAfter(query.after),
        limit: parseTeamPayoutsLimit(query.limit),
    };
}

export function canAccessTeamPayouts(team: TeamPayoutsTarget, userId: string) {
    if (team.owner_user_id === userId) return true;

    return team.members?.some((member) => member.user_id === userId && member.membership_state === TeamMemberState.ACCEPTED) ?? false;
}

export function createTeamPayoutsUnsupportedError(): ApiError {
    return new ApiError(TEAM_PAYOUTS_UNSUPPORTED_MESSAGE, 0, 501);
}

export async function getTeamPayouts(teamId: string, userId: string, rawQuery: Request["query"] = {}, repositories: TeamPayoutsRepositories = {}): Promise<never> {
    const teamRepository = getTeamRepository(repositories.teamRepository);
    const team = await teamRepository.findOne({
        where: { id: teamId },
        relations: { members: true },
    });

    if (!team) throw UNKNOWN_TEAM_PAYOUTS_TEAM_ERROR;
    if (!canAccessTeamPayouts(team, userId)) throw MISSING_TEAM_PAYOUTS_ACCESS_ERROR;

    const query = parseTeamPayoutsQuery(rawQuery);
    void query.after;
    void query.limit;

    // Discord returns provider-backed payout records. Spacebar does not persist
    // payout records or integrate with a payout provider, so fail closed instead
    // of returning an empty page that could misrepresent payout state.
    throw createTeamPayoutsUnsupportedError();
}

export function createTeamPayoutsRouter(repositories: TeamPayoutsRepositories = {}) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Team Payouts",
            description:
                "Returns team payout records for the given team. This Discord endpoint depends on provider-backed payout state; Spacebar does not currently persist payout records or integrate with a payout provider, so this compatibility endpoint fails closed after team access checks.",
            query: {
                limit: {
                    type: "number",
                    required: false,
                    description: "Max number of payouts to return (1-96, default 96).",
                },
                after: {
                    type: "string",
                    required: false,
                    description: "Return payouts after this payout ID.",
                },
            },
            responses: {
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
                501: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, _res: Response) => {
            await getTeamPayouts(req.params.team_id as string, req.user_id, req.query, repositories);
        },
    );

    return router;
}

export default createTeamPayoutsRouter();
