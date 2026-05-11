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
import { TeamMemberState } from "../../src/schemas/api/developers/Team";
import {
    MISSING_TEAM_IDENTITY_VERIFICATION_ACCESS_ERROR,
    TEAM_IDENTITY_VERIFICATION_UNSUPPORTED_MESSAGE,
    UNKNOWN_TEAM_IDENTITY_VERIFICATION_TEAM_ERROR,
    createTeamIdentityVerificationRouter,
    getTeamIdentityVerification,
    type TeamIdentityVerificationRepositories,
    type TeamIdentityVerificationTarget,
} from "../../src/api/routes/teams/#team_id/identity/verification";

const coveredManifestIds = ["api:http:GET:/teams/:team_id/identity/verification/"];

function team(overrides: Partial<TeamIdentityVerificationTarget> = {}): TeamIdentityVerificationTarget {
    return {
        members: [
            {
                membership_state: TeamMemberState.ACCEPTED,
                user_id: "member",
            },
        ],
        owner_user_id: "owner",
        ...overrides,
    };
}

function createApp(repositories: TeamIdentityVerificationRepositories, userId = "owner") {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = userId;
        next();
    });
    app.use("/teams/:team_id/identity/verification", createTeamIdentityVerificationRouter(repositories));
    app.use((error: { code?: number | string; httpStatus?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(error.httpStatus ?? 400).json({ code: error.code, message: error.message });
    });

    return app;
}

async function requestJson(app: express.Express, requestPath: string) {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
    const port = (address as AddressInfo).port;

    try {
        const response = await fetch(`http://127.0.0.1:${port}${requestPath}`);
        const body = (await response.json()) as unknown;
        return { status: response.status, body };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

describe("GET /teams/:team_id/identity/verification", () => {
    test("declares the assigned manifest route id", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/teams/:team_id/identity/verification/"]);
    });

    test("queries the team and fails closed for the team owner", async (t) => {
        const teamRepository = {
            findOne: t.mock.fn(async (_options: unknown) => team()),
        };

        await assert.rejects(
            () => getTeamIdentityVerification("team-1", "owner", { teamRepository }),
            (error: { code?: number; httpStatus?: number; message?: string }) =>
                error.code === 0 && error.httpStatus === 501 && error.message === TEAM_IDENTITY_VERIFICATION_UNSUPPORTED_MESSAGE,
        );
        assert.deepEqual(teamRepository.findOne.mock.calls[0].arguments[0], {
            where: { id: "team-1" },
            relations: { members: true },
        });
    });

    test("allows accepted team members through authorization before failing closed", async (t) => {
        const teamRepository = {
            findOne: t.mock.fn(async (_options: unknown) => team()),
        };

        await assert.rejects(
            () => getTeamIdentityVerification("team-1", "member", { teamRepository }),
            (error: { code?: number; httpStatus?: number; message?: string }) =>
                error.code === 0 && error.httpStatus === 501 && error.message === TEAM_IDENTITY_VERIFICATION_UNSUPPORTED_MESSAGE,
        );
        assert.equal(teamRepository.findOne.mock.callCount(), 1);
    });

    test("rejects users who are not accepted team members before unsupported handling", async (t) => {
        const teamRepository = {
            findOne: t.mock.fn(async (_options: unknown) =>
                team({
                    members: [
                        {
                            membership_state: TeamMemberState.INVITED,
                            user_id: "invited-member",
                        },
                    ],
                }),
            ),
        };

        await assert.rejects(
            () => getTeamIdentityVerification("team-1", "invited-member", { teamRepository }),
            (error) => error === MISSING_TEAM_IDENTITY_VERIFICATION_ACCESS_ERROR,
        );
    });

    test("returns unknown team when the team does not exist", async (t) => {
        const teamRepository = {
            findOne: t.mock.fn(async (_options: unknown) => null),
        };

        await assert.rejects(
            () => getTeamIdentityVerification("missing-team", "owner", { teamRepository }),
            (error) => error === UNKNOWN_TEAM_IDENTITY_VERIFICATION_TEAM_ERROR,
        );
    });

    test("returns the mounted unsupported route response for authorized team users", async (t) => {
        const repositories = {
            teamRepository: {
                findOne: t.mock.fn(async (_options: unknown) => team()),
            },
        };

        const response = await requestJson(createApp(repositories), "/teams/team-1/identity/verification");

        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: 0,
            message: TEAM_IDENTITY_VERIFICATION_UNSUPPORTED_MESSAGE,
        });
    });

    test("returns missing access from the mounted route for non-members", async (t) => {
        const repositories = {
            teamRepository: {
                findOne: t.mock.fn(async (_options: unknown) => team({ members: [] })),
            },
        };

        const response = await requestJson(createApp(repositories, "not-a-member"), "/teams/team-1/identity/verification");

        assert.equal(response.status, 403);
        assert.deepEqual(response.body, {
            code: MISSING_TEAM_IDENTITY_VERIFICATION_ACCESS_ERROR.code,
            message: MISSING_TEAM_IDENTITY_VERIFICATION_ACCESS_ERROR.message,
        });
    });

    test("declares authenticated metadata and explicit unsupported response schema", () => {
        const source = fs.readFileSync(path.join(process.cwd(), "src", "api", "routes", "teams", "#team_id", "identity", "verification.ts"), "utf8");

        assert.match(source, /summary:\s*"Get Team Identity Verification"/);
        assert.match(source, /does not currently persist that state or integrate with an identity provider/);
        assert.match(source, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(source, /403:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(source, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(source, /501:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(source, /200:\s*\{/);
        assert.doesNotMatch(source, /redirect_url/);
    });
});
