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
import type { AddressInfo } from "node:net";
import path from "node:path";
import { afterEach, describe, test, type TestContext } from "node:test";
import { TeamMemberState, type APIApplication } from "@spacebar/schemas";
import express from "express";
import { isNoAuthorizationRoute } from "../middlewares/NoAuthorizationRoutes";
import type { ApplicationsWithAssetsApplicationRepository, ApplicationsWithAssetsRepositories, ApplicationsWithAssetsTeamRepository } from "./applications-with-assets";

const requireModule = require;
const routeModulePath = require.resolve("./applications-with-assets");

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("GET /applications-with-assets", () => {
    test("declares authenticated metadata and asset response shape", (t) => {
        const harness = setupApplicationsWithAssetsRoute(t);

        assert.deepEqual(harness.routeOptions[0], {
            summary: "Get Applications with Assets",
            query: {
                with_team_applications: {
                    type: "boolean",
                    description: "Whether to include applications from teams the current user can access.",
                },
            },
            responses: {
                200: {
                    body: "ApplicationsWithAssetsResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        });
    });

    test("stays on the authenticated route boundary", () => {
        assert.equal(isNoAuthorizationRoute("GET", "/applications-with-assets"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/applications-with-assets"), false);
    });

    test("returns owned applications with a truthful empty asset map", async (t) => {
        const ownedApplications = [application("100000000000000001", "Owned App")];
        const applicationRepository = createApplicationRepository(t, async () => ownedApplications);
        const teamRepository = createTeamRepository(t, async () => {
            throw new Error("team applications should not be loaded unless requested");
        });
        const harness = setupApplicationsWithAssetsRoute(t, {
            applicationRepository,
            teamRepository,
        });

        const response = await requestJson(harness.app, "/applications-with-assets");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            applications: ownedApplications,
            assets: {},
        });
        assert.equal(applicationRepository.find.mock.callCount(), 1);
        assert.deepEqual(applicationRepository.find.mock.calls[0].arguments[0], {
            where: { owner: { id: "authorized-user" } },
            relations: { owner: true, bot: true },
            order: { id: "ASC" },
        });
        assert.equal(teamRepository.find.mock.callCount(), 0);
    });

    test("includes accessible team applications when requested and keeps owned app precedence", async (t) => {
        const ownedApplication = application("100000000000000001", "Owned App");
        const duplicateTeamApplication = application("100000000000000001", "Duplicate Team App");
        const teamApplication = application("200000000000000002", "Team App");
        let applicationFindCalls = 0;
        const applicationRepository = createApplicationRepository(t, async () => (applicationFindCalls++ === 0 ? [ownedApplication] : [duplicateTeamApplication, teamApplication]));
        const teamRepository = createTeamRepository(t, async () => [{ id: "300000000000000003" }]);
        const harness = setupApplicationsWithAssetsRoute(t, {
            applicationRepository,
            teamRepository,
        });

        const response = await requestJson(harness.app, "/applications-with-assets?with_team_applications=true");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            applications: [ownedApplication, teamApplication],
            assets: {},
        });
        assert.equal(applicationRepository.find.mock.callCount(), 2);
        assert.deepEqual(teamRepository.find.mock.calls[0].arguments[0], {
            where: [
                { owner_user_id: "authorized-user" },
                {
                    members: {
                        user_id: "authorized-user",
                        membership_state: TeamMemberState.ACCEPTED,
                    },
                },
            ],
            relations: { members: true },
            select: { id: true },
            order: { id: "ASC" },
        });
    });
});

function application(id: string, name: string): APIApplication {
    return {
        id,
        name,
        description: "",
        flags: 0,
    };
}

function createApplicationRepository(t: TestContext, implementation: (options: unknown) => Promise<APIApplication[]>) {
    return {
        find: t.mock.fn(implementation),
    } satisfies ApplicationsWithAssetsApplicationRepository;
}

function createTeamRepository(t: TestContext, implementation: (options: unknown) => Promise<{ id: string }[]>) {
    return {
        find: t.mock.fn(implementation),
    } satisfies ApplicationsWithAssetsTeamRepository;
}

function setupApplicationsWithAssetsRoute(t: TestContext, repositories: ApplicationsWithAssetsRepositories = {}) {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../util/handlers/route");
    const routeOptions: unknown[] = [];

    t.mock.method(routeHandler, "route", (options: unknown) => {
        routeOptions.push(options);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });

    delete require.cache[routeModulePath];
    const routeModule = requireModule(routeModulePath) as typeof import("./applications-with-assets");

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "authorized-user";
        next();
    });
    app.use("/applications-with-assets", routeModule.createApplicationsWithAssetsRouter(repositories));

    return {
        app,
        get routeOptions() {
            return routeOptions;
        },
    };
}

async function requestJson(app: express.Express, requestPath: string): Promise<{ status: number; body: unknown }> {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`);

        return {
            status: response.status,
            body: await response.json(),
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}
