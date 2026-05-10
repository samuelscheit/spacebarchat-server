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
import http from "node:http";
import type { AddressInfo } from "node:net";
import { describe, test } from "node:test";
import express from "express";
import { TeamMemberState } from "../../src/schemas/api/developers/Team";
import {
    MISSING_TEAM_APPLICATIONS_ACCESS_ERROR,
    UNKNOWN_TEAM_APPLICATIONS_ERROR,
    createTeamApplicationsRouter,
    getTeamApplications,
    type TeamApplicationsRepositories,
} from "../../src/api/routes/teams/#team_id/applications";

function createApp(repositories: TeamApplicationsRepositories, userId = "owner") {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = userId;
        next();
    });
    app.use("/teams/:team_id/applications", createTeamApplicationsRouter(repositories));
    app.use((error: { code?: number | string; httpStatus?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(error.httpStatus ?? 400).json({ code: error.code, message: error.message });
    });

    return app;
}

async function requestJson(app: express.Express, path: string) {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
    const port = (address as AddressInfo).port;

    try {
        const response = await fetch(`http://127.0.0.1:${port}${path}`);
        const body = (await response.json()) as unknown;
        return { status: response.status, body };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

describe("GET /teams/:team_id/applications", () => {
    test("returns team-owned applications for the team owner", async (t) => {
        const applications = [
            {
                id: "app-1",
                name: "Team App",
                description: "A team-owned app",
                flags: 0,
            },
        ];
        const teamRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({ owner_user_id: "owner", members: [] })),
        };
        const applicationRepository = {
            find: t.mock.fn(async (_options: unknown) => applications),
        };

        assert.deepEqual(await getTeamApplications("team-1", "owner", { teamRepository, applicationRepository }), applications);
        assert.deepEqual(teamRepository.findOne.mock.calls[0].arguments[0], {
            where: { id: "team-1" },
            relations: { members: true },
        });
        assert.deepEqual(applicationRepository.find.mock.calls[0].arguments[0], {
            where: { team: { id: "team-1" } },
            relations: { owner: true, bot: true },
            order: { id: "ASC" },
        });
    });

    test("allows accepted team members to list applications", async (t) => {
        const teamRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                owner_user_id: "owner",
                members: [
                    {
                        user_id: "member",
                        membership_state: TeamMemberState.ACCEPTED,
                    },
                ],
            })),
        };
        const applicationRepository = {
            find: t.mock.fn(async (_options: unknown) => []),
        };

        assert.deepEqual(await getTeamApplications("team-1", "member", { teamRepository, applicationRepository }), []);
        assert.equal(applicationRepository.find.mock.callCount(), 1);
    });

    test("rejects users who are not accepted team members", async (t) => {
        const teamRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                owner_user_id: "owner",
                members: [
                    {
                        user_id: "invited-member",
                        membership_state: TeamMemberState.INVITED,
                    },
                ],
            })),
        };
        const applicationRepository = {
            find: t.mock.fn(async (_options: unknown) => []),
        };

        await assert.rejects(
            () => getTeamApplications("team-1", "invited-member", { teamRepository, applicationRepository }),
            (error) => error === MISSING_TEAM_APPLICATIONS_ACCESS_ERROR,
        );
        assert.equal(applicationRepository.find.mock.callCount(), 0);
    });

    test("returns unknown team before querying applications", async (t) => {
        const teamRepository = {
            findOne: t.mock.fn(async (_options: unknown) => null),
        };
        const applicationRepository = {
            find: t.mock.fn(async (_options: unknown) => []),
        };

        await assert.rejects(
            () => getTeamApplications("missing-team", "owner", { teamRepository, applicationRepository }),
            (error) => error === UNKNOWN_TEAM_APPLICATIONS_ERROR,
        );
        assert.equal(applicationRepository.find.mock.callCount(), 0);
    });

    test("returns the mounted route response", async (t) => {
        const repositories = {
            teamRepository: {
                findOne: t.mock.fn(async (_options: unknown) => ({ owner_user_id: "owner", members: [] })),
            },
            applicationRepository: {
                find: t.mock.fn(async (_options: unknown) => [
                    {
                        id: "app-1",
                        name: "Team App",
                        description: "A team-owned app",
                        flags: 0,
                    },
                ]),
            },
        };

        const response = await requestJson(createApp(repositories), "/teams/team-1/applications");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, [
            {
                id: "app-1",
                name: "Team App",
                description: "A team-owned app",
                flags: 0,
            },
        ]);
    });

    test("returns missing access from the mounted route for non-members", async (t) => {
        const repositories = {
            teamRepository: {
                findOne: t.mock.fn(async (_options: unknown) => ({ owner_user_id: "owner", members: [] })),
            },
            applicationRepository: {
                find: t.mock.fn(async (_options: unknown) => []),
            },
        };

        const response = await requestJson(createApp(repositories, "not-a-member"), "/teams/team-1/applications");

        assert.equal(response.status, 403);
        assert.deepEqual(response.body, {
            code: MISSING_TEAM_APPLICATIONS_ACCESS_ERROR.code,
            message: MISSING_TEAM_APPLICATIONS_ACCESS_ERROR.message,
        });
    });
});
