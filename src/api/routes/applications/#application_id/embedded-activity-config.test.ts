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
import {
    APPLICATION_EMBEDDED_ACTIVITY_CONFIG_UNSUPPORTED_MESSAGE,
    createApplicationEmbeddedActivityConfigRouter,
    getApplicationEmbeddedActivityConfig,
    type ApplicationEmbeddedActivityConfigDependencies,
} from "./embedded-activity-config";

const validApplicationId = "100000000000000001";

function createApp(applicationRepository: NonNullable<ApplicationEmbeddedActivityConfigDependencies["applicationRepository"]>, userId = "owner") {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = userId;
        req.t = ((key: string) => key) as express.Request["t"];
        next();
    });
    app.use("/applications/:application_id/embedded-activity-config", createApplicationEmbeddedActivityConfigRouter({ applicationRepository }));
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

describe("GET /applications/:application_id/embedded-activity-config", () => {
    test("authorizes an application owner before failing closed for unsupported local config state", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({ owner: { id: "owner" } })),
        };

        await assert.rejects(
            () => getApplicationEmbeddedActivityConfig(validApplicationId, "owner", { applicationRepository }),
            (error) =>
                (error as { code?: unknown; httpStatus?: unknown; message?: unknown }).code === 0 &&
                (error as { code?: unknown; httpStatus?: unknown; message?: unknown }).httpStatus === 501 &&
                (error as { code?: unknown; httpStatus?: unknown; message?: unknown }).message === APPLICATION_EMBEDDED_ACTIVITY_CONFIG_UNSUPPORTED_MESSAGE,
        );

        assert.deepEqual(applicationRepository.findOne.mock.calls[0].arguments[0], {
            where: { id: validApplicationId },
            relations: {
                owner: true,
                team: {
                    members: true,
                },
            },
        });
    });

    test("allows accepted team members with any team role", async (t) => {
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

        await assert.rejects(
            () => getApplicationEmbeddedActivityConfig(validApplicationId, "team-member", { applicationRepository }),
            (error) => (error as { httpStatus?: unknown }).httpStatus === 501,
        );
    });

    test("rejects invalid application ids before repository lookup", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async () => {
                throw new Error("application lookup must not run for invalid route ids");
            }),
        };

        await assert.rejects(
            () => getApplicationEmbeddedActivityConfig("not-a-snowflake", "owner", { applicationRepository }),
            (error) =>
                (error as { code?: unknown; message?: unknown }).code === DiscordApiErrors.UNKNOWN_APPLICATION.code &&
                (error as { code?: unknown; message?: unknown }).message === DiscordApiErrors.UNKNOWN_APPLICATION.message,
        );
        assert.equal(applicationRepository.findOne.mock.calls.length, 0);
    });

    test("rejects unauthorized callers before exposing unsupported local state", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({ owner: { id: "owner" } })),
        };

        await assert.rejects(
            () => getApplicationEmbeddedActivityConfig(validApplicationId, "attacker", { applicationRepository }),
            (error) => error === DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION,
        );
    });

    test("returns 501 from the mounted route for an authorized application owner", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({ owner: { id: "owner" } })),
        };

        const response = await requestJson(createApp(applicationRepository), `/applications/${validApplicationId}/embedded-activity-config`);

        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: 0,
            message: APPLICATION_EMBEDDED_ACTIVITY_CONFIG_UNSUPPORTED_MESSAGE,
        });
    });

    test("returns 403 from the mounted route for unauthorized callers", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({ owner: { id: "owner" } })),
        };

        const response = await requestJson(createApp(applicationRepository, "attacker"), `/applications/${validApplicationId}/embedded-activity-config`);

        assert.equal(response.status, 403);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code,
            message: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.message,
        });
    });

    test("returns 404 from the mounted route for unknown applications", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => null),
        };

        const response = await requestJson(createApp(applicationRepository), `/applications/${validApplicationId}/embedded-activity-config`);

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
            message: DiscordApiErrors.UNKNOWN_APPLICATION.message,
        });
    });
});
