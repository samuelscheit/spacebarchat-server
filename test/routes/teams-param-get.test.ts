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

import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { describe, test } from "node:test";
import express from "express";
import { TeamMemberRole, TeamMemberState } from "../../src/schemas/api/developers/Team";
import { MISSING_TEAM_ACCESS_ERROR, UNKNOWN_TEAM_ERROR, createTeamRouter, getTeam, type TeamGetRepositories, type TeamGetTarget } from "../../src/api/routes/teams/#team_id";

function team(overrides: Partial<TeamGetTarget> = {}): TeamGetTarget {
    return {
        id: "team-1",
        icon: undefined,
        members: [
            {
                id: "member-row",
                membership_state: TeamMemberState.ACCEPTED,
                permissions: ["*"],
                role: TeamMemberRole.ADMIN,
                team_id: "team-1",
                user_id: "member",
            },
        ],
        name: "Example Team",
        owner_user_id: "owner",
        ...overrides,
    };
}

function createApp(repositories: TeamGetRepositories, userId = "owner") {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = userId;
        next();
    });
    app.use("/teams/:team_id", createTeamRouter(repositories));
    app.use((error: { code?: number | string; httpStatus?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(error.httpStatus ?? 400).json({ code: error.code, message: error.message });
    });

    return app;
}

async function requestJson(app: express.Express, pathname: string) {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
    const port = (address as AddressInfo).port;

    try {
        const response = await fetch(`http://127.0.0.1:${port}${pathname}`);
        const body = (await response.json()) as unknown;
        return { status: response.status, body };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

describe("GET /teams/:team_id", () => {
    test("returns the requested team for the team owner", async (t) => {
        const teamRepository = {
            findOne: t.mock.fn(async (_options: unknown) => team()),
        };

        assert.deepEqual(await getTeam("team-1", "owner", { teamRepository }), {
            id: "team-1",
            icon: null,
            members: [
                {
                    id: "member-row",
                    membership_state: TeamMemberState.ACCEPTED,
                    permissions: ["*"],
                    role: TeamMemberRole.ADMIN,
                    team_id: "team-1",
                    user_id: "member",
                },
            ],
            name: "Example Team",
            owner_user_id: "owner",
        });
        assert.deepEqual(teamRepository.findOne.mock.calls[0].arguments[0], {
            where: { id: "team-1" },
            relations: { members: true },
        });
    });

    test("allows accepted team members to fetch the team", async (t) => {
        const teamRepository = {
            findOne: t.mock.fn(async (_options: unknown) => team()),
        };

        const response = await getTeam("team-1", "member", { teamRepository });

        assert.equal(response.id, "team-1");
        assert.equal(teamRepository.findOne.mock.callCount(), 1);
    });

    test("rejects users who are not accepted team members", async (t) => {
        const teamRepository = {
            findOne: t.mock.fn(async (_options: unknown) =>
                team({
                    members: [
                        {
                            id: "invited-row",
                            membership_state: TeamMemberState.INVITED,
                            permissions: [],
                            role: TeamMemberRole.READ_ONLY,
                            team_id: "team-1",
                            user_id: "invited-member",
                        },
                    ],
                }),
            ),
        };

        await assert.rejects(
            () => getTeam("team-1", "invited-member", { teamRepository }),
            (error) => error === MISSING_TEAM_ACCESS_ERROR,
        );
    });

    test("returns unknown team when the team does not exist", async (t) => {
        const teamRepository = {
            findOne: t.mock.fn(async (_options: unknown) => null),
        };

        await assert.rejects(
            () => getTeam("missing-team", "owner", { teamRepository }),
            (error) => error === UNKNOWN_TEAM_ERROR,
        );
    });

    test("returns the mounted route response", async (t) => {
        const repositories = {
            teamRepository: {
                findOne: t.mock.fn(async (_options: unknown) => team()),
            },
        };

        const response = await requestJson(createApp(repositories), "/teams/team-1");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            id: "team-1",
            icon: null,
            members: [
                {
                    id: "member-row",
                    membership_state: TeamMemberState.ACCEPTED,
                    permissions: ["*"],
                    role: TeamMemberRole.ADMIN,
                    team_id: "team-1",
                    user_id: "member",
                },
            ],
            name: "Example Team",
            owner_user_id: "owner",
        });
    });

    test("returns missing access from the mounted route for non-members", async (t) => {
        const repositories = {
            teamRepository: {
                findOne: t.mock.fn(async (_options: unknown) => team({ members: [] })),
            },
        };

        const response = await requestJson(createApp(repositories, "not-a-member"), "/teams/team-1");

        assert.equal(response.status, 403);
        assert.deepEqual(response.body, {
            code: MISSING_TEAM_ACCESS_ERROR.code,
            message: MISSING_TEAM_ACCESS_ERROR.message,
        });
    });

    test("declares authenticated metadata, query parsing, and response schemas", () => {
        const source = fs.readFileSync(path.join(process.cwd(), "src", "api", "routes", "teams", "#team_id", "index.ts"), "utf8");

        assert.match(source, /router\.get\(\s*["']\/["']/);
        assert.match(source, /summary:\s*"Get Team"/);
        assert.match(source, /include_payout_account_status:\s*\{\s*type:\s*"boolean"/);
        assert.match(source, /200:\s*\{\s*body:\s*"TeamResponse"/);
        assert.match(source, /401:\s*\{\s*body:\s*"APIErrorResponse"/);
        assert.match(source, /403:\s*\{\s*body:\s*"APIErrorResponse"/);
        assert.match(source, /404:\s*\{\s*body:\s*"APIErrorResponse"/);
    });
});
