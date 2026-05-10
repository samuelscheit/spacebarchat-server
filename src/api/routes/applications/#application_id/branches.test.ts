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
import { TeamMemberRole, TeamMemberState } from "../../../../schemas/api/developers/Team";
import { DiscordApiErrors } from "../../../../util/util/Constants";
import { createApplicationBranchesRouter, getApplicationBranches, type ApplicationBranchesRepositories } from "./branches";
import {
    createApplicationLiveBuildRouter,
    getApplicationLiveBuild,
    UNKNOWN_APPLICATION_LIVE_BUILD_ERROR,
    type ApplicationLiveBuildRepositories,
} from "./branches/#branch_id/builds/live";

function createApp(applicationRepository: NonNullable<ApplicationBranchesRepositories["applicationRepository"]>, userId = "owner") {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = userId;
        req.t = ((key: string) => key) as express.Request["t"];
        next();
    });
    app.use("/applications/:application_id/branches", createApplicationBranchesRouter({ applicationRepository }));
    app.use((error: { code?: number | string; httpStatus?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(error.httpStatus ?? 400).json({ code: error.code, message: error.message });
    });

    return app;
}

function createLiveBuildApp(
    applicationRepository: NonNullable<ApplicationLiveBuildRepositories["applicationRepository"]>,
    liveBuildRepository?: ApplicationLiveBuildRepositories["liveBuildRepository"],
    userId = "owner",
) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = userId;
        req.t = ((key: string) => key) as express.Request["t"];
        next();
    });
    app.use("/applications/:application_id/branches/:branch_id/builds/live", createApplicationLiveBuildRouter({ applicationRepository, liveBuildRepository }));
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

describe("GET /applications/:application_id/branches", () => {
    test("returns a conservative empty branch list for an authorized application owner", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({ owner: { id: "owner" } })),
        };

        assert.deepEqual(await getApplicationBranches("app", "owner", { applicationRepository }), []);
        assert.deepEqual(applicationRepository.findOne.mock.calls[0].arguments[0], {
            where: { id: "app" },
            relations: {
                owner: true,
                team: {
                    members: true,
                },
            },
        });
    });

    test("allows accepted team members to list branches", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                owner: { id: "owner" },
                team: {
                    members: [
                        {
                            user_id: "team-member",
                            membership_state: TeamMemberState.ACCEPTED,
                            role: TeamMemberRole.READ_ONLY,
                        },
                    ],
                },
            })),
        };

        assert.deepEqual(await getApplicationBranches("app", "team-member", { applicationRepository }), []);
    });

    test("rejects callers who cannot access the application", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({ owner: { id: "owner" } })),
        };

        await assert.rejects(
            () => getApplicationBranches("app", "attacker", { applicationRepository }),
            (error) => error === DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION,
        );
    });

    test("returns 404 for unknown applications from the mounted route", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => null),
        };

        const response = await requestJson(createApp(applicationRepository), "/applications/missing-app/branches");

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
            message: DiscordApiErrors.UNKNOWN_APPLICATION.message,
        });
    });

    test("returns the empty compatibility response from the mounted route", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({ owner: { id: "owner" } })),
        };

        const response = await requestJson(createApp(applicationRepository), "/applications/app/branches");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
    });
});

describe("GET /applications/:application_id/branches/:branch_id/builds/live", () => {
    test("returns a looked-up live build for an authorized application owner", async (t) => {
        const liveBuild = {
            id: "100000000000000010",
            manifests: [{ id: "100000000000000011" }],
        };
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({ owner: { id: "owner" } })),
        };
        const liveBuildRepository = {
            findLiveBuild: t.mock.fn(async (_options: unknown) => liveBuild),
        };

        assert.deepEqual(
            await getApplicationLiveBuild("app", "branch", "owner", { platform: "win32", locale: "en-US" }, { applicationRepository, liveBuildRepository }),
            liveBuild,
        );
        assert.deepEqual(liveBuildRepository.findLiveBuild.mock.calls[0].arguments[0], {
            applicationId: "app",
            branchId: "branch",
            platform: "win32",
            locale: "en-US",
        });
    });

    test("returns a source-compatible 404 when no live build persistence exists", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({ owner: { id: "owner" } })),
        };

        await assert.rejects(
            () => getApplicationLiveBuild("app", "branch", "owner", {}, { applicationRepository }),
            (error) => error === UNKNOWN_APPLICATION_LIVE_BUILD_ERROR,
        );
        assert.equal(UNKNOWN_APPLICATION_LIVE_BUILD_ERROR.httpStatus, 404);
    });

    test("rejects unauthorized callers before live build lookup", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({ owner: { id: "owner" } })),
        };
        const liveBuildRepository = {
            findLiveBuild: t.mock.fn(async () => {
                throw new Error("live build lookup must not run for unauthorized callers");
            }),
        };

        await assert.rejects(
            () => getApplicationLiveBuild("app", "branch", "attacker", {}, { applicationRepository, liveBuildRepository }),
            (error) => error === DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION,
        );
        assert.equal(liveBuildRepository.findLiveBuild.mock.calls.length, 0);
    });

    test("returns 404 for unsupported live builds from the mounted route", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({ owner: { id: "owner" } })),
        };

        const response = await requestJson(createLiveBuildApp(applicationRepository), "/applications/app/branches/branch/builds/live?platform=win32&locale=en-US");

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: UNKNOWN_APPLICATION_LIVE_BUILD_ERROR.code,
            message: UNKNOWN_APPLICATION_LIVE_BUILD_ERROR.message,
        });
    });

    test("passes platform and locale query options from the mounted route", async (t) => {
        const liveBuild = {
            id: "100000000000000012",
            manifests: [{ id: "100000000000000013" }],
        };
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({ owner: { id: "owner" } })),
        };
        const liveBuildRepository = {
            findLiveBuild: t.mock.fn(async (_options: unknown) => liveBuild),
        };

        const response = await requestJson(createLiveBuildApp(applicationRepository, liveBuildRepository), "/applications/app/branches/branch/builds/live?platform=osx&locale=de");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, liveBuild);
        assert.deepEqual(liveBuildRepository.findLiveBuild.mock.calls[0].arguments[0], {
            applicationId: "app",
            branchId: "branch",
            platform: "osx",
            locale: "de",
        });
    });
});
