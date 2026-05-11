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
import path from "node:path";
import { afterEach, describe, test, type TestContext } from "node:test";
import { TeamMemberRole, TeamMemberState } from "@spacebar/schemas";
import { DiscordApiErrors } from "@spacebar/util";
import express, { type NextFunction, type Request, type Response } from "express";
import { createOAuth2ApplicationAuthorizationsRouter, getApplicationOAuth2Authorizations, type ApplicationOAuth2AuthorizationsRepositories } from "./tokens";

const requireModule = require;
const routeModulePath = require.resolve("./tokens");

afterEach(() => {
    delete require.cache[routeModulePath];
});

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

function setupRouteMetadataHarness(t: TestContext) {
    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../../util/handlers/route");
    const routeOptions: unknown[] = [];

    t.mock.method(routeHandler, "route", (options: unknown) => {
        routeOptions.push(options);
        return (_req: Request, _res: Response, next: NextFunction) => next();
    });

    delete require.cache[routeModulePath];
    requireModule(routeModulePath);

    return routeOptions;
}

function createApp(applicationRepository: NonNullable<ApplicationOAuth2AuthorizationsRepositories["applicationRepository"]>, userId = "owner") {
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = userId;
        next();
    });
    app.use("/oauth2/applications/:application_id/tokens", createOAuth2ApplicationAuthorizationsRouter({ applicationRepository }));
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

describe("GET /oauth2/applications/:application_id/tokens", () => {
    test("declares authenticated metadata for the application OAuth2 authorization list route", (t) => {
        assert.deepEqual(setupRouteMetadataHarness(t), [
            {
                summary: "Get Application OAuth2 Authorizations",
                responses: {
                    200: {
                        body: "OAuthAuthorizationsResponse",
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
                },
            },
        ]);
    });

    test("returns a conservative empty authorization list for an authorized application owner", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({ owner: { id: "owner" } })),
        };

        assert.deepEqual(await getApplicationOAuth2Authorizations("app", "owner", { applicationRepository }), []);
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

    test("allows accepted team members to list application authorizations", async (t) => {
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

        assert.deepEqual(await getApplicationOAuth2Authorizations("app", "team-member", { applicationRepository }), []);
    });

    test("rejects callers who cannot access the application", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({ owner: { id: "owner" } })),
        };

        await assert.rejects(
            () => getApplicationOAuth2Authorizations("app", "attacker", { applicationRepository }),
            (error) =>
                (error as { code?: unknown; message?: unknown }).code === DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code &&
                (error as { code?: unknown; message?: unknown }).message === DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.message,
        );
    });

    test("returns 404 for unknown applications from the mounted route", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => null),
        };

        const response = await requestJson(createApp(applicationRepository), "/oauth2/applications/missing-app/tokens");

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

        const response = await requestJson(createApp(applicationRepository), "/oauth2/applications/app/tokens");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
    });
});
