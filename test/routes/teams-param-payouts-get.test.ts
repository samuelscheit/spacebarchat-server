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
    MISSING_TEAM_PAYOUTS_ACCESS_ERROR,
    TEAM_PAYOUTS_DEFAULT_LIMIT,
    TEAM_PAYOUTS_MAX_LIMIT,
    TEAM_PAYOUTS_UNSUPPORTED_MESSAGE,
    UNKNOWN_TEAM_PAYOUTS_TEAM_ERROR,
    createTeamPayoutsRouter,
    getTeamPayouts,
    parseTeamPayoutsQuery,
    type TeamPayoutsRepositories,
    type TeamPayoutsTarget,
} from "../../src/api/routes/teams/#team_id/payouts";

const coveredManifestIds = ["api:http:GET:/teams/:team_id/payouts/"];

function team(overrides: Partial<TeamPayoutsTarget> = {}): TeamPayoutsTarget {
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

function createApp(repositories: TeamPayoutsRepositories, userId = "owner") {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = userId;
        next();
    });
    app.use("/teams/:team_id/payouts", createTeamPayoutsRouter(repositories));
    app.use(
        (
            error: { code?: number | string; httpStatus?: number; message?: string; status?: number; statusCode?: number },
            _req: express.Request,
            res: express.Response,
            _next: express.NextFunction,
        ) => {
            res.status(error.httpStatus ?? error.status ?? error.statusCode ?? 400).json({ code: error.code, message: error.message });
        },
    );

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

describe("GET /teams/:team_id/payouts", () => {
    test("declares the assigned manifest route id", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/teams/:team_id/payouts/"]);
    });

    test("parses the documented payout pagination query", () => {
        assert.deepEqual(parseTeamPayoutsQuery({}), { after: undefined, limit: TEAM_PAYOUTS_DEFAULT_LIMIT });
        assert.deepEqual(parseTeamPayoutsQuery({ after: "123456789012345678", limit: "24" }), {
            after: "123456789012345678",
            limit: 24,
        });
        assert.deepEqual(parseTeamPayoutsQuery({ after: ["987654321098765432"], limit: [String(TEAM_PAYOUTS_MAX_LIMIT)] }), {
            after: "987654321098765432",
            limit: TEAM_PAYOUTS_MAX_LIMIT,
        });
    });

    test("rejects unsupported payout pagination query values", () => {
        assert.throws(() => parseTeamPayoutsQuery({ limit: "0" }), /limit must be between 1 and 96/);
        assert.throws(() => parseTeamPayoutsQuery({ limit: "97" }), /limit must be between 1 and 96/);
        assert.throws(() => parseTeamPayoutsQuery({ limit: "24.0" }), /limit must be between 1 and 96/);
        assert.throws(() => parseTeamPayoutsQuery({ limit: "not-a-number" }), /limit must be between 1 and 96/);
        assert.throws(() => parseTeamPayoutsQuery({ after: "0" }), /after must be a snowflake/);
        assert.throws(() => parseTeamPayoutsQuery({ after: "not-a-snowflake" }), /after must be a snowflake/);
    });

    test("queries the team and fails closed for the team owner", async (t) => {
        const teamRepository = {
            findOne: t.mock.fn(async (_options: unknown) => team()),
        };

        await assert.rejects(
            () => getTeamPayouts("team-1", "owner", { limit: "12", after: "123456789012345678" }, { teamRepository }),
            (error: { code?: number; httpStatus?: number; message?: string }) => error.code === 0 && error.httpStatus === 501 && error.message === TEAM_PAYOUTS_UNSUPPORTED_MESSAGE,
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
            () => getTeamPayouts("team-1", "member", {}, { teamRepository }),
            (error: { code?: number; httpStatus?: number; message?: string }) => error.code === 0 && error.httpStatus === 501 && error.message === TEAM_PAYOUTS_UNSUPPORTED_MESSAGE,
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
            () => getTeamPayouts("team-1", "invited-member", { limit: "not-a-number" }, { teamRepository }),
            (error) => error === MISSING_TEAM_PAYOUTS_ACCESS_ERROR,
        );
    });

    test("returns unknown team when the team does not exist", async (t) => {
        const teamRepository = {
            findOne: t.mock.fn(async (_options: unknown) => null),
        };

        await assert.rejects(
            () => getTeamPayouts("missing-team", "owner", {}, { teamRepository }),
            (error) => error === UNKNOWN_TEAM_PAYOUTS_TEAM_ERROR,
        );
    });

    test("returns the mounted unsupported route response for authorized team users", async (t) => {
        const repositories = {
            teamRepository: {
                findOne: t.mock.fn(async (_options: unknown) => team()),
            },
        };

        const response = await requestJson(createApp(repositories), "/teams/team-1/payouts?limit=24&after=123456789012345678");

        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: 0,
            message: TEAM_PAYOUTS_UNSUPPORTED_MESSAGE,
        });
    });

    test("returns missing access from the mounted route for non-members", async (t) => {
        const repositories = {
            teamRepository: {
                findOne: t.mock.fn(async (_options: unknown) => team({ members: [] })),
            },
        };

        const response = await requestJson(createApp(repositories, "not-a-member"), "/teams/team-1/payouts?limit=not-a-number");

        assert.equal(response.status, 403);
        assert.deepEqual(response.body, {
            code: MISSING_TEAM_PAYOUTS_ACCESS_ERROR.code,
            message: MISSING_TEAM_PAYOUTS_ACCESS_ERROR.message,
        });
    });

    test("declares authenticated metadata, query parsing, and explicit unsupported response schema", () => {
        const source = fs.readFileSync(path.join(process.cwd(), "src", "api", "routes", "teams", "#team_id", "payouts.ts"), "utf8");

        assert.match(source, /summary:\s*"Get Team Payouts"/);
        assert.match(source, /limit:\s*\{\s*type:\s*"number"/);
        assert.match(source, /after:\s*\{\s*type:\s*"string"/);
        assert.match(source, /does not currently persist payout records or integrate with a payout provider/);
        assert.match(source, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(source, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(source, /403:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(source, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(source, /501:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(source, /200:\s*\{/);
        assert.doesNotMatch(source, /payouts\/onboarding/);
        assert.doesNotMatch(source, /payouts\/\{payout_id\}\/report/);
    });
});
